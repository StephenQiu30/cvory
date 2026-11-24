import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getJwtBlacklistKey } from '../../common/guards/jwt-auth.guard.js';
import { redactEmail } from '../../common/logger/redacted-logger.js';
import type { AuthenticatedUser, JwtTokenPayload } from '../../common/types/auth.types.js';
import type { AppEnv } from '../../config/env.config.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { MAIL_PROVIDER, type MailProvider } from '../mail/mail.provider.js';
import { SyncRegistryService } from '../sync/sync-registry.service.js';
import type {
  AuthTokensResponseDto,
  AuthUserDto,
  SendOtpResponseDto,
} from './auth.dto.js';

const OTP_TTL_SECONDS = 600;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_HOURLY_WINDOW_SECONDS = 3600;
const OTP_HOURLY_MAX_SENDS = 10;
const OTP_IP_HOURLY_MAX_SENDS = 20;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

function parseDurationToSeconds(rawDuration: string, fallbackSeconds: number): number {
  const match = /^(\d+)([smhd])$/.exec(rawDuration.trim());
  if (!match) {
    return fallbackSeconds;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') {
    return amount;
  }
  if (unit === 'm') {
    return amount * 60;
  }
  if (unit === 'h') {
    return amount * 3600;
  }
  return amount * 86400;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresSeconds: number;
  private readonly refreshExpiresSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly syncRegistry: SyncRegistryService,
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
    configService: ConfigService<AppEnv, true>,
  ) {
    this.accessSecret = configService.get('JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = configService.get('JWT_REFRESH_SECRET', { infer: true });
    this.accessExpiresSeconds = parseDurationToSeconds(
      configService.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
      900,
    );
    this.refreshExpiresSeconds = parseDurationToSeconds(
      configService.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
      14 * 86400,
    );
  }

  async sendOtp(rawEmail: string, clientIp?: string): Promise<SendOtpResponseDto> {
    const email = this.normalizeEmail(rawEmail);
    const cooldownKey = `cvory:otp:cooldown:${email}`;
    const hourlyKey = `cvory:otp:hourly:${email}`;

    const inCooldown = await this.redis.client.exists(cooldownKey);
    if (inCooldown === 1) {
      throw new HttpException('发送过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (clientIp && clientIp.trim().length > 0) {
      const ipKey = `cvory:otp:ip:${clientIp.trim()}`;
      const ipCount = await this.redis.client.incr(ipKey);
      if (ipCount === 1) {
        await this.redis.client.expire(ipKey, OTP_HOURLY_WINDOW_SECONDS);
      }
      if (ipCount > OTP_IP_HOURLY_MAX_SENDS) {
        throw new HttpException(
          '当前网络请求次数已达上限，请一小时后再试',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const hourlyCount = await this.redis.client.incr(hourlyKey);
    if (hourlyCount === 1) {
      await this.redis.client.expire(hourlyKey, OTP_HOURLY_WINDOW_SECONDS);
    }
    if (hourlyCount > OTP_HOURLY_MAX_SENDS) {
      throw new HttpException('当前邮箱请求次数已达上限，请一小时后再试', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(100000, 1000000));
    const codeHash = this.hashOtp(email, code);

    const codeKey = `cvory:otp:code:${email}`;
    const attemptsKey = `cvory:otp:attempts:${email}`;

    await this.redis.client.set(codeKey, codeHash, 'EX', OTP_TTL_SECONDS);
    await this.redis.client.del(attemptsKey);
    await this.redis.client.set(cooldownKey, '1', 'EX', OTP_COOLDOWN_SECONDS);

    await this.mailProvider.sendOtpCode({
      to: email,
      code,
      expiresInMinutes: Math.floor(OTP_TTL_SECONDS / 60),
    });

    return {
      sent: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      retryAfterSeconds: OTP_COOLDOWN_SECONDS,
    };
  }

  async verifyOtp(rawEmail: string, code: string): Promise<AuthTokensResponseDto> {
    const email = this.normalizeEmail(rawEmail);
    const codeKey = `cvory:otp:code:${email}`;
    const attemptsKey = `cvory:otp:attempts:${email}`;

    const storedHash = await this.redis.client.get(codeKey);
    if (!storedHash) {
      throw new BadRequestException('验证码已过期或不存在，请重新获取');
    }

    const candidateHash = this.hashOtp(email, code.trim());
    const storedBuf = Buffer.from(storedHash, 'hex');
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const isMatch =
      storedBuf.length === candidateBuf.length && timingSafeEqual(storedBuf, candidateBuf);

    if (!isMatch) {
      const attempts = await this.redis.client.incr(attemptsKey);
      if (attempts === 1) {
        await this.redis.client.expire(attemptsKey, OTP_TTL_SECONDS);
      }
      if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
        await this.redis.client.del(codeKey, attemptsKey);
        throw new BadRequestException('验证码错误次数过多，请重新获取');
      }
      throw new BadRequestException('验证码不正确，请重新输入');
    }

    // Single-use OTP: delete immediately upon verification.
    await this.redis.client.del(codeKey, attemptsKey);

    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        lastLoginAt: new Date(),
      },
      update: {
        lastLoginAt: new Date(),
      },
    });

    this.logger.log(`User authenticated: ${redactEmail(email)}`);
    return this.issueTokenPair({ id: user.id, email: user.email });
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokensResponseDto> {
    let payload: JwtTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('无效或已过期的刷新令牌');
    }

    if (payload.type !== 'refresh' || !payload.jti || !payload.sub) {
      throw new UnauthorizedException('刷新令牌格式无效');
    }

    const isRevoked = await this.redis.client.exists(getJwtBlacklistKey(payload.jti));
    if (isRevoked === 1) {
      throw new UnauthorizedException('刷新令牌已失效，请重新验证邮箱');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    await this.blacklistJti(payload.jti, payload.exp);
    return this.issueTokenPair({ id: user.id, email: user.email });
  }

  async logout(user: AuthenticatedUser, refreshToken?: string): Promise<void> {
    await this.blacklistJti(user.jti, user.exp);

    if (refreshToken) {
      try {
        const refreshPayload = await this.jwtService.verifyAsync<JwtTokenPayload>(refreshToken, {
          secret: this.refreshSecret,
        });
        if (refreshPayload.type === 'refresh' && refreshPayload.jti) {
          await this.blacklistJti(refreshPayload.jti, refreshPayload.exp);
        }
      } catch {
        // Ignore expired or malformed optional refresh token during logout.
      }
    }

    // Immediately terminate active WebSocket sync sessions for this account (AC-CV-07).
    this.syncRegistry.disconnectUser(user.userId);
    this.logger.log(`User logged out: ${redactEmail(user.email)}`);
  }

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    let payload: JwtTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(accessToken, {
        secret: this.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.type !== 'access' || !payload.jti || !payload.sub) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const isRevoked = await this.redis.client.exists(getJwtBlacklistKey(payload.jti));
    if (isRevoked === 1) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      jti: payload.jti,
      exp: payload.exp ?? 0,
    };
  }

  private async issueTokenPair(user: AuthUserDto): Promise<AuthTokensResponseDto> {
    const accessPayload: JwtTokenPayload = {
      sub: user.id,
      email: user.email,
      jti: randomUUID(),
      type: 'access',
    };
    const refreshPayload: JwtTokenPayload = {
      sub: user.id,
      email: user.email,
      jti: randomUUID(),
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresSeconds,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.accessExpiresSeconds,
      user,
    };
  }

  private async blacklistJti(jti: string, exp?: number): Promise<void> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const remainingTtl = exp ? Math.max(exp - nowSeconds, 1) : this.accessExpiresSeconds;
    await this.redis.client.set(getJwtBlacklistKey(jti), '1', 'EX', remainingTtl);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashOtp(email: string, code: string): string {
    return createHash('sha256')
      .update(`${email}:${code}:${this.accessSecret}`)
      .digest('hex');
  }
}
