import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from '@nestjs/common';
import {ChildProcess, fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {chmod, lstat, mkdir, readdir, rm, writeFile} from 'node:fs/promises';
import {basename, extname, join} from 'node:path';
import {z} from 'zod';
import {Config} from '../../config/config';
import {CvsService} from '../cvs/cvs.service';
import {AccountService} from '../account/account.service';
import {ResumeDocument} from '../publication/publication.dto';
import {ApiError, conflict, invalid, notFound} from '../../common/errors';
import {secret} from '../../common/credentials';
import {ResumeImportCandidate} from './import.dto';
import {
  IMPORT_MAX_BLOCKS,
  IMPORT_MAX_BLOCK_CHARACTERS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_PDF_PAGES,
  IMPORT_MAX_TEXT_CHARACTERS,
  IMPORT_TEMP_TTL_MS,
  IMPORT_WORKER_HEAP_MB,
  IMPORT_WORKER_TIMEOUT_MS,
} from './import.constants';

const importPositionSchema = z
  .object({
    x: z.number().finite().min(-10000).max(10000),
    y: z.number().finite().min(-10000).max(10000),
  })
  .strict();
const importBlockSchema = z
  .object({
    kind: z.enum(['heading', 'paragraph', 'list-item', 'table-row', 'line']),
    order: z
      .number()
      .int()
      .min(0)
      .max(IMPORT_MAX_BLOCKS - 1),
    text: z.string().min(1).max(IMPORT_MAX_BLOCK_CHARACTERS),
    page: z.number().int().min(1).max(IMPORT_MAX_PDF_PAGES).optional(),
    position: importPositionSchema.optional(),
  })
  .strict();
const importCandidateSchema = z
  .object({
    format: z.enum(['docx', 'pdf']),
    pageCount: z.number().int().min(1).max(IMPORT_MAX_PDF_PAGES).optional(),
    blocks: z.array(importBlockSchema).min(1).max(IMPORT_MAX_BLOCKS),
    warnings: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict()
  .refine(
    (candidate) =>
      candidate.blocks.reduce((count, block) => count + block.text.length, 0) <=
      IMPORT_MAX_TEXT_CHARACTERS,
    'Import text exceeds the configured limit.',
  );

type ImportFormat = 'docx' | 'pdf';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function workerFailure(value: unknown): ApiError {
  const reason = typeof value === 'string' ? value : '';
  if (reason === 'NO_TEXT_LAYER')
    return new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_NO_TEXT_LAYER');
  if (reason === 'ENCRYPTED_FILE')
    return new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_ENCRYPTED_FILE');
  if (reason === 'IMPORT_LIMIT_EXCEEDED')
    return new ApiError(413, 'RESOURCE_EXHAUSTED', 'IMPORT_LIMIT_EXCEEDED');
  if (reason === 'INVALID_FILE' || reason === 'INVALID_ARCHIVE')
    return new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_INVALID_FILE');
  if (reason === 'IMPORT_PARSE_FAILED')
    return new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_PARSE_FAILED');
  return new ApiError(503, 'UNAVAILABLE', 'IMPORT_WORKER_UNAVAILABLE');
}
@Injectable()
export class FilesService implements OnModuleInit, OnModuleDestroy {
  private readonly tickets = new Map<
    string,
    {expires: number; owner: string; document: ResumeDocument}
  >();
  private readonly children = new Set<ChildProcess>();
  private readonly importDirectories = new Set<string>();
  private importCleanupTimer: NodeJS.Timeout | undefined;
  constructor(
    private readonly config: Config,
    private readonly cvs: CvsService,
    private readonly accounts: AccountService,
  ) {}
  private get importRoot(): string {
    return join(this.config.dataDir, 'imports');
  }
  async onModuleInit(): Promise<void> {
    await mkdir(this.importRoot, {recursive: true, mode: 0o700});
    await chmod(this.importRoot, 0o700);
    await this.cleanExpiredImports();
    this.importCleanupTimer = setInterval(
      () => {
        void this.cleanExpiredImports().catch(() =>
          Logger.warn('Expired import file cleanup failed.', 'FilesService'),
        );
      },
      10 * 60 * 1000,
    );
    this.importCleanupTimer.unref();
  }
  private async cleanExpiredImports(): Promise<void> {
    const expiredBefore = Date.now() - IMPORT_TEMP_TTL_MS;
    for (const name of await readdir(this.importRoot)) {
      if (!/^import-[a-f0-9]{32}$/.test(name)) continue;
      const path = join(this.importRoot, name);
      let info;
      try {
        info = await lstat(path);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
        throw error;
      }
      if (!info.isDirectory() || info.mtimeMs >= expiredBefore) continue;
      await rm(path, {recursive: true, force: true});
    }
  }
  async context(ticket: string): Promise<ResumeDocument> {
    const context = this.tickets.get(ticket);
    if (!context || context.expires <= Date.now()) {
      this.tickets.delete(ticket);
      throw notFound();
    }
    await this.accounts.resource(context.owner);
    return structuredClone(context.document);
  }
  private stop(child: ChildProcess): void {
    const pid = child.pid;
    if (!pid || child.exitCode !== null || child.signalCode !== null) return;
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-pid, 'SIGTERM');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return;
      // Some hosts deny process-group signals. Never let cleanup crash the API.
      try {
        child.kill('SIGTERM');
      } catch {
        Logger.warn('File worker termination could not be signalled.', 'FilesService');
      }
    }
    const force = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          Logger.warn('File worker could not be terminated.', 'FilesService');
        }
      }
    }, 2000);
    force.unref();
    child.once('exit', () => clearTimeout(force));
  }
  private detectImportFormat(file: Express.Multer.File | undefined): {
    file: Express.Multer.File;
    format: ImportFormat;
  } {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0)
      throw new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_FILE_REQUIRED');
    if (file.size > IMPORT_MAX_BYTES || file.buffer.length > IMPORT_MAX_BYTES)
      throw new ApiError(413, 'RESOURCE_EXHAUSTED', 'IMPORT_FILE_TOO_LARGE');
    const fileName = basename(file.originalname.replace(/\\/g, '/'));
    const extension = extname(fileName).toLowerCase();
    if (extension === '.doc')
      throw new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_UNSUPPORTED_FORMAT');
    if (extension === '.pdf') {
      if (file.buffer.subarray(0, 5).toString() !== '%PDF-')
        throw new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_INVALID_FILE');
      return {file, format: 'pdf'};
    }
    if (extension === '.docx') {
      if (!file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
        throw new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_INVALID_FILE');
      return {file, format: 'docx'};
    }
    throw new ApiError(400, 'INVALID_ARGUMENT', 'IMPORT_UNSUPPORTED_FORMAT');
  }
  private runImportWorker(
    path: string,
    format: ImportFormat,
    signal: AbortSignal,
  ): Promise<unknown> {
    if (this.children.size >= 2)
      throw new ApiError(429, 'RESOURCE_EXHAUSTED', 'IMPORT_PROCESSOR_BUSY');
    return new Promise((resolveResult, rejectResult) => {
      const child = fork(join(__dirname, 'workers/document_import.worker.js'), [], {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        execArgv: [`--max-old-space-size=${IMPORT_WORKER_HEAP_MB}`],
      });
      this.children.add(child);
      let completed = false;
      const finish = (error?: Error, result?: unknown) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        if (error) this.stop(child);
        if (error) rejectResult(error);
        else resolveResult(result);
      };
      const abort = () => finish(new ApiError(499, 'CANCELLED', 'IMPORT_CANCELLED'));
      const timer = setTimeout(
        () => finish(new ApiError(503, 'UNAVAILABLE', 'IMPORT_TIMEOUT')),
        IMPORT_WORKER_TIMEOUT_MS,
      );
      timer.unref();
      child.on('error', () => {
        this.children.delete(child);
        finish(new ApiError(503, 'UNAVAILABLE', 'IMPORT_WORKER_UNAVAILABLE'));
      });
      child.on('exit', () => {
        this.children.delete(child);
        if (!completed) finish(new ApiError(503, 'UNAVAILABLE', 'IMPORT_WORKER_UNAVAILABLE'));
      });
      child.once('message', (message: unknown) => {
        if (!isRecord(message)) {
          finish(new ApiError(503, 'UNAVAILABLE', 'IMPORT_WORKER_INVALID_RESPONSE'));
        } else if ('result' in message) {
          finish(undefined, message.result);
        } else {
          finish(workerFailure(message.error));
        }
      });
      signal.addEventListener('abort', abort, {once: true});
      if (signal.aborted) {
        abort();
        return;
      }
      child.send({path, format}, (error) => {
        if (error) finish(new ApiError(503, 'UNAVAILABLE', 'IMPORT_WORKER_UNAVAILABLE'));
      });
    });
  }
  async parseResumeImport(
    file: Express.Multer.File | undefined,
    owner: string,
    signal: AbortSignal,
  ): Promise<ResumeImportCandidate> {
    const detected = this.detectImportFormat(file);
    const format = detected.format;
    if (signal.aborted) throw new ApiError(499, 'CANCELLED', 'IMPORT_CANCELLED');
    const directory = join(this.importRoot, `import-${randomUUID().replace(/-/g, '')}`);
    await mkdir(directory, {mode: 0o700});
    await chmod(directory, 0o700);
    this.importDirectories.add(directory);
    try {
      const path = join(directory, 'source');
      await writeFile(path, detected.file.buffer, {flag: 'wx', mode: 0o600});
      const raw = await this.runImportWorker(path, format, signal);
      const parsed = importCandidateSchema.safeParse(raw);
      if (!parsed.success || parsed.data.format !== format)
        throw new ApiError(503, 'UNAVAILABLE', 'IMPORT_WORKER_INVALID_RESPONSE');
      await this.accounts.resource(owner);
      return Object.assign(new ResumeImportCandidate(), parsed.data);
    } finally {
      await rm(directory, {recursive: true, force: true});
      this.importDirectories.delete(directory);
    }
  }
  async pdf(id: string, owner: string, etag: string, signal: AbortSignal): Promise<Buffer> {
    if (!etag || typeof etag !== 'string') throw invalid('ETag is required.');
    const cv = await this.cvs.get(id, owner);
    if (cv.etag !== etag) throw conflict();
    if (this.children.size >= 2) throw new ApiError(429, 'RESOURCE_EXHAUSTED', 'PDF_BUSY');
    const ticket = secret();
    this.tickets.set(ticket, {
      owner,
      expires: Date.now() + 120000,
      document: structuredClone({
        profile: cv.profile,
        sections: cv.sections,
        styleSettings: cv.styleSettings,
      }),
    });
    try {
      const result = await new Promise<Buffer>((resolve, reject) => {
        const child = fork(join(__dirname, 'workers/pdf.worker.js'), [], {
          detached: true,
          serialization: 'advanced',
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
          execArgv: ['--max-old-space-size=256'],
        });
        this.children.add(child);
        let done = false;
        const finish = (error?: Error, bytes?: Buffer) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          if (error) this.stop(child);
          if (error) reject(error);
          else resolve(bytes || Buffer.alloc(0));
        };
        const abort = () => finish(new ApiError(499, 'CANCELLED', 'PDF_CANCELLED'));
        const timer = setTimeout(
          () => finish(new ApiError(503, 'UNAVAILABLE', 'PDF_TIMEOUT')),
          75000,
        );
        child.on('error', () => {
          this.children.delete(child);
          finish(new ApiError(503, 'UNAVAILABLE', 'PDF_UNAVAILABLE'));
        });
        child.on('exit', () => {
          this.children.delete(child);
          finish(new ApiError(503, 'UNAVAILABLE', 'PDF_UNAVAILABLE'));
        });
        child.on('message', (value: unknown) => {
          if (
            value &&
            typeof value === 'object' &&
            'data' in value &&
            Buffer.isBuffer(value.data) &&
            value.data.length <= 20971520 &&
            value.data.subarray(0, 5).toString() === '%PDF-'
          )
            finish(undefined, value.data);
          else finish(new ApiError(503, 'UNAVAILABLE', 'PDF_UNAVAILABLE'));
        });
        signal.addEventListener('abort', abort, {once: true});
        if (signal.aborted) {
          abort();
          return;
        }
        child.send({url: `${this.config.frontendUrl}/print/${ticket}`});
      });
      await this.accounts.resource(owner);
      await this.cvs.get(id, owner);
      return result;
    } finally {
      this.tickets.delete(ticket);
    }
  }
  async onModuleDestroy(): Promise<void> {
    if (this.importCleanupTimer) clearInterval(this.importCleanupTimer);
    for (const child of this.children) this.stop(child);
    this.children.clear();
    this.tickets.clear();
    await Promise.all(
      [...this.importDirectories].map((path) => rm(path, {recursive: true, force: true})),
    );
    this.importDirectories.clear();
  }
}
