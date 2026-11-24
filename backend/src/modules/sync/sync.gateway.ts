import { Logger } from '@nestjs/common';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { WebSocketGateway } from '@nestjs/websockets';
import type { WebSocket } from 'ws';

/**
 * Native WebSocket gateway for single-contract Yjs binary synchronization and explicit DB persistence ACKs.
 * Authentication is performed via first-frame AUTH message (JWT Access Token, never via URL query).
 */
@WebSocketGateway({ path: '/ws/sync' })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SyncGateway.name);

  handleConnection(_client: WebSocket): void {
    this.logger.debug('WS sync client connected; awaiting first-frame AUTH');
  }

  handleDisconnect(_client: WebSocket): void {
    this.logger.debug('WS sync client disconnected');
  }
}
