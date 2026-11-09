import {ApiProperty, ApiPropertyOptional, PartialType} from '@nestjs/swagger';
import {IsArray, IsObject, IsOptional, IsString, IsUUID, Length} from 'class-validator';
const profileProperties = {allOf: [{$ref: '#/components/schemas/ProfileInput'}]};
const sectionProperties = {
  type: 'array' as const,
  items: {$ref: '#/components/schemas/SectionInput'},
};
const styleProperties = {allOf: [{$ref: '#/components/schemas/StyleSettingsInput'}]};

export class CreateCVRequest {
  @ApiProperty() @IsString() @Length(1, 255) displayName!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional(profileProperties) @IsOptional() @IsObject() profile?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional(sectionProperties) @IsOptional() @IsArray() sections?: unknown[];
  @ApiPropertyOptional(styleProperties) @IsOptional() @IsObject() styleSettings?: Record<
    string,
    unknown
  >;
}
export class UpdateCVRequest extends PartialType(CreateCVRequest) {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 64) etag?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) updateMask?: string;
}
export class RestoreRequest {
  @ApiProperty() @IsUUID() requestId!: string;
}
