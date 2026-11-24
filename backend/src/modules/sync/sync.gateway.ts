import { Logger } from '@nestjs/common';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { WebSocketGateway } from '@nestjs/websockets';
import { WebSocket, type RawData } from 'ws';
import { AuthService } from '../auth/auth.service.js';
import { SyncRegistryService } from './sync-registry.service.js';
import {
  clientSyncMessageSchema,
  type ClientSyncMessage,
  type ServerSyncMessage,
} from './sync.protocol.js';
import { SyncService } from './sync.service.js';

const AUTH_HANDSHAKE_TIMEOUT_MS = 10_000;

/**
 * Native WebSocket gateway for single-contract Yjs binary synchronization and explicit DB persistence ACKs.
 * Authentication is performed via first-frame AUTH message (JWT Access Token, never via URL query).
 */
@WebSocketGateway({ path: '/ws/sync' })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SyncGateway.name);
  private readonly authTimers = new WeakMap<WebSocket, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly authService: AuthService,
    private readonly syncService: SyncService,
    private readonly syncRegistry: SyncRegistryService,
  ) {}

  handleConnection(client: WebSocket): void {
    const authTimer = setTimeout(() => {
      if (!this.syncRegistry.getConnection(client)) {
        this.send(client, {
          type: 'ERROR',
          code: 'UNAUTHORIZED',
          message: '认证超时，请在建立连接后发送首帧 AUTH 消息',
        });
        client.close(4401, 'Auth timeout');
      }
    }, AUTH_HANDSHAKE_TIMEOUT_MS);

    this.authTimers.set(client, authTimer);

    client.on('message', (rawData: RawData) => {
      void this.handleRawMessage(client, rawData);
    });
  }

  handleDisconnect(client: WebSocket): void {
    const timer = this.authTimers.get(client);
    if (timer) {
      clearTimeout(timer);
      this.authTimers.delete(client);
    }
    this.syncRegistry.unregister(client);
  }

  private rawDataToString(rawData: RawData): string {
    if (typeof rawData === 'string') {
      return rawData;
    }
    if (Buffer.isBuffer(rawData)) {
      return rawData.toString('utf8');
    }
    if (Array.isArray(rawData)) {
      return Buffer.concat(rawData).toString('utf8');
    }
    return Buffer.from(rawData).toString('utf8');
  }

  private async handleRawMessage(client: WebSocket, rawData: RawData): Promise<void> {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(this.rawDataToString(rawData));
    } catch {
      this.send(client, {
        type: 'ERROR',
        code: 'INVALID_MESSAGE',
        message: '消息格式必须为合法 JSON',
      });
      return;
    }

    const parsed = clientSyncMessageSchema.safeParse(parsedJson);
    if (!parsed.success) {
      this.send(client, {
        type: 'ERROR',
        code: 'INVALID_MESSAGE',
        message: '同步消息字段不符合现行协议',
      });
      return;
    }

    try {
      await this.dispatchMessage(client, parsed.data);
    } catch (error) {
      this.logger.error('Unexpected error handling WS sync message', error);
      this.send(client, {
        type: 'ERROR',
        code: 'INTERNAL_ERROR',
        message: '同步服务内部错误，请稍后重试',
      });
    }
  }

  private async dispatchMessage(client: WebSocket, message: ClientSyncMessage): Promise<void> {
    if (message.type === 'PING') {
      this.send(client, { type: 'PONG' });
      return;
    }

    if (message.type === 'AUTH') {
      try {
        const authenticated = await this.authService.verifyAccessToken(message.accessToken);
        const timer = this.authTimers.get(client);
        if (timer) {
          clearTimeout(timer);
          this.authTimers.delete(client);
        }
        this.syncRegistry.unregister(client);
        this.syncRegistry.register(client, authenticated.userId);
        this.send(client, { type: 'AUTH_OK', userId: authenticated.userId });
      } catch {
        this.send(client, {
          type: 'ERROR',
          code: 'UNAUTHORIZED',
          message: '访问令牌无效或已失效',
        });
        client.close(4401, 'Unauthorized');
      }
      return;
    }

    const connection = this.syncRegistry.getConnection(client);
    if (!connection) {
      this.send(client, {
        type: 'ERROR',
        code: 'UNAUTHORIZED',
        message: '请先完成首帧 AUTH 认证',
      });
      client.close(4401, 'Unauthorized');
      return;
    }

    if (message.type === 'JOIN') {
      const result = await this.syncService.loadSyncState(
        connection.userId,
        message.resumeId,
        message.contractVersion,
        message.stateVectorBase64,
      );
      if (result.ok) {
        connection.joinedResumes.add(message.resumeId);
      }
      this.send(client, result.message);
      return;
    }

    if (message.type === 'LEAVE') {
      connection.joinedResumes.delete(message.resumeId);
      return;
    }

    if (!connection.joinedResumes.has(message.resumeId)) {
      this.send(client, {
        type: 'ERROR',
        code: 'NOT_JOINED',
        resumeId: message.resumeId,
        message: '请先 JOIN 该简历稿件后再发送更新',
      });
      return;
    }

    const persistResult = await this.syncService.persistUpdate(
      connection.userId,
      message.resumeId,
      message.contractVersion,
      message.clientSeq,
      message.updateBase64,
    );

    if (!persistResult.ok) {
      if (persistResult.message.type === 'DOC_DELETED') {
        connection.joinedResumes.delete(message.resumeId);
      }
      this.send(client, persistResult.message);
      return;
    }

    this.send(client, persistResult.ackMessage);
    this.syncRegistry.broadcastToResumePeers(
      connection.userId,
      message.resumeId,
      client,
      persistResult.broadcastMessage,
    );
  }

  private send(client: WebSocket, message: ServerSyncMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}
