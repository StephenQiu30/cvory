import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppEnv } from '../../config/env.config.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { RedisService } from '../../infra/redis/redis.service.js';
import type { MailProvider, SendOtpMailInput } from '../mail/mail.provider.js';
import type { SyncRegistryService } from '../sync/sync-registry.service.js';
import { AuthService } from './auth.service.js';

function createFakeRedis(): RedisService {
  const store = new Map<string, string>();
  const client = {
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async (...keys: string[]) => {
      for (const key of keys) {
        store.delete(key);
      }
      return keys.length;
    }),
  };
  return { client } as unknown as RedisService;
}

describe('AuthService', () => {
  const envMap: Record<string, string> = {
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-chars',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '14d',
  };

  function setup() {
    const redis = createFakeRedis();
    const sentMails: SendOtpMailInput[] = [];
    const mailProvider: MailProvider = {
      sendOtpCode: vi.fn(async (input: SendOtpMailInput) => {
        sentMails.push(input);
      }),
    };
    const prisma = {
      user: {
        upsert: vi.fn(async ({ where }: { where: { email: string } }) => ({
          id: 'user-1',
          email: where.email,
        })),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === 'user-1' ? { id: 'user-1', email: 'alice@163.com' } : null,
        ),
      },
    } as unknown as PrismaService;
    const disconnectUser = vi.fn();
    const syncRegistry = {
      disconnectUser,
    } as unknown as SyncRegistryService;
    const configService = {
      get: vi.fn((key: string) => envMap[key]),
    } as unknown as ConfigService<AppEnv, true>;

    const service = new AuthService(
      prisma,
      redis,
      new JwtService(),
      syncRegistry,
      mailProvider,
      configService,
    );

    return { service, sentMails, disconnectUser, redis };
  }

  it('sends OTP, enforces cooldown, verifies single-use code, and revokes on logout', async () => {
    const { service, sentMails, disconnectUser } = setup();

    const sendRes = await service.sendOtp('Alice@163.com');
    expect(sendRes.sent).toBe(true);
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe('alice@163.com');

    await expect(service.sendOtp('alice@163.com')).rejects.toBeInstanceOf(HttpException);

    const tokens = await service.verifyOtp('alice@163.com', sentMails[0].code);
    expect(tokens.user.id).toBe('user-1');
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    // OTP is single-use.
    await expect(service.verifyOtp('alice@163.com', sentMails[0].code)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const verifiedUser = await service.verifyAccessToken(tokens.accessToken);
    expect(verifiedUser.userId).toBe('user-1');

    // Logout blacklists token and disconnects active WS sync sockets.
    await service.logout(verifiedUser, tokens.refreshToken);
    expect(disconnectUser).toHaveBeenCalledWith('user-1');

    await expect(service.verifyAccessToken(tokens.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.refreshTokens(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
