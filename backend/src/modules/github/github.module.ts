import {DynamicModule, Module} from '@nestjs/common';
import {AccountModule} from '../account/account.module';
import {GithubClient} from './github_client';
import {GithubController} from './github.controller';
import {GithubService} from './github.service';
@Module({})
export class GithubModule {
  static register(external?: Pick<GithubClient, 'identity' | 'repositories'>): DynamicModule {
    return {
      module: GithubModule,
      imports: [AccountModule],
      controllers: [GithubController],
      providers: [
        GithubService,
        ...(external ? [{provide: GithubClient, useValue: external}] : [GithubClient]),
      ],
    };
  }
}
