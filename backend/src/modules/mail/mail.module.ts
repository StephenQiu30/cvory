import { Module } from '@nestjs/common';
import { MAIL_PROVIDER } from './mail.provider.js';
import { SmtpMailService } from './smtp-mail.service.js';

@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      useClass: SmtpMailService,
    },
  ],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
