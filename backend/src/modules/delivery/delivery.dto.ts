import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DeliveryPreferencesRequest {
  @ApiProperty({type: [String]})
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({each: true})
  @MaxLength(80, {each: true})
  includeKeywords!: string[];

  @ApiProperty({type: [String]})
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({each: true})
  @MaxLength(80, {each: true})
  excludeKeywords!: string[];

  @ApiProperty({type: [String]})
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({each: true})
  @MaxLength(80, {each: true})
  cities!: string[];

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1000,
    description: 'Monthly salary in thousands of CNY.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  salaryMinK!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1000,
    description: 'Monthly salary in thousands of CNY.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  salaryMaxK!: number | null;

  @ApiProperty({type: [String]})
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({each: true})
  @MaxLength(120, {each: true})
  excludedCompanies!: string[];

  @ApiProperty({maxLength: 500})
  @IsString()
  @Length(1, 500)
  greetingTemplate!: string;
}

export class DeliveryPreferencesResource extends DeliveryPreferencesRequest {
  @ApiProperty({nullable: true, type: String}) updateTime!: string | null;
}

export class CreateDeliveryJobRequest {
  @ApiProperty({maxLength: 200})
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({maxLength: 200})
  @IsString()
  @Length(1, 200)
  company!: string;

  @ApiProperty({maxLength: 120})
  @IsString()
  @Length(0, 120)
  city!: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1000,
    description: 'Monthly salary in thousands of CNY.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  salaryMinK!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1000,
    description: 'Monthly salary in thousands of CNY.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  salaryMaxK!: number | null;

  @ApiProperty({maxLength: 20000})
  @IsString()
  @MaxLength(20000)
  description!: string;

  @ApiPropertyOptional({maxLength: 2048})
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
}

export class DeliveryMatchCondition {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({enum: ['matched', 'mismatched', 'unknown', 'notConfigured']})
  status!: 'matched' | 'mismatched' | 'unknown' | 'notConfigured';
  @ApiProperty() explanation!: string;
}

export class DeliveryJobResource {
  @ApiProperty() id!: string;
  @ApiProperty({enum: ['manual']}) source!: 'manual';
  @ApiProperty() title!: string;
  @ApiProperty() company!: string;
  @ApiProperty() city!: string;
  @ApiProperty({nullable: true, type: Number}) salaryMinK!: number | null;
  @ApiProperty({nullable: true, type: Number}) salaryMaxK!: number | null;
  @ApiProperty() description!: string;
  @ApiProperty({nullable: true, type: String}) sourceUrl!: string | null;
  @ApiProperty() createTime!: string;
  @ApiProperty({enum: ['eligible', 'review', 'excluded', 'unfiltered']})
  matchStatus!: 'eligible' | 'review' | 'excluded' | 'unfiltered';
  @ApiProperty({type: [DeliveryMatchCondition]}) conditions!: DeliveryMatchCondition[];
}

export class DeliveryJobList {
  @ApiProperty({type: [DeliveryJobResource]}) jobs!: DeliveryJobResource[];
  @ApiProperty() totalSize!: number;
}

export class CreateDeliveryTaskRequest {
  @ApiProperty()
  @IsUUID()
  requestId!: string;

  @ApiProperty()
  @IsUUID()
  cvId!: string;

  @ApiProperty({maxLength: 64})
  @IsString()
  @Length(1, 64)
  cvEtag!: string;

  @ApiProperty({type: [String], minItems: 1, maxItems: 50})
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', {each: true})
  jobIds!: string[];
}

export class DeliveryTaskItemResource {
  @ApiProperty() jobId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() company!: string;
  @ApiProperty() city!: string;
  @ApiProperty({nullable: true, type: Number}) salaryMinK!: number | null;
  @ApiProperty({nullable: true, type: Number}) salaryMaxK!: number | null;
  @ApiProperty({maxLength: 20000}) description!: string;
  @ApiProperty({nullable: true, type: String}) sourceUrl!: string | null;
  @ApiProperty() jobCreateTime!: string;
  @ApiProperty({enum: ['eligible', 'review', 'excluded', 'unfiltered']})
  matchStatus!: DeliveryJobResource['matchStatus'];
  @ApiProperty({type: [DeliveryMatchCondition]}) conditions!: DeliveryMatchCondition[];
  @ApiProperty() greeting!: string;
}

export class DeliveryTaskResource {
  @ApiProperty() id!: string;
  @ApiProperty({enum: ['draft', 'simulated']})
  status!: 'draft' | 'simulated';
  @ApiProperty() cvId!: string;
  @ApiProperty() cvEtag!: string;
  @ApiProperty() cvName!: string;
  @ApiProperty() cvFingerprint!: string;
  @ApiProperty({type: [DeliveryTaskItemResource]}) items!: DeliveryTaskItemResource[];
  @ApiProperty() createTime!: string;
  @ApiProperty({nullable: true, type: String}) simulationTime!: string | null;
}

export class DeliveryTaskList {
  @ApiProperty({type: [DeliveryTaskResource]}) tasks!: DeliveryTaskResource[];
  @ApiProperty() nextPageToken!: string;
}
