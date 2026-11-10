import {DynamicModule, Module} from '@nestjs/common';
import {AccountModule} from '../account/account.module';
import {CvsModule} from '../cvs/cvs.module';
import {GithubClient} from '../github/github_client';
import {GithubModule} from '../github/github.module';
import {PublicationController} from './publication.controller';
import {PublicationService} from './publication.service';
@Module({})
export class PublicationModule {
  static register(external?: Pick<GithubClient, 'identity' | 'repositories'>): DynamicModule {
    return {
      module: PublicationModule,
      imports: [AccountModule, CvsModule, GithubModule.register(external)],
      controllers: [PublicationController],
      providers: [PublicationService],
    };
  }
}
