import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.config.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { ResumeModule } from './modules/resume/resume.module.js';
import { SyncRegistryModule } from './modules/sync/sync-registry.module.js';
import { SyncModule } from './modules/sync/sync.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    SyncRegistryModule,
    HealthModule,
    MailModule,
    AuthModule,
    ResumeModule,
    SyncModule,
  ],
})
export class AppModule {}
