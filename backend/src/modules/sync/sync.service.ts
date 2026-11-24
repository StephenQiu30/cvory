import { Injectable } from '@nestjs/common';
import {
  CVORY_CONTRACT_VERSION,
  isSupportedContractVersion,
} from '../../common/contract/contract.constants.js';
import {
  decodeAndValidateYjsUpdate,
  decodeBase64StateVector,
  mergePersistedYjsState,
  toBase64,
} from '../../common/yjs/yjs-state.helper.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { ServerSyncMessage } from './sync.protocol.js';

const COMPACT_UPDATE_THRESHOLD = 50;

export type JoinSyncResult =
  | { readonly ok: true; readonly message: Extract<ServerSyncMessage, { type: 'SYNC_STATE' }> }
  | { readonly ok: false; readonly message: Extract<ServerSyncMessage, { type: 'DOC_DELETED' | 'ERROR' }> };

export type PersistUpdateResult =
  | {
      readonly ok: true;
      readonly ackMessage: Extract<ServerSyncMessage, { type: 'ACK' }>;
      readonly broadcastMessage: Extract<ServerSyncMessage, { type: 'REMOTE_UPDATE' }>;
    }
  | {
      readonly ok: false;
      readonly message: Extract<ServerSyncMessage, { type: 'DOC_DELETED' | 'ERROR' }>;
    };

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async loadSyncState(
    userId: string,
    resumeId: string,
    contractVersion: number,
    stateVectorBase64?: string,
  ): Promise<JoinSyncResult> {
    if (!isSupportedContractVersion(contractVersion)) {
      return {
        ok: false,
        message: {
          type: 'ERROR',
          code: 'CONTRACT_UNSUPPORTED',
          resumeId,
          message: `不支持的契约版本：${contractVersion}，当前仅支持版本 ${CVORY_CONTRACT_VERSION}`,
        },
      };
    }

    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      return {
        ok: false,
        message: { type: 'ERROR', code: 'NOT_FOUND', resumeId, message: '简历稿件不存在' },
      };
    }
    if (resume.userId !== userId) {
      return {
        ok: false,
        message: { type: 'ERROR', code: 'FORBIDDEN', resumeId, message: '无权访问该简历稿件' },
      };
    }
    if (resume.deletedAt !== null) {
      return {
        ok: false,
        message: {
          type: 'DOC_DELETED',
          resumeId,
          deletedAt: resume.deletedAt.toISOString(),
        },
      };
    }

    const [snapshot, updates] = await Promise.all([
      this.prisma.resumeYjsSnapshot.findUnique({ where: { resumeId } }),
      this.prisma.resumeYjsUpdate.findMany({
        where: { resumeId },
        orderBy: { id: 'asc' },
      }),
    ]);

    const clientStateVector = stateVectorBase64
      ? decodeBase64StateVector(stateVectorBase64)
      : undefined;

    const merged = mergePersistedYjsState(
      snapshot ? new Uint8Array(snapshot.snapshotData) : null,
      updates.map((row) => new Uint8Array(row.updateData)),
      clientStateVector,
    );

    const latestClientSeq = updates.length > 0 ? updates[updates.length - 1].clientSeq : 0;

    return {
      ok: true,
      message: {
        type: 'SYNC_STATE',
        resumeId,
        updateBase64: toBase64(merged.diffUpdate),
        stateVectorBase64: toBase64(merged.stateVector),
        latestClientSeq,
      },
    };
  }

  /**
   * Validates contract + Yjs binary payload, checks ownership & deletion tombstone inside a
   * PostgreSQL transaction, persists the update, and ONLY returns ACK after commit succeeds (AC-CV-07).
   */
  async persistUpdate(
    userId: string,
    resumeId: string,
    contractVersion: number,
    clientSeq: number,
    updateBase64: string,
  ): Promise<PersistUpdateResult> {
    if (!isSupportedContractVersion(contractVersion)) {
      return {
        ok: false,
        message: {
          type: 'ERROR',
          code: 'CONTRACT_UNSUPPORTED',
          resumeId,
          message: `不支持的契约版本：${contractVersion}，当前仅支持版本 ${CVORY_CONTRACT_VERSION}`,
        },
      };
    }

    let updateBytes: Uint8Array;
    try {
      updateBytes = decodeAndValidateYjsUpdate(updateBase64);
    } catch {
      return {
        ok: false,
        message: {
          type: 'ERROR',
          code: 'INVALID_UPDATE',
          resumeId,
          message: '无效的 Yjs 二进制更新数据',
        },
      };
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      const resume = await tx.resume.findUnique({ where: { id: resumeId } });
      if (!resume) {
        return { kind: 'NOT_FOUND' as const };
      }
      if (resume.userId !== userId) {
        return { kind: 'FORBIDDEN' as const };
      }
      if (resume.deletedAt !== null) {
        return { kind: 'DELETED' as const, deletedAt: resume.deletedAt.toISOString() };
      }

      const now = new Date();
      await tx.resumeYjsUpdate.create({
        data: {
          resumeId,
          clientSeq,
          updateData: Buffer.from(updateBytes),
        },
      });
      await tx.resume.update({
        where: { id: resumeId },
        data: { updatedAt: now },
      });

      const updateCount = await tx.resumeYjsUpdate.count({ where: { resumeId } });
      if (updateCount >= COMPACT_UPDATE_THRESHOLD) {
        const [snapshot, allUpdates] = await Promise.all([
          tx.resumeYjsSnapshot.findUnique({ where: { resumeId } }),
          tx.resumeYjsUpdate.findMany({
            where: { resumeId },
            orderBy: { id: 'asc' },
          }),
        ]);
        const merged = mergePersistedYjsState(
          snapshot ? new Uint8Array(snapshot.snapshotData) : null,
          allUpdates.map((row) => new Uint8Array(row.updateData)),
        );
        const lastId = allUpdates[allUpdates.length - 1].id;
        await tx.resumeYjsSnapshot.upsert({
          where: { resumeId },
          create: {
            resumeId,
            stateVector: Buffer.from(merged.stateVector),
            snapshotData: Buffer.from(merged.fullUpdate),
          },
          update: {
            stateVector: Buffer.from(merged.stateVector),
            snapshotData: Buffer.from(merged.fullUpdate),
          },
        });
        await tx.resumeYjsUpdate.deleteMany({
          where: {
            resumeId,
            id: { lt: lastId },
          },
        });
      }

      return { kind: 'OK' as const, serverTimestamp: now.toISOString() };
    });

    if (txResult.kind === 'NOT_FOUND') {
      return {
        ok: false,
        message: { type: 'ERROR', code: 'NOT_FOUND', resumeId, message: '简历稿件不存在' },
      };
    }
    if (txResult.kind === 'FORBIDDEN') {
      return {
        ok: false,
        message: { type: 'ERROR', code: 'FORBIDDEN', resumeId, message: '无权写入该简历稿件' },
      };
    }
    if (txResult.kind === 'DELETED') {
      return {
        ok: false,
        message: {
          type: 'DOC_DELETED',
          resumeId,
          deletedAt: txResult.deletedAt,
        },
      };
    }

    return {
      ok: true,
      ackMessage: {
        type: 'ACK',
        resumeId,
        clientSeq,
        serverTimestamp: txResult.serverTimestamp,
      },
      broadcastMessage: {
        type: 'REMOTE_UPDATE',
        resumeId,
        updateBase64,
        clientSeq,
      },
    };
  }
}
