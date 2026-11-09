import {Body, Controller, Get, HttpCode, Patch, Post, Req, Res} from '@nestjs/common';
import {ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request, Response} from 'express';
import {Config} from '../../config/config';
import {Database} from '../../database/database';
import {digest} from '../../common/credentials';
import {ApiError} from '../../common/errors';
import {OwnerRequest, Public} from '../../common/session.guard';
import {AccountService} from './account.service';
import {
  AccountResource,
  AccountUpdate,
  ChangePasswordRequest,
  AuthOptions,
  Credentials,
} from './account.dto';

@ApiTags('account')
@Controller()
export class AccountController {
  constructor(
    private readonly accounts: AccountService,
    private readonly db: Database,
    private readonly config: Config,
  ) {}

  @Public()
  @Get('account/auth-options')
  @ApiOperation({operationId: 'getAuthOptions'})
  @ApiOkResponse({type: AuthOptions})
  options(): AuthOptions {
    return {
      githubEnabled: Boolean(this.config.githubClientId),
      legacyRegistrationEnabled: this.config.legacyRegistration,
      legacyRecoveryEnabled: false,
    };
  }

  @Get('account')
  @ApiOperation({operationId: 'getAccount'})
  @ApiOkResponse({type: AccountResource})
  async get(@Req() request: OwnerRequest): Promise<AccountResource> {
    return this.accounts.resource(request.owner);
  }

  @Patch('account')
  @ApiOperation({operationId: 'updateAccount'})
  @ApiOkResponse({type: AccountResource})
  async update(
    @Body() body: AccountUpdate,
    @Req() request: OwnerRequest,
  ): Promise<AccountResource> {
    return this.accounts.update(request.owner, body);
  }
  @Post('account\\:changePassword')
  @HttpCode(200)
  @ApiOperation({operationId: 'changeAccountPassword'})
  @ApiOkResponse({type: AccountResource})
  async changePassword(
    @Body() body: ChangePasswordRequest,
    @Req() request: OwnerRequest,
  ): Promise<AccountResource> {
    return this.accounts.changePassword(
      request.owner,
      body,
      String(request.cookies?.cvory_session || ''),
      request.ip || 'local',
    );
  }

  @Public()
  @Post('account\\:login')
  @HttpCode(200)
  @ApiOperation({operationId: 'loginAccount'})
  @ApiOkResponse({type: AccountResource})
  async login(
    @Body() body: Credentials,
    @Req() request: Request,
    @Res({passthrough: true}) response: Response,
  ): Promise<AccountResource> {
    return this.establish(await this.accounts.login(body, request.ip || 'local'), response);
  }

  @Public()
  @Post('account\\:register')
  @ApiOperation({operationId: 'registerAccount'})
  @ApiCreatedResponse({type: AccountResource})
  async register(
    @Body() body: Credentials,
    @Req() request: Request,
    @Res({passthrough: true}) response: Response,
  ): Promise<AccountResource> {
    if (!this.config.legacyRegistration)
      throw new ApiError(403, 'PERMISSION_DENIED', 'USE_GITHUB_LOGIN');
    return this.establish(await this.accounts.register(body, request.ip || 'local'), response);
  }

  @Public()
  @Post('account\\:logout')
  @HttpCode(204)
  @ApiOperation({operationId: 'logoutAccount'})
  async logout(
    @Req() request: Request,
    @Res({passthrough: true}) response: Response,
  ): Promise<void> {
    await this.db.run('DELETE FROM account_sessions WHERE token_hash=?', [
      digest(String(request.cookies?.cvory_session || '')),
    ]);
    response.clearCookie('cvory_session', {path: '/', secure: this.config.secure, sameSite: 'lax'});
  }

  private async establish(owner: string, response: Response): Promise<AccountResource> {
    const token = await this.accounts.session(owner);
    response.cookie('cvory_session', token, {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      maxAge: 604800000,
      path: '/',
    });
    return this.accounts.resource(owner);
  }
}
