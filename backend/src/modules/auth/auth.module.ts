import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [MailModule],
})
export class AuthModule {}
