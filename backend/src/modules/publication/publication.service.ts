import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {PoolConnection} from 'mysql2/promise';
import {Database, Row} from '../../database/database';
import {AccountService} from '../account/account.service';
import {CvsService} from '../cvs/cvs.service';
import {Document, profileSchema, validateDocument} from '../cvs/document';
import {ApiError, conflict, invalid, notFound} from '../../common/errors';
import {
  PUBLIC_FIELDS,
  PublicationReview,
  PublicationStatus,
  PublicSelection,
  ResumeDocument,
} from './publication.dto';
const parse = (value: unknown): unknown => (typeof value === 'string' ? JSON.parse(value) : value);
function hasText(value: unknown): boolean {
  if (typeof value === 'string') return Boolean(value.trim());
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  return (
    (typeof node.text === 'string' && Boolean(node.text.trim())) ||
    (Array.isArray(node.content) && node.content.some(hasText))
  );
}
@Injectable()
export class PublicationService {
  constructor(
    private readonly db: Database,
    private readonly accounts: AccountService,
    private readonly cvs: CvsService,
  ) {}
  private async ownerLock(owner: string, tx: PoolConnection): Promise<Row> {
    const [row] = await this.db.rows(
      'SELECT id FROM accounts WHERE id=? AND status=? FOR UPDATE',
      [owner, 'active'],
      tx,
    );
    if (!row) throw notFound();
    await this.db.run(
      'INSERT IGNORE INTO publication_heads(owner_id,revision) VALUES (?,0)',
      [owner],
      tx,
    );
    const [head] = await this.db.rows(
      'SELECT revision FROM publication_heads WHERE owner_id=? FOR UPDATE',
      [owner],
      tx,
    );
    return head;
  }
  async status(owner: string): Promise<PublicationStatus> {
    const account = await this.accounts.resource(owner);
    const [row] = await this.db.rows(
      'SELECT p.source_name,p.update_time,h.revision FROM publication_heads h LEFT JOIN publications p ON p.owner_id=h.owner_id WHERE h.owner_id=?',
      [owner],
    );
    const [legacy] = row
      ? []
      : await this.db.rows('SELECT source_name,update_time FROM publications WHERE owner_id=?', [
          owner,
        ]);
    const publication = row?.source_name !== null && row?.source_name !== undefined ? row : legacy;
    return {
      published: Boolean(publication),
      sourceName: publication ? String(publication.source_name) : '',
      updateTime: publication
        ? new Date(String(publication.update_time).replace(' ', 'T') + 'Z').toISOString()
        : '',
      publicId: account.publicId,
      etag: String(row?.revision || 0),
    };
  }
  async preview(owner: string, selection: PublicSelection): Promise<PublicationReview> {
    return this.db.transaction(async (tx) => {
      const head = await this.ownerLock(owner, tx),
        cv = await this.cvs.get(selection.sourceId, owner, tx, true);
      if (cv.etag !== selection.etag) throw conflict();
      if (!cv.profile.fullName.trim()) throw invalid('Resume name is required for publication.');
      const profile: Record<string, unknown> = {
        fullName: cv.profile.fullName,
        headline: cv.profile.headline,
      };
      const allowed = selection.fields.filter((key) => !cv.profile.hiddenFields.includes(key));
      for (const key of PUBLIC_FIELDS)
        if (key !== 'avatarUrl' && allowed.includes(key))
          profile[key] = cv.profile[key as keyof Document['profile']];
      if (
        allowed.includes('avatarUrl') &&
        !cv.profile.photoHidden &&
        cv.profile.avatarUrl?.startsWith('data:image/')
      )
        for (const key of ['avatarUrl', 'photoPosition', 'photoX', 'photoY', 'photoScale'] as const)
          profile[key] = cv.profile[key];
      const sections = cv.sections
        .filter((section) => selection.sectionIds.includes(section.id) && section.visible)
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => item.title.trim() || item.subtitle.trim() || hasText(item.description),
          ),
        }))
        .filter((section) => section.items.length || hasText(section.content));
      const document = validateDocument({
        profile: profileSchema.parse(profile),
        sections,
        styleSettings: cv.styleSettings,
      });
      const id = randomUUID();
      await this.db.run(
        'DELETE FROM publication_reviews WHERE owner_id=? AND expires_at<=UTC_TIMESTAMP()',
        [owner],
        tx,
      );
      await this.db.run(
        'INSERT INTO publication_reviews(id,owner_id,source_id,source_name,document,expires_at,source_etag,base_version) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE),?,?)',
        [
          id,
          owner,
          cv.id,
          cv.displayName,
          JSON.stringify(document),
          cv.etag,
          Number(head.revision),
        ],
        tx,
      );
      return {id, sourceName: cv.displayName, document};
    });
  }
  async publish(owner: string, reviewId: string): Promise<PublicationStatus> {
    await this.db.transaction(async (tx) => {
      const head = await this.ownerLock(owner, tx);
      const account = await this.accounts.resource(owner, tx);
      if (!account.emailVerified && !account.githubConnected)
        throw new ApiError(403, 'PERMISSION_DENIED', 'VERIFIED_IDENTITY_REQUIRED');
      const [review] = await this.db.rows(
        'SELECT * FROM publication_reviews WHERE id=? AND owner_id=? AND expires_at>UTC_TIMESTAMP()',
        [reviewId, owner],
        tx,
      );
      if (!review) throw notFound();
      if (review.base_version === null || Number(review.base_version) !== Number(head.revision))
        throw conflict();
      const cv = await this.cvs.get(String(review.source_id), owner, tx, true);
      if (cv.etag !== review.source_etag) throw conflict();
      const document = validateDocument(parse(review.document));
      await this.db.run(
        'INSERT INTO publications(owner_id,source_id,source_name,document,update_time) VALUES (?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE source_id=VALUES(source_id),source_name=VALUES(source_name),document=VALUES(document),update_time=UTC_TIMESTAMP()',
        [owner, cv.id, String(review.source_name), JSON.stringify(document)],
        tx,
      );
      await this.db.run(
        'UPDATE publication_heads SET revision=revision+1 WHERE owner_id=?',
        [owner],
        tx,
      );
      await this.db.run(
        'DELETE FROM publication_reviews WHERE id=? AND owner_id=?',
        [reviewId, owner],
        tx,
      );
    });
    return this.status(owner);
  }
  async withdraw(owner: string, etag: string): Promise<void> {
    if (!/^\d+$/.test(etag)) throw invalid('Publication etag is required.');
    await this.db.transaction(async (tx) => {
      const head = await this.ownerLock(owner, tx);
      if (String(head.revision) !== etag) throw conflict();
      await this.db.run('DELETE FROM publications WHERE owner_id=?', [owner], tx);
      await this.db.run(
        'UPDATE publication_heads SET revision=revision+1 WHERE owner_id=?',
        [owner],
        tx,
      );
    });
  }
  async publicResume(publicId: string): Promise<ResumeDocument> {
    const [row] = await this.db.rows(
      'SELECT p.document FROM publications p JOIN accounts a ON a.id=p.owner_id WHERE a.public_id=? AND a.status=?',
      [publicId, 'active'],
    );
    if (!row) throw notFound();
    return validateDocument(parse(row.document));
  }
}
