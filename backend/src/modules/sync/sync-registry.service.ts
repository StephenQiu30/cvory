import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';

export interface ActiveSyncConnection {
  readonly socket: WebSocket;
  readonly userId: string;
  readonly joinedResumes: Set<string>;
}

/**
 * Tracks active WebSocket sync connections so Auth (logout) and Resume (delete tombstone)
 * can immediately disconnect revoked sessions or broadcast DOC_DELETED signals.
 */
@Injectable()
export class SyncRegistryService {
  private readonly connectionsBySocket = new Map<WebSocket, ActiveSyncConnection>();
  private readonly socketsByUser = new Map<string, Set<WebSocket>>();

  register(socket: WebSocket, userId: string): ActiveSyncConnection {
    const connection: ActiveSyncConnection = {
      socket,
      userId,
      joinedResumes: new Set<string>(),
    };
    this.connectionsBySocket.set(socket, connection);

    let userSockets = this.socketsByUser.get(userId);
    if (!userSockets) {
      userSockets = new Set<WebSocket>();
      this.socketsByUser.set(userId, userSockets);
    }
    userSockets.add(socket);
    return connection;
  }

  getConnection(socket: WebSocket): ActiveSyncConnection | undefined {
    return this.connectionsBySocket.get(socket);
  }

  unregister(socket: WebSocket): void {
    const existing = this.connectionsBySocket.get(socket);
    if (!existing) {
      return;
    }
    this.connectionsBySocket.delete(socket);
    const userSockets = this.socketsByUser.get(existing.userId);
    if (userSockets) {
      userSockets.delete(socket);
      if (userSockets.size === 0) {
        this.socketsByUser.delete(existing.userId);
      }
    }
  }

  broadcastToResumePeers(
    userId: string,
    resumeId: string,
    excludeSocket: WebSocket,
    payload: Record<string, unknown>,
  ): void {
    const userSockets = this.socketsByUser.get(userId);
    if (!userSockets) {
      return;
    }
    const serialized = JSON.stringify(payload);
    for (const socket of userSockets) {
      if (socket === excludeSocket || socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      const conn = this.connectionsBySocket.get(socket);
      if (conn?.joinedResumes.has(resumeId)) {
        socket.send(serialized);
      }
    }
  }

  notifyDocumentDeleted(userId: string, resumeId: string, deletedAtIso: string): void {
    const userSockets = this.socketsByUser.get(userId);
    if (!userSockets) {
      return;
    }
    const serialized = JSON.stringify({
      type: 'DOC_DELETED',
      resumeId,
      deletedAt: deletedAtIso,
    });
    for (const socket of userSockets) {
      const conn = this.connectionsBySocket.get(socket);
      if (!conn || !conn.joinedResumes.has(resumeId)) {
        continue;
      }
      conn.joinedResumes.delete(resumeId);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serialized);
      }
    }
  }

  disconnectUser(userId: string): void {
    const userSockets = this.socketsByUser.get(userId);
    if (!userSockets) {
      return;
    }
    for (const socket of [...userSockets]) {
      this.unregister(socket);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(4401, 'Session revoked');
      }
    }
  }
}
