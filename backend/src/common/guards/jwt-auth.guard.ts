import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AppEnv } from '../../config/env.config.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import type { AuthenticatedUser, JwtTokenPayload } from '../types/auth.types.js';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function getJwtBlacklistKey(jti: string): string {
  return `cvory:jwt:blacklist:${jti}`;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    configService: ConfigService<AppEnv, true>,
  ) {
    this.accessSecret = configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Empty bearer token');
    }

    let payload: JwtTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
        secret: this.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.type !== 'access' || !payload.jti || !payload.sub) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const isRevoked = await this.redisService.client.exists(getJwtBlacklistKey(payload.jti));
    if (isRevoked === 1) {
      throw new UnauthorizedException('Token has been revoked');
    }

    request.user = {
      userId: payload.sub,
      email: payload.email,
      jti: payload.jti,
      exp: payload.exp ?? 0,
    };
    return true;
  }
}
