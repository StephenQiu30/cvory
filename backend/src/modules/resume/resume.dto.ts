import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CVORY_CONTRACT_VERSION } from '../../common/contract/contract.constants.js';

export class ResumeSummaryDto {
  @ApiProperty({ example: 'cm3res123456' })
  readonly id!: string;

  @ApiProperty({ example: '前端工程师 · 2026' })
  readonly title!: string;

  @ApiProperty({ example: 'classic-single' })
  readonly templateId!: string;

  @ApiProperty({ example: CVORY_CONTRACT_VERSION })
  readonly contractVersion!: number;

  @ApiProperty({ example: '2026-11-24T09:00:00.000Z' })
  readonly createdAt!: string;

  @ApiProperty({ example: '2026-11-24T09:30:00.000Z' })
  readonly updatedAt!: string;
}

export class ResumeDetailDto extends ResumeSummaryDto {
  @ApiProperty({ description: '当前已持久化合并的 Yjs 状态（Base64）' })
  readonly stateBase64!: string;

  @ApiProperty({ description: '当前已持久化的 Yjs StateVector（Base64）' })
  readonly stateVectorBase64!: string;

  @ApiProperty({ example: 12, description: '服务端已持久化的最新 clientSeq' })
  readonly latestClientSeq!: number;
}

export class ResumeListResponseDto {
  @ApiProperty({ type: [ResumeSummaryDto] })
  readonly items!: readonly ResumeSummaryDto[];
}

export class CreateResumeDto {
  @ApiProperty({ example: '未命名简历' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  readonly title!: string;

  @ApiProperty({ example: 'classic-single' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  readonly templateId!: string;

  @ApiProperty({ example: CVORY_CONTRACT_VERSION, description: '单一现行契约版本号' })
  @IsInt()
  readonly contractVersion!: number;

  @ApiPropertyOptional({ description: '可选：初始 Yjs 二进制更新（Base64）' })
  @IsOptional()
  @IsString()
  readonly initialUpdateBase64?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly clientSeq?: number;
}

export class ClaimResumeDto {
  @ApiProperty({ example: 'guest-draft-uuid-001', description: '游客本机草稿唯一 ID（幂等键）' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  readonly clientDraftId!: string;

  @ApiProperty({ example: '产品经理 · 社招' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  readonly title!: string;

  @ApiProperty({ example: 'compact-single' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  readonly templateId!: string;

  @ApiProperty({ example: CVORY_CONTRACT_VERSION })
  @IsInt()
  readonly contractVersion!: number;

  @ApiProperty({ description: '本机草稿完整 Yjs 历史更新（Base64）' })
  @IsString()
  readonly initialUpdateBase64!: string;

  @ApiProperty({ example: 1, description: '本次认领携带的最新本机修改序号' })
  @IsInt()
  @Min(0)
  readonly clientSeq!: number;
}

export class ClaimResumeResponseDto {
  @ApiProperty({ type: ResumeSummaryDto })
  readonly resume!: ResumeSummaryDto;

  @ApiProperty({ example: false, description: '是否命中幂等重试（已认领过同一本机稿）' })
  readonly alreadyClaimed!: boolean;

  @ApiProperty({ example: 1, description: '已持久化的本机序号回执' })
  readonly ackedClientSeq!: number;
}

export class UpdateResumeDto {
  @ApiPropertyOptional({ example: '后端工程师 · 架构方向' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  readonly title?: string;

  @ApiPropertyOptional({ example: 'chinese-letter' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  readonly templateId?: string;

  @ApiProperty({ example: CVORY_CONTRACT_VERSION })
  @IsInt()
  readonly contractVersion!: number;
}

export class DuplicateResumeDto {
  @ApiPropertyOptional({ example: '前端工程师 · 副本' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  readonly title?: string;
}

export class DeleteResumeResponseDto {
  @ApiProperty({ example: 'cm3res123456' })
  readonly id!: string;

  @ApiProperty({ example: '2026-11-24T10:00:00.000Z' })
  readonly deletedAt!: string;
}
