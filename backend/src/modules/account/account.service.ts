import {Injectable} from '@nestjs/common';
import {randomBytes, randomUUID, scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {Database, Connection} from '../../database/database';
import {ApiError, unauthenticated} from '../../common/errors';
import {digest, secret, verifyPassword} from '../../common/credentials';
import {ImageService} from '../files/image.service';
import {invalid} from '../../common/errors';
import {AccountResource, AccountUpdate, Credentials, ChangePasswordRequest} from './account.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly db: Database,
    private readonly images: ImageService,
  ) {}

  async resource(owner: string, connection?: Connection): Promise<AccountResource> {
    const [row] = await this.db.rows(
      'SELECT a.*, EXISTS(SELECT 1 FROM account_identities i WHERE i.owner_id=a.id AND i.provider=?) AS github_connected FROM accounts a WHERE a.id=?',
      ['github', owner],
      connection,
    );
    if (!row || row.status !== 'active') throw unauthenticated();
    return {
      id: String(row.id),
      email: row.email === null ? null : String(row.email),
      displayName: String(row.display_name),
      avatar: row.avatar === null ? null : String(row.avatar),
      publicId: String(row.public_id),
      emailVerified: Boolean(row.email_verified_at),
      githubConnected: Boolean(row.github_connected),
    };
  }

  async authenticate(token: string): Promise<string> {
    const [row] = await this.db.rows(
      'SELECT s.owner_id FROM account_sessions s JOIN accounts a ON a.id=s.owner_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(6) AND a.status=?',
      [digest(token), 'active'],
    );
    if (!row) throw unauthenticated();
    return String(row.owner_id);
  }

  async session(owner: string): Promise<string> {
    const token = secret();
    await this.db.run(
      'INSERT INTO account_sessions(token_hash,owner_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY))',
      [digest(token), owner],
    );
    return token;
  }

  async limit(address: string, identity: string): Promise<void> {
    // Separate address and identity windows, shared across all Node processes.
    await this.db.transaction(async (connection) => {
      for (const dimension of [`address:${address}`, `identity:${identity}`]) {
        const key = digest(dimension);
        await this.db.run(
          'INSERT INTO nest_auth_attempts (`key`,count,expires_at) VALUES (?,1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE count=IF(expires_at<=UTC_TIMESTAMP(6),1,count+1), expires_at=IF(expires_at<=UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE),expires_at)',
          [key],
          connection,
        );
        const [row] = await this.db.rows(
          'SELECT count FROM nest_auth_attempts WHERE `key`=?',
          [key],
          connection,
        );
        if (Number(row.count) > 40)
          throw new ApiError(429, 'RESOURCE_EXHAUSTED', 'AUTH_RATE_LIMITED');
      }
    });
  }

  async login(payload: Credentials, address: string): Promise<string> {
    await this.limit(address, payload.email);
    const [row] = await this.db.rows('SELECT id,password_hash,status FROM accounts WHERE email=?', [
      payload.email,
    ]);
    const valid = await verifyPassword(
      payload.password,
      row?.password_hash ? String(row.password_hash) : null,
    );
    if (!valid || !row || row.status !== 'active') throw unauthenticated();
    return String(row.id);
  }

  async update(owner: string, payload: AccountUpdate): Promise<AccountResource> {
    if (!payload.displayName.trim()) throw invalid('Display name is required.');
    const current = await this.resource(owner);
    const avatar =
      payload.avatar === undefined
        ? current.avatar
        : payload.avatar === current.avatar
          ? current.avatar
          : await this.images.normalize(payload.avatar);
    await this.db.run('UPDATE accounts SET display_name=?,avatar=? WHERE id=? AND status=?', [
      payload.displayName.trim(),
      avatar,
      owner,
      'active',
    ]);
    return this.resource(owner);
  }
  async changePassword(
    owner: string,
    payload: ChangePasswordRequest,
    token: string,
    address: string,
  ): Promise<AccountResource> {
    await this.limit(address, `password:${owner}`);
    await this.db.transaction(async (connection) => {
      const [row] = await this.db.rows(
        'SELECT password_hash FROM accounts WHERE id=? AND status=? FOR UPDATE',
        [owner, 'active'],
        connection,
      );
      if (
        !row ||
        !(await verifyPassword(
          payload.password,
          typeof row.password_hash === 'string' ? row.password_hash : null,
        ))
      )
        throw unauthenticated();
      const salt = randomBytes(16);
      const hash = (await promisify(scrypt)(payload.newPassword, salt, 64)) as Buffer;
      await this.db.run(
        'UPDATE accounts SET password_hash=? WHERE id=?',
        [`${salt.toString('hex')}:${hash.toString('hex')}`, owner],
        connection,
      );
      await this.db.run(
        'DELETE FROM account_sessions WHERE owner_id=? AND token_hash<>?',
        [owner, digest(token)],
        connection,
      );
      await this.db.run(
        "UPDATE account_action_tokens SET consumed_at=UTC_TIMESTAMP() WHERE owner_id=? AND purpose='reset_password' AND consumed_at IS NULL",
        [owner],
        connection,
      );
    });
    return this.resource(owner);
  }
  async register(payload: Credentials, address: string): Promise<string> {
    await this.limit(address, payload.email);
    const owner = randomUUID();
    const salt = randomBytes(16);
    const hash = (await promisify(scrypt)(payload.password, salt, 64)) as Buffer;
    try {
      await this.db.run(
        'INSERT INTO accounts(id,email,password_hash,display_name,public_id,status) VALUES (?,?,?,?,?,?)',
        [
          owner,
          payload.email,
          `${salt.toString('hex')}:${hash.toString('hex')}`,
          payload.displayName?.trim() || payload.email.split('@')[0],
          secret().slice(0, 16),
          'active',
        ],
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY')
        throw new ApiError(409, 'ALREADY_EXISTS', 'ACCOUNT_EXISTS');
      throw error;
    }
    return owner;
  }
}
