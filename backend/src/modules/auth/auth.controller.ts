import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import {
  AuthTokensResponseDto,
  AuthUserDto,
  LogoutDto,
  LogoutResponseDto,
  RefreshTokenDto,
  SendOtpDto,
  SendOtpResponseDto,
  VerifyOtpDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送邮箱登录验证码（网易 163 邮箱 SMTP）' })
  @ApiOkResponse({ type: SendOtpResponseDto })
  @ApiTooManyRequestsResponse({ description: '发送冷却中或达到每小时上限' })
  sendOtp(@Body() body: SendOtpDto): Promise<SendOtpResponseDto> {
    return this.authService.sendOtp(body.email);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '校验邮箱验证码并签发无状态 JWT Access/Refresh Token' })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  verifyOtp(@Body() body: VerifyOtpDto): Promise<AuthTokensResponseDto> {
    return this.authService.verifyOtp(body.email, body.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '使用 Refresh Token 轮换新令牌对' })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh Token 无效或已被吊销' })
  refresh(@Body() body: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '退出登录：拉黑 JWT 并立即断开该用户活跃同步连接' })
  @ApiOkResponse({ type: LogoutResponseDto })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: LogoutDto,
  ): Promise<LogoutResponseDto> {
    await this.authService.logout(user, body.refreshToken);
    return { loggedOut: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiOkResponse({ type: AuthUserDto })
  getMe(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return {
      id: user.userId,
      email: user.email,
    };
  }
}
