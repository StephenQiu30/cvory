import {ApiProperty} from '@nestjs/swagger';
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
