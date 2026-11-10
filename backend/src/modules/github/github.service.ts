import {Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Config} from '../../config/config';
import {Database} from '../../database/database';
import {AccountService} from '../account/account.service';
import {digest, safeReturnPath, secret} from '../../common/credentials';
import {ApiError, invalid, unauthenticated} from '../../common/errors';
import {GithubClient} from './github_client';
import {GithubFeaturedProjects, SaveGithubFeaturedProjects} from './github.dto';

const repositoryResourceSchema = z.object({
  id: z.string().regex(/^\d{1,20}$/),
  name: z.string().max(100),
  fullName: z.string().max(200),
  url: z
    .string()
    .url()
    .refine((value) => new URL(value).origin === 'https://github.com'),
  description: z.string().max(500).nullable(),
  language: z.string().max(100).nullable(),
  stars: z.number().int().nonnegative().safe(),
  fork: z.boolean(),
  updateTime: z.string().max(40),
});

function parse(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

@Injectable()
export class GithubService {
  constructor(
    private readonly config: Config,
    private readonly db: Database,
    private readonly accounts: AccountService,
    private readonly client: GithubClient,
  ) {}

  async begin(path: string, address: string, session?: string) {
    if (!this.config.githubClientId)
      throw new ApiError(
        503,
        'UNAVAILABLE',
        'GITHUB_NOT_CONFIGURED',
        'GitHub login is not configured.',
      );
    const owner = session === undefined ? null : await this.accounts.authenticate(session);
    await this.accounts.limit(address, `github:${address}`);
    const state = secret(),
      browser = secret(),
      verifier = secret();
    await this.db.run('DELETE FROM oauth_challenges WHERE expires_at<=UTC_TIMESTAMP(6)');
    await this.db.run(
      'INSERT INTO oauth_challenges VALUES (?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 10 MINUTE))',
      [
        digest(state),
        digest(browser),
        verifier,
        safeReturnPath(path),
        owner,
        session === undefined ? null : digest(session),
      ],
    );
    const authorization = new URL('https://github.com/login/oauth/authorize');
    authorization.search = new URLSearchParams({
      client_id: this.config.githubClientId,
      redirect_uri: this.config.githubCallback,
      scope: 'read:user',
      state,
      code_challenge: Buffer.from(digest(verifier), 'hex').toString('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return {browser, url: authorization.toString()};
  }

  async complete(state: string, browser: string, code: string, session: string) {
    if (
      !this.config.githubClientId ||
      typeof state !== 'string' ||
      !state ||
      !browser ||
      state.length > 128 ||
      browser.length > 128
    )
      throw invalid('Invalid OAuth state. Restart authorization.');
    const challenge = await this.db.transaction(async (connection) => {
      const [row] = await this.db.rows(
        'SELECT * FROM oauth_challenges WHERE state_hash=? AND browser_hash=? AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE',
        [digest(state), digest(browser)],
        connection,
      );
      if (!row) throw invalid('OAuth state is invalid, expired or already consumed.');
      await this.db.run(
        'DELETE FROM oauth_challenges WHERE state_hash=?',
        [digest(state)],
        connection,
      );
      return row;
    });
    if (
      challenge.owner_id !== null &&
      (digest(session) !== challenge.session_hash ||
        (await this.accounts.authenticate(session)) !== challenge.owner_id)
    )
      throw unauthenticated();
    if (typeof code !== 'string' || !code || code.length > 1000)
      throw invalid('GitHub authorization was cancelled.');
    const identity = await this.client.identity(code, String(challenge.verifier));
    let owner: string;
    try {
      owner = await this.db.transaction(async (connection) => {
        const [existing] = await this.db.rows(
          'SELECT owner_id FROM account_identities WHERE provider=? AND provider_user_id=? FOR UPDATE',
          ['github', identity.id],
          connection,
        );
        if (existing && challenge.owner_id !== null && existing.owner_id !== challenge.owner_id)
          throw new ApiError(
            409,
            'ALREADY_EXISTS',
            'GITHUB_IDENTITY_IN_USE',
            'This GitHub identity belongs to another account.',
          );
        const target =
          challenge.owner_id !== null
            ? String(challenge.owner_id)
            : existing
              ? String(existing.owner_id)
              : randomUUID();
        if (!existing && challenge.owner_id === null)
          await this.db.run(
            'INSERT INTO accounts(id,email,password_hash,display_name,avatar,public_id,status) VALUES (?,NULL,NULL,?,?,?,?)',
            [target, identity.displayName, identity.avatar, secret().slice(0, 16), 'active'],
            connection,
          );
        const account = await this.accounts.resource(target, connection);
        if (!existing && account.githubConnected)
          throw new ApiError(
            409,
            'ALREADY_EXISTS',
            'GITHUB_ALREADY_LINKED',
            'This account is already linked to GitHub.',
          );
        if (existing)
          await this.db.run(
            'UPDATE account_identities SET login=? WHERE provider=? AND provider_user_id=?',
            [identity.login, 'github', identity.id],
            connection,
          );
        else
          await this.db.run(
            'INSERT INTO account_identities VALUES (?,?,?,?)',
            ['github', identity.id, target, identity.login],
            connection,
          );
        return target;
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY')
        throw new ApiError(
          409,
          'ALREADY_EXISTS',
          'GITHUB_IDENTITY_IN_USE',
          'GitHub identity linking conflicted. Restart authorization.',
        );
      throw error;
    }
    return {
      token: await this.accounts.session(owner),
      path: safeReturnPath(String(challenge.return_path)),
    };
  }

  async repositories(owner: string, token: string) {
    const page = token ? Number(token) : 1;
    if (!Number.isInteger(page) || page < 1 || page > 1000 || (token && String(page) !== token))
      throw invalid('Invalid page token.');
    const [identity] = await this.db.rows(
      'SELECT provider_user_id,login FROM account_identities WHERE owner_id=? AND provider=?',
      [owner, 'github'],
    );
    if (!identity) throw new ApiError(409, 'FAILED_PRECONDITION', 'GITHUB_NOT_LINKED');
    return {
      ...(await this.client.repositories(
        String(identity.login),
        String(identity.provider_user_id),
        page,
      )),
      syncTime: new Date().toISOString(),
    };
  }

  async featuredProjects(owner: string): Promise<GithubFeaturedProjects> {
    const rows = await this.db.rows(
      'SELECT repository_id,repository,contribution,display_order FROM github_featured_projects WHERE owner_id=? ORDER BY display_order,repository_id',
      [owner],
    );
    return {
      projects: rows.map((row) => ({
        ...repositoryResourceSchema.parse({
          ...(parse(row.repository) as Record<string, unknown>),
          id: String(row.repository_id),
        }),
        repositoryId: String(row.repository_id),
        contribution: String(row.contribution),
        displayOrder: Number(row.display_order),
      })),
    };
  }

  async saveFeaturedProjects(
    owner: string,
    input: SaveGithubFeaturedProjects,
  ): Promise<GithubFeaturedProjects> {
    const [identity] = await this.db.rows(
      'SELECT provider_user_id FROM account_identities WHERE owner_id=? AND provider=?',
      [owner, 'github'],
    );
    if (!identity) throw new ApiError(409, 'FAILED_PRECONDITION', 'GITHUB_NOT_LINKED');
    const projects = await Promise.all(
      input.projects.map(async (selected, displayOrder) => {
        const repository = await this.client.repositoryById(
          selected.repositoryId,
          String(identity.provider_user_id),
        );
        return {
          ...repository,
          repositoryId: repository.id,
          contribution: selected.contribution,
          displayOrder,
        };
      }),
    );
    await this.db.transaction(async (tx) => {
      await this.accounts.resource(owner, tx);
      const [currentIdentity] = await this.db.rows(
        'SELECT provider_user_id FROM account_identities WHERE owner_id=? AND provider=? FOR UPDATE',
        [owner, 'github'],
        tx,
      );
      if (
        !currentIdentity ||
        String(currentIdentity.provider_user_id) !== String(identity.provider_user_id)
      )
        throw new ApiError(409, 'FAILED_PRECONDITION', 'GITHUB_NOT_LINKED');
      await this.db.run('DELETE FROM github_featured_projects WHERE owner_id=?', [owner], tx);
      for (const project of projects) {
        const repository = {
          name: project.name,
          fullName: project.fullName,
          url: project.url,
          description: project.description,
          language: project.language,
          stars: project.stars,
          fork: project.fork,
          updateTime: project.updateTime,
        };
        await this.db.run(
          'INSERT INTO github_featured_projects(owner_id,repository_id,repository,contribution,display_order,update_time) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',
          [
            owner,
            project.repositoryId,
            JSON.stringify(repository),
            project.contribution,
            project.displayOrder,
          ],
          tx,
        );
      }
    });
    return {projects};
  }

  async connection(owner: string) {
    const [row] = await this.db.rows(
      'SELECT login FROM account_identities WHERE owner_id=? AND provider=?',
      [owner, 'github'],
    );
    return {connected: Boolean(row), login: row ? String(row.login) : ''};
  }
}
