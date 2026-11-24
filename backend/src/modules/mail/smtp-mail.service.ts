import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { redactEmail } from '../../common/logger/redacted-logger.js';
import type { AppEnv } from '../../config/env.config.js';
import type { MailProvider, SendOtpMailInput } from './mail.provider.js';

/**
 * Standard SMTP mail provider backed by Nodemailer.
 * Uses Mailpit in local development and NetEase 163 SMTP (smtp.163.com:465 SSL) in staging/production.
 */
@Injectable()
export class SmtpMailService implements MailProvider {
  private readonly logger = new Logger(SmtpMailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(configService: ConfigService<AppEnv, true>) {
    const host = configService.get('SMTP_HOST', { infer: true });
    const port = configService.get('SMTP_PORT', { infer: true });
    const secure = configService.get('SMTP_SECURE', { infer: true });
    const user = configService.get('SMTP_USER', { infer: true });
    const pass = configService.get('SMTP_PASS', { infer: true });

    this.fromAddress = configService.get('SMTP_FROM', { infer: true });
    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendOtpCode(input: SendOtpMailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: '简序 · 邮箱登录验证码',
      text: `您的登录验证码为 ${input.code}，${input.expiresInMinutes} 分钟内有效，请勿泄露给他人。`,
    });
    this.logger.log(`OTP mail dispatched to ${redactEmail(input.to)}`);
  }
}
