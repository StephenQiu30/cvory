import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import {
  ClaimResumeDto,
  ClaimResumeResponseDto,
  CreateResumeDto,
  DeleteResumeResponseDto,
  DuplicateResumeDto,
  ResumeDetailDto,
  ResumeListResponseDto,
  ResumeSummaryDto,
  UpdateResumeDto,
} from './resume.dto.js';
import { ResumeService } from './resume.service.js';

@ApiTags('resumes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Get()
  @ApiOperation({ summary: '获取当前账号下的活跃岗位简历列表（按最近编辑倒序）' })
  @ApiOkResponse({ type: ResumeListResponseDto })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ResumeListResponseDto> {
    const items = await this.resumeService.listByUser(user.userId);
    return { items };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取指定岗位稿件元数据及当前合并的 Yjs 状态' })
  @ApiOkResponse({ type: ResumeDetailDto })
  @ApiForbiddenResponse({ description: '非稿件所有者' })
  @ApiGoneResponse({ description: '稿件已被删除' })
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ResumeDetailDto> {
    return this.resumeService.getDetailByUser(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: '新建岗位简历稿件' })
  @ApiCreatedResponse({ type: ResumeSummaryDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateResumeDto,
  ): Promise<ResumeSummaryDto> {
    return this.resumeService.create(user.userId, body);
  }

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '幂等认领单份游客本机草稿至当前账号' })
  @ApiOkResponse({ type: ClaimResumeResponseDto })
  claim(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ClaimResumeDto,
  ): Promise<ClaimResumeResponseDto> {
    return this.resumeService.claimGuestDraft(user.userId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改岗位简历名称或模板 ID' })
  @ApiOkResponse({ type: ResumeSummaryDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateResumeDto,
  ): Promise<ResumeSummaryDto> {
    return this.resumeService.updateMetadata(user.userId, id, body);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: '复制为独立岗位简历副本（新文档 ID，后续独立同步）' })
  @ApiCreatedResponse({ type: ResumeSummaryDto })
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: DuplicateResumeDto,
  ): Promise<ResumeSummaryDto> {
    return this.resumeService.duplicate(user.userId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除岗位简历（写入删除墓碑并通知所有在线设备停止同步）' })
  @ApiOkResponse({ type: DeleteResumeResponseDto })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DeleteResumeResponseDto> {
    return this.resumeService.softDelete(user.userId, id);
  }
}
