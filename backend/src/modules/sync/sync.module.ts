import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway.js';
import { SyncService } from './sync.service.js';

@Module({
  providers: [SyncService, SyncGateway],
  exports: [SyncService],
})
export class SyncModule {}
