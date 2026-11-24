import { Global, Module } from '@nestjs/common';
import { SyncRegistryService } from './sync-registry.service.js';

@Global()
@Module({
  providers: [SyncRegistryService],
  exports: [SyncRegistryService],
})
export class SyncRegistryModule {}
