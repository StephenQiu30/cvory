import {Injectable} from '@nestjs/common';
import {z} from 'zod';
import {Config} from '../../config/config';
import {ApiError} from '../../common/errors';

const identitySchema = z.object({
  id: z.number().int().positive().safe(),
  login: z.string().regex(/^[a-z\d](?:[a-z\d-]{0,38})$/i),
  name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
});
const repositorySchema = z.object({
  id: z.number().int().positive().safe(),
  name: z.string().max(100),
  full_name: z.string().max(200),
  html_url: z.string().url(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number().int(),
  updated_at: z.string(),
  private: z.boolean(),
  fork: z.boolean(),
  owner: z.object({id: z.number().int().positive().safe()}),
});

@Injectable()
export class GithubClient {
  constructor(private readonly config: Config) {}

  private async json(url: string, init: RequestInit = {}, missingIsNull = false): Promise<unknown> {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'cvory-self-hosted',
          ...init.headers,
        },
      });
      if (missingIsNull && response.status === 404) return null;
      if (!response.ok) throw new Error('Provider request failed.');
      // Bound responses before JSON parsing, including chunked bodies.
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing response.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2097152) throw new Error('Response too large.');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        'UNAVAILABLE',
        'GITHUB_UNAVAILABLE',
        'GitHub is unavailable. Restart authorization.',
      );
    }
  }

  async identity(code: string, verifier: string) {
    const result = await this.json('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({
        client_id: this.config.githubClientId,
        client_secret: this.config.githubClientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: this.config.githubCallback,
      }),
    });
    const token = z.object({access_token: z.string().min(1).max(1000)}).safeParse(result);
    if (!token.success)
      throw new ApiError(
        400,
        'INVALID_ARGUMENT',
        'GITHUB_AUTH_FAILED',
        'GitHub authorization failed. Restart authorization.',
      );
    const profile = identitySchema.safeParse(
      await this.json('https://api.github.com/user', {
        headers: {Authorization: `Bearer ${token.data.access_token}`},
      }),
    );
    if (!profile.success) throw new ApiError(503, 'UNAVAILABLE', 'GITHUB_INVALID_RESPONSE');
    const user = profile.data;
    return {
      id: String(user.id),
      login: user.login,
      displayName: (user.name || user.login).slice(0, 80),
      avatar:
        user.avatar_url &&
        new URL(user.avatar_url).origin === 'https://avatars.githubusercontent.com'
          ? user.avatar_url
          : null,
    };
  }

  async repositories(login: string, owner: string, page: number) {
    const data = z
      .array(repositorySchema)
      .max(30)
      .safeParse(
        await this.json(
          `https://api.github.com/users/${encodeURIComponent(login)}/repos?type=owner&sort=updated&per_page=30&page=${page}`,
        ),
      );
    if (!data.success) throw new ApiError(503, 'UNAVAILABLE', 'GITHUB_INVALID_RESPONSE');
    return {
      repositories: data.data
        .filter(
          (repo) =>
            !repo.private &&
            String(repo.owner.id) === owner &&
            new URL(repo.html_url).origin === 'https://github.com',
        )
        .map((repo) => this.repositoryResource(repo)),
      nextPageToken: data.data.length === 30 ? String(page + 1) : '',
    };
  }

  async repositoryById(id: string, expectedOwner: string) {
    if (!/^\d{1,20}$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1)
      throw new ApiError(400, 'INVALID_ARGUMENT', 'GITHUB_REPOSITORY_NOT_AVAILABLE');
    const raw = await this.json(`https://api.github.com/repositories/${id}`, {}, true);
    if (raw === null)
      throw new ApiError(409, 'FAILED_PRECONDITION', 'GITHUB_REPOSITORY_NOT_AVAILABLE');
    const repository = repositorySchema.safeParse(raw);
    if (!repository.success) throw new ApiError(503, 'UNAVAILABLE', 'GITHUB_INVALID_RESPONSE');
    if (
      repository.data.private ||
      String(repository.data.owner.id) !== expectedOwner ||
      new URL(repository.data.html_url).origin !== 'https://github.com'
    )
      throw new ApiError(409, 'FAILED_PRECONDITION', 'GITHUB_REPOSITORY_NOT_AVAILABLE');
    return this.repositoryResource(repository.data);
  }

  private repositoryResource(repository: z.infer<typeof repositorySchema>) {
    return {
      id: String(repository.id),
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      description: repository.description?.slice(0, 500) ?? null,
      language: repository.language?.slice(0, 100) ?? null,
      stars: repository.stargazers_count,
      fork: repository.fork,
      updateTime: repository.updated_at,
    };
  }
}
