import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway.js';

@Module({
  providers: [SyncGateway],
})
export class SyncModule {}
