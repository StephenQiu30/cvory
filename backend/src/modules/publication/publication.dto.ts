import {ApiProperty} from '@nestjs/swagger';
import {ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsString, Length} from 'class-validator';
import {Document} from '../cvs/document';
import {profileProperties, sectionProperties, styleProperties} from '../cvs/cv_resource.dto';
export const PUBLIC_FIELDS = [
  'email',
  'phone',
  'location',
  'website',
  'github',
  'wechat',
  'jobStatus',
  'expectedLocation',
  'experienceYears',
  'expectedSalary',
  'avatarUrl',
];
export class ResumeDocument implements Document {
  @ApiProperty(profileProperties) profile!: Document['profile'];
  @ApiProperty(sectionProperties) sections!: Document['sections'];
  @ApiProperty(styleProperties) styleSettings!: Document['styleSettings'];
}
export class PublicSelection {
  @ApiProperty() @IsString() @Length(1, 36) sourceId!: string;
  @ApiProperty() @IsString() @Length(1, 64) etag!: string;
  @ApiProperty({type: [String]})
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsIn(PUBLIC_FIELDS, {each: true})
  fields!: string[];
  @ApiProperty({type: [String]})
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({each: true})
  @Length(1, 100, {each: true})
  sectionIds!: string[];
}
export class PublicationReview {
  @ApiProperty() id!: string;
  @ApiProperty() sourceName!: string;
  @ApiProperty({type: ResumeDocument}) document!: ResumeDocument;
}
export class PublishRequest {
  @ApiProperty() @IsString() @Length(1, 36) reviewId!: string;
}
export class PublicationStatus {
  @ApiProperty() published!: boolean;
  @ApiProperty() sourceName!: string;
  @ApiProperty() updateTime!: string;
  @ApiProperty() publicId!: string;
  @ApiProperty() etag!: string;
}
