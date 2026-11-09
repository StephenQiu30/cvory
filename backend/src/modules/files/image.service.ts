import {Injectable, OnModuleDestroy} from '@nestjs/common';
import {ChildProcess, fork} from 'node:child_process';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {join} from 'node:path';
import {Config} from '../../config/config';
import {ApiError, invalid} from '../../common/errors';

@Injectable()
export class ImageService implements OnModuleDestroy {
  private readonly children = new Set<ChildProcess>();
  constructor(private readonly config: Config) {}
  async normalize(value: string | null): Promise<string | null> {
    if (!value) return null;
    if (value.length > 2800000 || !value.startsWith('data:image/'))
      throw invalid('Image must be an uploaded JPEG, PNG or WebP up to 2 MiB.');
    if (this.children.size >= 2)
      throw new ApiError(429, 'RESOURCE_EXHAUSTED', 'IMAGE_PROCESSOR_BUSY');
    return new Promise((resolve, reject) => {
      const child = fork(join(__dirname, 'workers/image.worker.js'), [], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        execArgv: ['--max-old-space-size=128'],
      });
      this.children.add(child);
      let completed = false;
      const finish = (error?: Error, result?: string) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        this.children.delete(child);
        child.kill();
        if (error) reject(error);
        else resolve(result || null);
      };
      const timer = setTimeout(
        () => finish(new ApiError(503, 'UNAVAILABLE', 'IMAGE_PROCESSOR_TIMEOUT')),
        10000,
      );
      child.on('error', () =>
        finish(new ApiError(503, 'UNAVAILABLE', 'IMAGE_PROCESSOR_UNAVAILABLE')),
      );
      child.on('exit', () =>
        finish(new ApiError(503, 'UNAVAILABLE', 'IMAGE_PROCESSOR_UNAVAILABLE')),
      );
      child.on('message', (message: unknown) => {
        if (
          message &&
          typeof message === 'object' &&
          'result' in message &&
          typeof message.result === 'string'
        )
          finish(undefined, message.result);
        else finish(invalid('Image could not be decoded.'));
      });
      child.send(value);
    });
  }
  async legacy(value: unknown, id: string): Promise<unknown> {
    if (typeof value !== 'string' || !value.startsWith(`/api/cvs/${id}/avatar`)) return value;
    if (!/^[a-f\d-]{36}$/i.test(id)) throw invalid('Invalid legacy image reference.');
    for (const extension of ['jpg', 'jpeg', 'png', 'webp']) {
      let file;
      try {
        file = await open(
          join(this.config.dataDir, 'avatars', `${id}.${extension}`),
          constants.O_RDONLY | constants.O_NOFOLLOW,
        );
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > 2097152)
          throw invalid('Legacy image exceeds the size limit.');
        const bytes = await file.readFile();
        return await this.normalize(
          `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${bytes.toString('base64')}`,
        );
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      } finally {
        await file?.close();
      }
    }
    throw new ApiError(
      409,
      'FAILED_PRECONDITION',
      'LEGACY_IMAGE_MISSING',
      'Restore the private image from backup before editing.',
    );
  }
  onModuleDestroy(): void {
    for (const child of this.children) child.kill();
    this.children.clear();
  }
}
