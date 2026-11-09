import {DynamicModule, Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {HealthController} from './common/health.controller';
import {Config} from './config/config';
import {DatabaseModule} from './database/database.module';
import {SessionGuard} from './common/session.guard';
import {AccountModule} from './modules/account/account.module';
import {PublicationModule} from './modules/publication/publication.module';
import {FilesModule} from './modules/files/files.module';
import {CvsModule} from './modules/cvs/cvs.module';
import {GithubModule} from './modules/github/github.module';
import {GithubClient} from './modules/github/github_client';
@Module({})
export class AppModule {
  static register(
    config: Config,
    external?: Pick<GithubClient, 'identity' | 'repositories'>,
  ): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      imports: [
        DatabaseModule.register(config),
        AccountModule,
        CvsModule,
        PublicationModule,
        FilesModule,
        GithubModule.register(external),
      ],
      providers: [{provide: APP_GUARD, useClass: SessionGuard}],
    };
  }
}
