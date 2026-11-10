import {Body, Controller, Get, Post, Put, Query, Req, Res} from '@nestjs/common';
import {ApiOkResponse, ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {Request, Response} from 'express';
import {Config} from '../../config/config';
import {OwnerRequest, Public} from '../../common/session.guard';
import {GithubService} from './github.service';
import {
  GithubConnection,
  GithubFeaturedProjects,
  GithubRepositories,
  SaveGithubFeaturedProjects,
} from './github.dto';

@ApiTags('github')
@Controller('account/github')
export class GithubController {
  constructor(
    private readonly github: GithubService,
    private readonly config: Config,
  ) {}
  @Get('connection')
  @ApiOperation({operationId: 'getGithubConnection'})
  @ApiOkResponse({type: GithubConnection})
  async connection(@Req() request: OwnerRequest): Promise<GithubConnection> {
    return this.github.connection(request.owner);
  }
  @Public()
  @Get('authorize')
  @ApiOperation({operationId: 'authorizeGithub'})
  async authorize(
    @Query('returnTo') path: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.begin(path, request, response);
  }
  @Post('link')
  @ApiOperation({operationId: 'linkGithub'})
  async link(
    @Query('returnTo') path: string,
    @Req() request: OwnerRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.begin(path, request, response, String(request.cookies?.cvory_session || ''));
  }
  private async begin(
    path: string,
    request: Request,
    response: Response,
    session?: string,
  ): Promise<void> {
    const result = await this.github.begin(path, request.ip || 'local', session);
    response.cookie('cvory_oauth', result.browser, {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      path: '/api/account/github',
      maxAge: 600000,
    });
    response.redirect(303, result.url);
  }
  @Public()
  @Get('callback')
  @ApiOperation({operationId: 'completeGithub'})
  async callback(
    @Query('state') state: string,
    @Query('code') code: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.clearCookie('cvory_oauth', {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      path: '/api/account/github',
    });
    const result = await this.github.complete(
      state,
      String(request.cookies?.cvory_oauth || ''),
      code,
      String(request.cookies?.cvory_session || ''),
    );
    response.cookie('cvory_session', result.token, {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      maxAge: 604800000,
      path: '/',
    });
    response.redirect(303, `${this.config.origin}${result.path}`);
  }
  @Get('repositories')
  @ApiOperation({operationId: 'listGithubRepositories'})
  @ApiQuery({name: 'pageToken', required: false})
  @ApiOkResponse({type: GithubRepositories})
  async repositories(
    @Req() request: OwnerRequest,
    @Query('pageToken') token = '',
  ): Promise<GithubRepositories> {
    return this.github.repositories(request.owner, token);
  }

  @Get('featured-projects')
  @ApiOperation({operationId: 'getGithubFeaturedProjects'})
  @ApiOkResponse({type: GithubFeaturedProjects})
  featuredProjects(@Req() request: OwnerRequest): Promise<GithubFeaturedProjects> {
    return this.github.featuredProjects(request.owner);
  }

  @Put('featured-projects')
  @ApiOperation({operationId: 'saveGithubFeaturedProjects'})
  @ApiOkResponse({type: GithubFeaturedProjects})
  saveFeaturedProjects(
    @Body() body: SaveGithubFeaturedProjects,
    @Req() request: OwnerRequest,
  ): Promise<GithubFeaturedProjects> {
    return this.github.saveFeaturedProjects(request.owner, body);
  }
}
