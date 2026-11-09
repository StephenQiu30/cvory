import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsEmail, IsOptional, IsString, Length} from 'class-validator';
import {Transform} from 'class-transformer';

export class Credentials {
  @ApiProperty()
  @Transform(({value}: {value: unknown}) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @Length(1, 254)
  email!: string;
  @ApiProperty() @IsString() @Length(8, 128) password!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 80) displayName?: string;
}

export class AccountResource {
  @ApiProperty() id!: string;
  @ApiProperty({nullable: true, type: String}) email!: string | null;
  @ApiProperty() displayName!: string;
  @ApiProperty({nullable: true, type: String}) avatar!: string | null;
  @ApiProperty() publicId!: string;
  @ApiProperty() emailVerified!: boolean;
  @ApiProperty() githubConnected!: boolean;
}

export class AuthOptions {
  @ApiProperty() githubEnabled!: boolean;
  @ApiProperty() legacyRegistrationEnabled!: boolean;
  @ApiProperty() legacyRecoveryEnabled!: boolean;
}

export class AccountUpdate {
  @ApiProperty() @IsString() @Length(1, 80) displayName!: string;
  @ApiPropertyOptional({type: String, nullable: true})
  @IsOptional()
  @IsString()
  @Length(0, 2800000)
  avatar?: string | null;
}
export class ChangePasswordRequest {
  @ApiProperty() @IsString() @Length(1, 128) password!: string;
  @ApiProperty() @IsString() @Length(8, 128) newPassword!: string;
}
