import {DynamicModule, Global, Module} from '@nestjs/common';
import {Config} from '../config/config';
import {Database} from './database';
@Global()
@Module({})
export class DatabaseModule {
  static register(config: Config): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [{provide: Config, useValue: config}, Database],
      exports: [Config, Database],
    };
  }
}
