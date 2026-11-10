import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  Max,
} from 'class-validator';
import {Transform, Type} from 'class-transformer';

export enum AiProviderId {
  VOLCENGINE = 'volcengine',
  DEEPSEEK = 'deepseek',
  OPENAI = 'openai',
}

export enum AiOperation {
  DIAGNOSE = 'diagnose',
  JOB_MATCH = 'jobMatch',
  IMPROVE = 'improve',
  GREETING = 'greeting',
}

export class UpdateAiProviderRequest {
  @ApiProperty({description: 'Provider model or endpoint ID configured by the user.'})
  @IsString()
  @Length(1, 200)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
  modelId!: string;

  @ApiPropertyOptional({description: 'Blank leaves the existing API Key unchanged.'})
  @IsOptional()
  @IsString()
  @Length(0, 512)
  apiKey?: string;
}

export class AiProviderStatus {
  @ApiProperty({enum: AiProviderId}) provider!: AiProviderId;
  @ApiProperty() displayName!: string;
  @ApiProperty() protocol!: string;
  @ApiProperty() officialHost!: string;
  @ApiProperty() configured!: boolean;
  @ApiProperty() encryptionReady!: boolean;
  @ApiProperty({nullable: true, type: String}) modelId!: string | null;
  @ApiProperty({nullable: true, type: String}) keySuffix!: string | null;
  @ApiProperty({nullable: true, type: String}) updateTime!: string | null;
}

export class AiProviderList {
  @ApiProperty({type: [AiProviderStatus]}) providers!: AiProviderStatus[];
}

export class AiConnectionTestRequest {
  @ApiProperty() @IsUUID() requestId!: string;
}

export class AiConnectionTestResult {
  @ApiProperty({enum: AiProviderId}) provider!: AiProviderId;
  @ApiProperty() modelId!: string;
  @ApiProperty() connected!: boolean;
  @ApiProperty() requestId!: string;
  @ApiProperty({nullable: true, type: Number}) inputTokens!: number | null;
  @ApiProperty({nullable: true, type: Number}) outputTokens!: number | null;
}

export class PreviewCvRequest {
  @ApiProperty() @IsUUID() cvId!: string;
  @ApiProperty() @IsString() @Length(1, 64) etag!: string;
  @ApiProperty({enum: AiProviderId}) @IsEnum(AiProviderId) provider!: AiProviderId;
  @ApiProperty({enum: AiOperation}) @IsEnum(AiOperation) operation!: AiOperation;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobDescription?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 240)
  targetFieldId?: string;
}

export class AnalyzeCvRequest extends PreviewCvRequest {
  @ApiProperty() @IsUUID() requestId!: string;
  @ApiProperty() @IsString() @Length(1, 40) providerConfigUpdateTime!: string;
}

export class AiAnalysisInputField {
  @ApiProperty() fieldId!: string;
  @ApiProperty() label!: string;
  @ApiProperty() text!: string;
}

export class AiFinding {
  @ApiProperty({enum: ['strength', 'gap', 'unknown']})
  kind!: 'strength' | 'gap' | 'unknown';
  @ApiProperty() title!: string;
  @ApiProperty({enum: ['supported', 'missing', 'unknown']})
  status!: 'supported' | 'missing' | 'unknown';
  @ApiProperty({nullable: true, type: String}) fieldId!: string | null;
  @ApiProperty() evidence!: string;
  @ApiProperty() explanation!: string;
}

export class AiSuggestion {
  @ApiProperty() targetFieldId!: string;
  @ApiProperty() sourceText!: string;
  @ApiProperty() proposedText!: string;
  @ApiProperty() explanation!: string;
}

export class AiAnalysisContent {
  @ApiProperty() summary!: string;
  @ApiProperty({type: [AiFinding]}) findings!: AiFinding[];
  @ApiProperty({type: [AiSuggestion]}) suggestions!: AiSuggestion[];
  @ApiProperty() greeting!: string;
}

export class AiAnalysisPreview {
  @ApiProperty() cvId!: string;
  @ApiProperty() cvEtag!: string;
  @ApiProperty({enum: AiProviderId}) provider!: AiProviderId;
  @ApiProperty() modelId!: string;
  @ApiProperty() providerConfigUpdateTime!: string;
  @ApiProperty({enum: AiOperation}) operation!: AiOperation;
  @ApiProperty({type: [AiAnalysisInputField]}) inputFields!: AiAnalysisInputField[];
  @ApiProperty({type: [AiAnalysisInputField]}) targetFieldOptions!: AiAnalysisInputField[];
  @ApiProperty() jobDescription!: string;
  @ApiProperty() retentionDays!: number;
}

export class AiUsageResource {
  @ApiProperty({nullable: true, type: Number}) inputTokens!: number | null;
  @ApiProperty({nullable: true, type: Number}) outputTokens!: number | null;
}

export class AiReportResource {
  @ApiProperty() id!: string;
  @ApiProperty() cvId!: string;
  @ApiProperty() cvEtag!: string;
  @ApiProperty({enum: AiProviderId}) provider!: AiProviderId;
  @ApiProperty() modelId!: string;
  @ApiProperty({enum: AiOperation}) operation!: AiOperation;
  @ApiProperty() promptVersion!: string;
  @ApiProperty({enum: ['succeeded', 'failed', 'unknown', 'running']})
  status!: 'succeeded' | 'failed' | 'unknown' | 'running';
  @ApiProperty({type: [AiAnalysisInputField]}) inputFields!: AiAnalysisInputField[];
  @ApiProperty() jobDescription!: string;
  @ApiProperty({type: AiAnalysisContent, nullable: true}) result!: AiAnalysisContent | null;
  @ApiProperty({type: AiUsageResource}) usage!: AiUsageResource;
  @ApiProperty() createTime!: string;
  @ApiProperty() expireTime!: string;
}

export class AiReportSummary {
  @ApiProperty() id!: string;
  @ApiProperty() cvId!: string;
  @ApiProperty() cvEtag!: string;
  @ApiProperty({enum: AiProviderId}) provider!: AiProviderId;
  @ApiProperty() modelId!: string;
  @ApiProperty({enum: AiOperation}) operation!: AiOperation;
  @ApiProperty({enum: ['succeeded', 'failed', 'unknown', 'running']})
  status!: 'succeeded' | 'failed' | 'unknown' | 'running';
  @ApiProperty() createTime!: string;
  @ApiProperty() expireTime!: string;
}

export class AiReportList {
  @ApiProperty({type: [AiReportSummary]}) reports!: AiReportSummary[];
  @ApiProperty() nextPageToken!: string;
}

export class AiReportQuery {
  @ApiPropertyOptional({minimum: 1, maximum: 100})
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  @Transform(({value}: {value: unknown}) => (typeof value === 'string' ? value : ''))
  pageToken = '';
}
