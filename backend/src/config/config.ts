import {resolve} from 'node:path';
export class Config {
  readonly databaseUrl: string;
  readonly origin: string;
  readonly origins: string[];
  readonly secure: boolean;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
  readonly legacyRegistration: boolean;
  readonly githubCallback: string;
  readonly port: number;
  readonly historyLimit: number;
  readonly dataDir: string;
  readonly frontendUrl: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required. Migrations are explicit.');
    this.databaseUrl = env.DATABASE_URL.replace(/^mysql\+pymysql:/, 'mysql:');
    if (new URL(this.databaseUrl).protocol !== 'mysql:')
      throw new Error('Only MySQL is supported.');
    this.origin = new URL(env.PUBLIC_APP_ORIGIN || 'http://localhost:1234').origin;
    this.origins = [this.origin];
    this.secure = this.origin.startsWith('https:');
    this.githubClientId = env.GITHUB_CLIENT_ID || '';
    this.githubClientSecret = env.GITHUB_CLIENT_SECRET || '';
    if (Boolean(this.githubClientId) !== Boolean(this.githubClientSecret))
      throw new Error('Both GitHub credentials are required.');
    this.githubCallback = `${this.origin}/api/account/github/callback`;
    this.legacyRegistration = env.LEGACY_REGISTRATION_ENABLED === 'true';
    this.port = Number(env.PORT || '4321');
    this.dataDir = resolve(env.DATA_DIR || 'data');
    this.frontendUrl = new URL(env.FRONTEND_INTERNAL_URL || this.origin).origin;
    if (!/^https?:/.test(this.frontendUrl) || !/^https?:/.test(this.origin))
      throw new Error('HTTP(S) frontend origins are required.');
    this.historyLimit = Number(env.CV_HISTORY_LIMIT || '50');
    if (!Number.isInteger(this.historyLimit) || this.historyLimit < 1 || this.historyLimit > 500)
      throw new Error('CV_HISTORY_LIMIT must be between 1 and 500.');
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535)
      throw new Error('Invalid PORT.');
    if (env.DELETION_ENABLED === 'true')
      throw new Error(
        'Account deletion is unavailable until its lifecycle implementation is accepted.',
      );
  }
}
