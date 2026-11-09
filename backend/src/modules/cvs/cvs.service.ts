import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {PoolConnection} from 'mysql2/promise';
import {Database, Row} from '../../database/database';
import {conflict, invalid, notFound} from '../../common/errors';
import {digest, secret} from '../../common/credentials';
import {CreateCVRequest, UpdateCVRequest} from './cvs.dto';
import {emptyDocument, keys, validateDocument} from './document';
import {Config} from '../../config/config';
import {ImageService} from '../files/image.service';
import {CvResource as CVResource, CvHistory} from './cv_resource.dto';
import {z} from 'zod';

const snapshotMetadata = z.object({
  id: z.string().min(1).max(36),
  name: z.string(),
  displayName: z.string().max(255),
  etag: z.string().max(64),
  createTime: z.iso.datetime(),
  updateTime: z.iso.datetime(),
  formatVersion: z.literal(1).optional(),
});
function snapshotResource(value: unknown): CVResource {
  const metadata = snapshotMetadata.safeParse(value);
  if (!metadata.success) throw invalid('Unsupported revision snapshot.');
  const fields = metadata.data;
  return {
    id: fields.id,
    name: fields.name,
    displayName: fields.displayName,
    etag: fields.etag,
    createTime: fields.createTime,
    updateTime: fields.updateTime,
    ...validateDocument(value),
  };
}

const parse = (value: unknown): unknown => (typeof value === 'string' ? JSON.parse(value) : value);
const time = (value: unknown): string =>
  new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
@Injectable()
export class CvsService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
    private readonly images: ImageService,
  ) {}

  private async resource(row: Row): Promise<CVResource> {
    const profile = parse(row.profile);
    if (profile && typeof profile === 'object' && 'avatar_url' in profile)
      profile.avatar_url = await this.images.legacy(profile.avatar_url, String(row.id));
    return {
      id: String(row.id),
      name: `cvs/${row.id}`,
      displayName: String(row.display_name),
      etag: String(row.etag),
      createTime: time(row.create_time),
      updateTime: time(row.update_time),
      ...validateDocument(
        keys(
          {
            profile,
            sections: parse(row.sections),
            styleSettings: parse(row.style_settings),
          },
          'wire',
        ),
      ),
    };
  }
  async get(
    id: string,
    owner: string,
    connection?: PoolConnection,
    lock = false,
  ): Promise<CVResource> {
    const [row] = await this.db.rows(
      `SELECT * FROM cvs WHERE id=? AND owner_id=?${lock ? ' FOR UPDATE' : ''}`,
      [id, owner],
      connection,
    );
    if (!row) throw notFound();
    return this.resource(row);
  }
  async list(owner: string, size: number, token: string) {
    if (!Number.isInteger(size) || size < 1 || size > 100) throw invalid('Invalid page size.');
    let offset = 0;
    if (token) {
      try {
        offset = Number(Buffer.from(token, 'base64url').toString());
      } catch {
        throw invalid('Invalid page token.');
      }
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
        throw invalid('Invalid page token.');
    }
    const [count] = await this.db.rows('SELECT COUNT(*) AS total FROM cvs WHERE owner_id=?', [
      owner,
    ]);
    const rows = await this.db.rows(
      `SELECT id FROM cvs WHERE owner_id=? ORDER BY update_time DESC,id LIMIT ${size} OFFSET ${offset}`,
      [owner],
    );
    const total = Number(count.total);
    // Legacy photos use a bounded decoder shared with uploads. A list must not
    // launch its whole page at once and exhaust that limit on its own.
    const cvs: CVResource[] = [];
    const documents = rows.length
      ? await this.db.rows(
          'SELECT * FROM cvs WHERE owner_id=? AND id IN (' + rows.map(() => '?').join(',') + ')',
          [owner, ...rows.map((row) => String(row.id))],
        )
      : [];
    const byId = new Map(documents.map((row) => [String(row.id), row]));
    for (const selected of rows) {
      const row = byId.get(String(selected.id));
      if (row) cvs.push(await this.resource(row));
    }
    return {
      cvs,
      totalSize: total,
      nextPageToken:
        offset + rows.length < total
          ? Buffer.from(String(offset + rows.length)).toString('base64url')
          : '',
    };
  }
  async create(
    body: CreateCVRequest,
    owner: string,
    connection?: PoolConnection,
  ): Promise<CVResource> {
    if (!connection) return this.db.transaction((tx) => this.create(body, owner, tx));
    // Serialize create/retry for this owner before establishing a consistent-read
    // snapshot. This also avoids duplicate-key shared-lock upgrade deadlocks.
    await this.db.rows('SELECT id FROM accounts WHERE id=? FOR UPDATE', [owner], connection);
    if (
      typeof body.displayName !== 'string' ||
      !body.displayName.trim() ||
      body.displayName.length > 255
    )
      throw invalid('Invalid display name.');
    const id = body.requestId
      ? digest(`${owner}:create:${body.requestId}`).slice(0, 36)
      : randomUUID();
    const existing = await this.db.rows(
      'SELECT * FROM cvs WHERE id=? AND owner_id=?',
      [id, owner],
      connection,
    );
    if (existing.length) return this.resource(existing[0]);
    const doc = validateDocument({
      ...emptyDocument(),
      ...Object.fromEntries(
        Object.entries(body).filter(
          ([key, value]) =>
            value !== undefined && ['profile', 'sections', 'styleSettings'].includes(key),
        ),
      ),
    });
    doc.profile.avatarUrl = await this.images.normalize(doc.profile.avatarUrl);
    const etag = secret().slice(0, 32);
    try {
      await this.db.run(
        'INSERT INTO cvs(id,owner_id,display_name,etag,profile,sections,style_settings,create_time,update_time) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
        [
          id,
          owner,
          body.displayName.trim(),
          etag,
          JSON.stringify(keys(doc.profile, 'storage')),
          JSON.stringify(keys(doc.sections, 'storage')),
          JSON.stringify(keys(doc.styleSettings, 'storage')),
        ],
        connection,
      );
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY' &&
        body.requestId
      ))
        throw error;
      // Duplicate-key waits can outlive this transaction's REPEATABLE READ snapshot.
      // A locking read sees the winning committed insert.
      return this.get(id, owner, connection, true);
    }
    const cv = await this.get(id, owner, connection);
    await this.snapshot(cv, owner, connection);
    return cv;
  }
  async update(
    id: string,
    owner: string,
    body: UpdateCVRequest,
    header?: string,
  ): Promise<CVResource> {
    const etag = body.etag || header?.replaceAll('"', '');
    if (!etag) throw invalid('ETag is required.');
    return this.db.transaction(async (connection) => {
      const current = await this.get(id, owner, connection, true);
      if (current.etag !== etag) throw conflict();
      const allowed = ['displayName', 'profile', 'sections', 'styleSettings'] as const;
      const mask = body.updateMask?.split(',').map((field) => field.trim()) || [...allowed];
      if (mask.some((field) => !allowed.includes(field as (typeof allowed)[number])))
        throw invalid('Unsupported update mask.');
      const values = Object.fromEntries(
        allowed
          .filter((field) => mask.includes(field) && body[field] !== undefined)
          .map((field) => [field, body[field]]),
      );
      if (
        'displayName' in values &&
        (typeof values.displayName !== 'string' ||
          !values.displayName.trim() ||
          values.displayName.length > 255)
      )
        throw invalid('Display name is required.');
      const next = {...current, ...values};
      const doc = validateDocument(next);
      if (doc.profile.avatarUrl !== current.profile.avatarUrl)
        doc.profile.avatarUrl = await this.images.normalize(doc.profile.avatarUrl);
      const name = String(next.displayName).trim();
      if (
        name === current.displayName &&
        JSON.stringify(doc) === JSON.stringify(validateDocument(current))
      )
        return current;
      await this.snapshot(current, owner, connection);
      const result = await this.db.run(
        'UPDATE cvs SET display_name=?,profile=?,sections=?,style_settings=?,etag=?,update_time=UTC_TIMESTAMP(6) WHERE id=? AND owner_id=? AND etag=?',
        [
          name,
          JSON.stringify(keys(doc.profile, 'storage')),
          JSON.stringify(keys(doc.sections, 'storage')),
          JSON.stringify(keys(doc.styleSettings, 'storage')),
          secret().slice(0, 32),
          id,
          owner,
          etag,
        ],
        connection,
      );
      if (result.affectedRows !== 1) throw conflict();
      const cv = await this.get(id, owner, connection);
      await this.snapshot(cv, owner, connection);
      return cv;
    });
  }
  async copy(id: string, owner: string): Promise<CVResource> {
    const current = await this.get(id, owner);
    const displayName =
      current.displayName.slice(0, 251).replace(/[\uD800-\uDBFF]$/, '') + '（副本）';
    return this.create({...current, displayName}, owner);
  }
  async remove(id: string, owner: string, etag?: string): Promise<void> {
    if (!etag) throw invalid('ETag is required.');
    await this.db.transaction(async (connection) => {
      await this.get(id, owner, connection, true);
      const published = await this.db.rows(
        'SELECT owner_id FROM publications WHERE source_id=? AND owner_id=? FOR UPDATE',
        [id, owner],
        connection,
      );
      if (published.length) throw invalid('Withdraw or switch the published resume first.');
      const result = await this.db.run(
        'DELETE FROM cvs WHERE id=? AND owner_id=? AND etag=?',
        [id, owner, etag.replaceAll('"', '')],
        connection,
      );
      if (result.affectedRows !== 1) throw conflict();
      await this.db.run(
        'DELETE FROM cv_revisions WHERE cv_id=? AND owner_id=?',
        [id, owner],
        connection,
      );
    });
  }
  async revisions(id: string, owner: string): Promise<CvHistory> {
    await this.get(id, owner);
    const rows = await this.db.rows(
      'SELECT id,snapshot,created_at FROM cv_revisions WHERE cv_id=? AND owner_id=? ORDER BY created_at DESC,id',
      [id, owner],
    );
    return {
      retentionLimit: this.config.historyLimit,
      revisions: rows.map((row) => ({
        id: String(row.id),
        createTime: time(row.created_at),
        formatVersion: 1,
        document: snapshotResource(parse(row.snapshot)),
      })),
    };
  }
  async restore(
    id: string,
    revision: string,
    owner: string,
    requestId: string,
  ): Promise<CVResource> {
    await this.get(id, owner);
    const [row] = await this.db.rows(
      'SELECT snapshot FROM cv_revisions WHERE id=? AND cv_id=? AND owner_id=?',
      [revision, id, owner],
    );
    if (!row) throw notFound();
    const cv = snapshotResource(parse(row.snapshot));
    return this.create(
      {
        ...cv,
        requestId:
          digest(`${revision}:${requestId}`).slice(0, 8) +
          '-0000-4000-8000-' +
          digest(requestId).slice(0, 12),
      },
      owner,
    );
  }
  private async snapshot(cv: CVResource, owner: string, connection: PoolConnection): Promise<void> {
    const existing = await this.db.rows(
      'SELECT id FROM cv_revisions WHERE cv_id=? AND etag=?',
      [cv.id, cv.etag],
      connection,
    );
    if (existing.length) return;
    await this.db.run(
      'INSERT INTO cv_revisions(id,cv_id,owner_id,etag,snapshot,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',
      [randomUUID(), cv.id, owner, cv.etag, JSON.stringify({...cv, formatVersion: 1})],
      connection,
    );
    // Retention includes the current revision; the limit is also returned to the UI.
    const old = await this.db.rows(
      `SELECT id FROM cv_revisions WHERE cv_id=? AND owner_id=? ORDER BY created_at DESC,id LIMIT 1000 OFFSET ${this.config.historyLimit}`,
      [cv.id, owner],
      connection,
    );
    for (const row of old)
      await this.db.run(
        'DELETE FROM cv_revisions WHERE id=? AND owner_id=?',
        [String(row.id), owner],
        connection,
      );
  }
}
