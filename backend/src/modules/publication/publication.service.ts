import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {PoolConnection} from 'mysql2/promise';
import {Database, Row} from '../../database/database';
import {AccountService} from '../account/account.service';
import {CvsService} from '../cvs/cvs.service';
import {GithubClient} from '../github/github_client';
import {Document, profileSchema, validateDocument} from '../cvs/document';
import {ApiError, conflict, invalid, notFound} from '../../common/errors';
import {z} from 'zod';
import {
  PUBLIC_FIELDS,
  PublicationReview,
  PublicationStatus,
  PublicGithubProject,
  PublicSelection,
  ResumeDocument,
} from './publication.dto';
const parse = (value: unknown): unknown => (typeof value === 'string' ? JSON.parse(value) : value);
const publicProjectSchema = z.strictObject({
  repositoryId: z.string().regex(/^\d{1,20}$/),
  name: z.string().min(1).max(100),
  fullName: z.string().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((value) => new URL(value).origin === 'https://github.com'),
  description: z.string().max(500).nullable(),
  language: z.string().max(100).nullable(),
  stars: z.number().int().nonnegative().safe(),
  fork: z.boolean(),
  updateTime: z.string().max(40),
  contribution: z.string().max(2000),
});
const publicProjectsSchema = z.array(publicProjectSchema).max(12);

function validatePublishedDocument(value: unknown): ResumeDocument {
  const source = parse(value);
  if (!source || typeof source !== 'object' || Array.isArray(source))
    throw invalid('Invalid public resume snapshot.');
  const record = source as Record<string, unknown>;
  const document = validateDocument(record);
  const projects = publicProjectsSchema.safeParse(record.projects ?? []);
  if (!projects.success) throw invalid('Invalid public project snapshot.');
  return {...document, projects: projects.data as PublicGithubProject[]};
}

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
    private readonly github: GithubClient,
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
      const projectRows = await this.db.rows(
        'SELECT repository_id,contribution FROM github_featured_projects WHERE owner_id=? ORDER BY display_order,repository_id',
        [owner],
        tx,
      );
      const projects: PublicGithubProject[] = [];
      if (projectRows.length) {
        const [identity] = await this.db.rows(
          'SELECT provider_user_id FROM account_identities WHERE owner_id=? AND provider=?',
          [owner, 'github'],
          tx,
        );
        if (!identity) throw invalid('GitHub connection is required for projects.');
        projects.push(
          ...(await Promise.all(
            projectRows.map(async (row) => {
              const repository = await this.github.repositoryById(
                String(row.repository_id),
                String(identity.provider_user_id),
              );
              const parsed = publicProjectSchema.safeParse({
                repositoryId: String(row.repository_id),
                name: repository.name,
                fullName: repository.fullName,
                url: repository.url,
                description: repository.description,
                language: repository.language,
                stars: repository.stars,
                fork: repository.fork,
                updateTime: repository.updateTime,
                contribution: String(row.contribution),
              });
              if (!parsed.success) throw invalid('Invalid featured project.');
              return parsed.data;
            }),
          )),
        );
      }
      const publishedDocument = validatePublishedDocument({...document, projects});
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
          JSON.stringify(publishedDocument),
          cv.etag,
          Number(head.revision),
        ],
        tx,
      );
      return {id, sourceName: cv.displayName, document: publishedDocument};
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
      const document = validatePublishedDocument(review.document);
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
    return validatePublishedDocument(row.document);
  }
}
