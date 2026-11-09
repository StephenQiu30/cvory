import {CanActivate, ExecutionContext, Injectable, SetMetadata} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {Request} from 'express';
import {Config} from '../config/config';
import {AccountService} from '../modules/account/account.service';
import {ApiError} from './errors';

export const Public = () => SetMetadata('public', true);
export interface OwnerRequest extends Request {
  owner: string;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly accounts: AccountService,
    private readonly config: Config,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OwnerRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (
        (origin && !this.config.origins.includes(origin)) ||
        request.headers['sec-fetch-site'] === 'cross-site'
      )
        throw new ApiError(403, 'PERMISSION_DENIED', 'UNTRUSTED_ORIGIN');
    }
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()]))
      return true;
    request.owner = await this.accounts.authenticate(String(request.cookies?.cvory_session || ''));
    return true;
  }
}
