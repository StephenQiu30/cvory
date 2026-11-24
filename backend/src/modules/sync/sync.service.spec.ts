import * as Y from 'yjs';
import { CVORY_CONTRACT_VERSION } from '../../common/contract/contract.constants.js';
import { toBase64 } from '../../common/yjs/yjs-state.helper.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SyncService } from './sync.service.js';

function createYjsUpdateBase64(content: string): string {
  const doc = new Y.Doc();
  doc.getText('bio').insert(0, content);
  const encoded = toBase64(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return encoded;
}

describe('SyncService', () => {
  it('rejects unsupported contract version and invalid Yjs binary payloads', async () => {
    const transactionMock = vi.fn();
    const prisma = {
      $transaction: transactionMock,
    } as unknown as PrismaService;
    const service = new SyncService(prisma);

    const badContract = await service.persistUpdate(
      'user-1',
      'res-1',
      2,
      1,
      createYjsUpdateBase64('hello'),
    );
    expect(badContract.ok).toBe(false);
    if (!badContract.ok && badContract.message.type === 'ERROR') {
      expect(badContract.message.code).toBe('CONTRACT_UNSUPPORTED');
    }

    const badBytes = await service.persistUpdate(
      'user-1',
      'res-1',
      CVORY_CONTRACT_VERSION,
      1,
      'not-valid-yjs-!!!',
    );
    expect(badBytes.ok).toBe(false);
    if (!badBytes.ok && badBytes.message.type === 'ERROR') {
      expect(badBytes.message.code).toBe('INVALID_UPDATE');
    }
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('persists update inside transaction and returns explicit ACK (AC-CV-07)', async () => {
    const txMock = {
      resume: {
        findUnique: vi.fn(async () => ({
          id: 'res-1',
          userId: 'user-1',
          deletedAt: null,
        })),
        update: vi.fn(),
      },
      resumeYjsUpdate: {
        create: vi.fn(),
        count: vi.fn(async () => 1),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    } as unknown as PrismaService;

    const service = new SyncService(prisma);
    const updateBase64 = createYjsUpdateBase64('后端架构师');

    const result = await service.persistUpdate(
      'user-1',
      'res-1',
      CVORY_CONTRACT_VERSION,
      7,
      updateBase64,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ackMessage.type).toBe('ACK');
      expect(result.ackMessage.clientSeq).toBe(7);
      expect(result.broadcastMessage.type).toBe('REMOTE_UPDATE');
      expect(result.broadcastMessage.updateBase64).toBe(updateBase64);
    }
    expect(txMock.resumeYjsUpdate.create).toHaveBeenCalledTimes(1);
  });

  it('returns DOC_DELETED when writing to a tombstoned resume', async () => {
    const deletedAt = new Date('2026-11-24T10:00:00.000Z');
    const txMock = {
      resume: {
        findUnique: vi.fn(async () => ({
          id: 'res-1',
          userId: 'user-1',
          deletedAt,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    } as unknown as PrismaService;

    const service = new SyncService(prisma);
    const result = await service.persistUpdate(
      'user-1',
      'res-1',
      CVORY_CONTRACT_VERSION,
      8,
      createYjsUpdateBase64('离线修改'),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toEqual({
        type: 'DOC_DELETED',
        resumeId: 'res-1',
        deletedAt: deletedAt.toISOString(),
      });
    }
  });
});
