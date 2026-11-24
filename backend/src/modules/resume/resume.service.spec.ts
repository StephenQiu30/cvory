import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as Y from 'yjs';
import { CVORY_CONTRACT_VERSION } from '../../common/contract/contract.constants.js';
import { toBase64 } from '../../common/yjs/yjs-state.helper.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { SyncRegistryService } from '../sync/sync-registry.service.js';
import { ResumeService } from './resume.service.js';

function createValidYjsBase64(text: string): string {
  const doc = new Y.Doc();
  doc.getText('summary').insert(0, text);
  const encoded = toBase64(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return encoded;
}

describe('ResumeService', () => {
  it('rejects unsupported contract versions before touching the database (CASE-CV-11)', async () => {
    const transactionMock = vi.fn();
    const prisma = {
      $transaction: transactionMock,
    } as unknown as PrismaService;
    const syncRegistry = {
      notifyDocumentDeleted: vi.fn(),
    } as unknown as SyncRegistryService;

    const service = new ResumeService(prisma, syncRegistry);

    await expect(
      service.create('user-1', {
        title: '旧契约测试',
        templateId: 'classic-single',
        contractVersion: 99,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects cross-account access with ForbiddenException', async () => {
    const prisma = {
      resume: {
        findUnique: vi.fn(async () => ({
          id: 'res-1',
          userId: 'owner-user',
          title: '架构师',
          templateId: 'classic-single',
          contractVersion: CVORY_CONTRACT_VERSION,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaService;
    const syncRegistry = {
      notifyDocumentDeleted: vi.fn(),
    } as unknown as SyncRegistryService;

    const service = new ResumeService(prisma, syncRegistry);
    await expect(service.getDetailByUser('other-user', 'res-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('claims guest draft idempotently and notifies WS peers on soft delete (AC-CV-08)', async () => {
    const now = new Date();
    const existingResume = {
      id: 'res-claimed-1',
      userId: 'user-1',
      title: '产品经理',
      templateId: 'compact-single',
      contractVersion: CVORY_CONTRACT_VERSION,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const txMock = {
      resumeClaim: {
        findUnique: vi.fn(async () => ({
          id: 'claim-1',
          userId: 'user-1',
          clientDraftId: 'draft-abc',
          resumeId: 'res-claimed-1',
          resume: existingResume,
        })),
      },
      resumeYjsUpdate: {
        findFirst: vi.fn(async () => ({ clientSeq: 1 })),
        create: vi.fn(),
      },
      resume: {
        update: vi.fn(),
      },
    };

    const prisma = {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      resume: {
        findUnique: vi.fn(async () => existingResume),
        update: vi.fn(async () => ({ ...existingResume, deletedAt: now })),
      },
    } as unknown as PrismaService;

    const notifyDocumentDeleted = vi.fn();
    const syncRegistry = {
      notifyDocumentDeleted,
    } as unknown as SyncRegistryService;

    const service = new ResumeService(prisma, syncRegistry);
    const claimResult = await service.claimGuestDraft('user-1', {
      clientDraftId: 'draft-abc',
      title: '产品经理',
      templateId: 'compact-single',
      contractVersion: CVORY_CONTRACT_VERSION,
      initialUpdateBase64: createValidYjsBase64('产品经验'),
      clientSeq: 2,
    });

    expect(claimResult.alreadyClaimed).toBe(true);
    expect(claimResult.resume.id).toBe('res-claimed-1');
    expect(txMock.resumeYjsUpdate.create).toHaveBeenCalledTimes(1);

    const deleteRes = await service.softDelete('user-1', 'res-claimed-1');
    expect(deleteRes.id).toBe('res-claimed-1');
    expect(notifyDocumentDeleted).toHaveBeenCalledWith(
      'user-1',
      'res-claimed-1',
      deleteRes.deletedAt,
    );
  });
});
