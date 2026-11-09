import {Injectable, Logger, OnModuleDestroy} from '@nestjs/common';
import {ChildProcess, fork} from 'node:child_process';
import {join} from 'node:path';
import {Config} from '../../config/config';
import {CvsService} from '../cvs/cvs.service';
import {AccountService} from '../account/account.service';
import {ResumeDocument} from '../publication/publication.dto';
import {ApiError, conflict, invalid, notFound} from '../../common/errors';
import {secret} from '../../common/credentials';
@Injectable()
export class FilesService implements OnModuleDestroy {
  private readonly tickets = new Map<
    string,
    {expires: number; owner: string; document: ResumeDocument}
  >();
  private readonly children = new Set<ChildProcess>();
  constructor(
    private readonly config: Config,
    private readonly cvs: CvsService,
    private readonly accounts: AccountService,
  ) {}
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
        Logger.warn('PDF worker termination could not be signalled.', 'FilesService');
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
          Logger.warn('PDF worker could not be terminated.', 'FilesService');
        }
      }
    }, 2000);
    force.unref();
    child.once('exit', () => clearTimeout(force));
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
  onModuleDestroy(): void {
    for (const child of this.children) this.stop(child);
    this.children.clear();
    this.tickets.clear();
  }
}
