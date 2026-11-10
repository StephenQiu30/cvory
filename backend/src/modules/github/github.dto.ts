import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
export class GithubConnection {
  @ApiProperty() connected!: boolean;
  @ApiProperty() login!: string;
}
export class GithubRepository {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() url!: string;
  @ApiProperty({type: String, nullable: true}) description!: string | null;
  @ApiProperty({type: String, nullable: true}) language!: string | null;
  @ApiProperty() stars!: number;
  @ApiProperty() fork!: boolean;
  @ApiProperty() updateTime!: string;
}
export class GithubRepositories {
  @ApiProperty({type: [GithubRepository]}) repositories!: GithubRepository[];
  @ApiProperty() nextPageToken!: string;
  @ApiProperty() syncTime!: string;
}
export class GithubFeaturedProject extends GithubRepository {
  @ApiProperty() repositoryId!: string;
  @ApiProperty() contribution!: string;
  @ApiProperty() displayOrder!: number;
}
export class GithubFeaturedProjects {
  @ApiProperty({type: [GithubFeaturedProject]}) projects!: GithubFeaturedProject[];
}
export class GithubFeaturedProjectInput {
  @ApiProperty() @IsString() @Matches(/^\d{1,20}$/) repositoryId!: string;
  @ApiProperty() @IsString() @MaxLength(2000) contribution!: string;
}
export class SaveGithubFeaturedProjects {
  @ApiProperty({type: [GithubFeaturedProjectInput], maxItems: 12})
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique((project: GithubFeaturedProjectInput) => project.repositoryId)
  @ValidateNested({each: true})
  @Type(() => GithubFeaturedProjectInput)
  projects!: GithubFeaturedProjectInput[];
}
