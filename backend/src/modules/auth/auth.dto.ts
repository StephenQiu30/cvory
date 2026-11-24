import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: 'user@example.com', description: '用户邮箱地址' })
  @IsEmail()
  readonly email!: string;
}

export class SendOtpResponseDto {
  @ApiProperty({ example: true })
  readonly sent!: boolean;

  @ApiProperty({ example: 600, description: '验证码有效秒数' })
  readonly expiresInSeconds!: number;

  @ApiProperty({ example: 60, description: '再次发送冷却秒数' })
  readonly retryAfterSeconds!: number;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ example: '123456', description: '6 位数字邮箱验证码' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: '验证码必须为 6 位数字' })
  readonly code!: string;
}

export class AuthUserDto {
  @ApiProperty({ example: 'cm3abc123def456' })
  readonly id!: string;

  @ApiProperty({ example: 'user@example.com' })
  readonly email!: string;
}

export class AuthTokensResponseDto {
  @ApiProperty({ description: '短效 JWT Access Token' })
  readonly accessToken!: string;

  @ApiProperty({ description: '长效 JWT Refresh Token' })
  readonly refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access Token 有效期（秒）' })
  readonly expiresInSeconds!: number;

  @ApiProperty({ type: AuthUserDto })
  readonly user!: AuthUserDto;
}

export class RefreshTokenDto {
  @ApiProperty({ description: '当前有效的 Refresh Token' })
  @IsString()
  readonly refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: '可选：同时拉黑当前 Refresh Token' })
  @IsOptional()
  @IsString()
  readonly refreshToken?: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  readonly loggedOut!: boolean;
}
