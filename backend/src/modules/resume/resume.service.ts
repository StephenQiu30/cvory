import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Resume } from '@prisma/client';
import {
  CVORY_CONTRACT_VERSION,
  isSupportedContractVersion,
} from '../../common/contract/contract.constants.js';
import {
  decodeAndValidateYjsUpdate,
  mergePersistedYjsState,
  toBase64,
} from '../../common/yjs/yjs-state.helper.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SyncRegistryService } from '../sync/sync-registry.service.js';
import type {
  ClaimResumeDto,
  ClaimResumeResponseDto,
  CreateResumeDto,
  DeleteResumeResponseDto,
  DuplicateResumeDto,
  ResumeDetailDto,
  ResumeSummaryDto,
  UpdateResumeDto,
} from './resume.dto.js';

@Injectable()
export class ResumeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncRegistry: SyncRegistryService,
  ) {}

  async listByUser(userId: string): Promise<readonly ResumeSummaryDto[]> {
    const resumes = await this.prisma.resume.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return resumes.map((resume) => this.toSummaryDto(resume));
  }

  async getDetailByUser(userId: string, resumeId: string): Promise<ResumeDetailDto> {
    const resume = await this.findOwnedActiveResume(userId, resumeId);
    const [snapshot, updates] = await Promise.all([
      this.prisma.resumeYjsSnapshot.findUnique({ where: { resumeId: resume.id } }),
      this.prisma.resumeYjsUpdate.findMany({
        where: { resumeId: resume.id },
        orderBy: { id: 'asc' },
      }),
    ]);

    const merged = mergePersistedYjsState(
      snapshot ? new Uint8Array(snapshot.snapshotData) : null,
      updates.map((row) => new Uint8Array(row.updateData)),
    );
    const latestClientSeq = updates.length > 0 ? updates[updates.length - 1].clientSeq : 0;

    return {
      id: resume.id,
      title: resume.title,
      templateId: resume.templateId,
      contractVersion: resume.contractVersion,
      createdAt: resume.createdAt.toISOString(),
      updatedAt: resume.updatedAt.toISOString(),
      stateBase64: toBase64(merged.fullUpdate),
      stateVectorBase64: toBase64(merged.stateVector),
      latestClientSeq,
    };
  }

  async create(userId: string, input: CreateResumeDto): Promise<ResumeSummaryDto> {
    this.assertSupportedContract(input.contractVersion);

    const initialBytes = input.initialUpdateBase64
      ? decodeAndValidateYjsUpdate(input.initialUpdateBase64)
      : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const resume = await tx.resume.create({
        data: {
          userId,
          title: input.title.trim(),
          templateId: input.templateId.trim(),
          contractVersion: CVORY_CONTRACT_VERSION,
        },
      });

      if (initialBytes) {
        await tx.resumeYjsUpdate.create({
          data: {
            resumeId: resume.id,
            clientSeq: input.clientSeq ?? 1,
            updateData: Buffer.from(initialBytes),
          },
        });
      }

      return resume;
    });

    return this.toSummaryDto(created);
  }

  /**
   * Idempotently claims a single guest draft into the authenticated user's account (AC-CV-08).
   * Retrying with the same (userId, clientDraftId) after a dropped receipt returns the same resume
   * and persists any newer edits submitted while awaiting confirmation.
   */
  async claimGuestDraft(userId: string, input: ClaimResumeDto): Promise<ClaimResumeResponseDto> {
    this.assertSupportedContract(input.contractVersion);
    const updateBytes = decodeAndValidateYjsUpdate(input.initialUpdateBase64);

    return this.prisma.$transaction(async (tx) => {
      const existingClaim = await tx.resumeClaim.findUnique({
        where: {
          userId_clientDraftId: {
            userId,
            clientDraftId: input.clientDraftId.trim(),
          },
        },
        include: {
          resume: true,
        },
      });

      if (existingClaim) {
        if (existingClaim.resume.deletedAt !== null) {
          throw new GoneException({
            code: 'DOC_DELETED',
            message: '该已认领稿件已被删除',
            deletedAt: existingClaim.resume.deletedAt.toISOString(),
          });
        }

        // Persist retry payload if client continued editing during a dropped receipt.
        const latestUpdate = await tx.resumeYjsUpdate.findFirst({
          where: { resumeId: existingClaim.resumeId },
          orderBy: { id: 'desc' },
        });
        if (!latestUpdate || input.clientSeq > latestUpdate.clientSeq) {
          await tx.resumeYjsUpdate.create({
            data: {
              resumeId: existingClaim.resumeId,
              clientSeq: input.clientSeq,
              updateData: Buffer.from(updateBytes),
            },
          });
          await tx.resume.update({
            where: { id: existingClaim.resumeId },
            data: { updatedAt: new Date() },
          });
        }

        return {
          resume: this.toSummaryDto(existingClaim.resume),
          alreadyClaimed: true,
          ackedClientSeq: input.clientSeq,
        };
      }

      const resume = await tx.resume.create({
        data: {
          userId,
          title: input.title.trim(),
          templateId: input.templateId.trim(),
          contractVersion: CVORY_CONTRACT_VERSION,
        },
      });

      await tx.resumeClaim.create({
        data: {
          userId,
          clientDraftId: input.clientDraftId.trim(),
          resumeId: resume.id,
        },
      });

      await tx.resumeYjsUpdate.create({
        data: {
          resumeId: resume.id,
          clientSeq: input.clientSeq,
          updateData: Buffer.from(updateBytes),
        },
      });

      return {
        resume: this.toSummaryDto(resume),
        alreadyClaimed: false,
        ackedClientSeq: input.clientSeq,
      };
    });
  }

  async updateMetadata(
    userId: string,
    resumeId: string,
    input: UpdateResumeDto,
  ): Promise<ResumeSummaryDto> {
    this.assertSupportedContract(input.contractVersion);
    await this.findOwnedActiveResume(userId, resumeId);

    const updated = await this.prisma.resume.update({
      where: { id: resumeId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.templateId !== undefined ? { templateId: input.templateId.trim() } : {}),
      },
    });
    return this.toSummaryDto(updated);
  }

  /**
   * Duplicates a resume by projecting its latest persisted Yjs state into a brand-new independent document.
   */
  async duplicate(
    userId: string,
    sourceResumeId: string,
    input: DuplicateResumeDto,
  ): Promise<ResumeSummaryDto> {
    const source = await this.findOwnedActiveResume(userId, sourceResumeId);
    const [snapshot, updates] = await Promise.all([
      this.prisma.resumeYjsSnapshot.findUnique({ where: { resumeId: source.id } }),
      this.prisma.resumeYjsUpdate.findMany({
        where: { resumeId: source.id },
        orderBy: { id: 'asc' },
      }),
    ]);

    const merged = mergePersistedYjsState(
      snapshot ? new Uint8Array(snapshot.snapshotData) : null,
      updates.map((row) => new Uint8Array(row.updateData)),
    );

    const copyTitle = input.title?.trim() || `${source.title}（副本）`;

    const duplicated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.resume.create({
        data: {
          userId,
          title: copyTitle,
          templateId: source.templateId,
          contractVersion: CVORY_CONTRACT_VERSION,
        },
      });

      await tx.resumeYjsSnapshot.create({
        data: {
          resumeId: created.id,
          stateVector: Buffer.from(merged.stateVector),
          snapshotData: Buffer.from(merged.fullUpdate),
        },
      });

      return created;
    });

    return this.toSummaryDto(duplicated);
  }

  /**
   * Soft-deletes a resume (tombstone) and immediately notifies all connected devices for that user.
   */
  async softDelete(userId: string, resumeId: string): Promise<DeleteResumeResponseDto> {
    await this.findOwnedActiveResume(userId, resumeId);
    const deletedAt = new Date();

    await this.prisma.resume.update({
      where: { id: resumeId },
      data: { deletedAt },
    });

    const deletedAtIso = deletedAt.toISOString();
    this.syncRegistry.notifyDocumentDeleted(userId, resumeId, deletedAtIso);

    return {
      id: resumeId,
      deletedAt: deletedAtIso,
    };
  }

  private async findOwnedActiveResume(userId: string, resumeId: string): Promise<Resume> {
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
    });

    if (!resume) {
      throw new NotFoundException('简历稿件不存在');
    }
    if (resume.userId !== userId) {
      throw new ForbiddenException('无权访问该简历稿件');
    }
    if (resume.deletedAt !== null) {
      throw new GoneException({
        code: 'DOC_DELETED',
        message: '该简历稿件已被删除',
        deletedAt: resume.deletedAt.toISOString(),
      });
    }
    return resume;
  }

  private assertSupportedContract(version: number): void {
    if (!isSupportedContractVersion(version)) {
      throw new BadRequestException({
        code: 'CONTRACT_UNSUPPORTED',
        message: `不支持的契约版本：${version}，当前仅支持版本 ${CVORY_CONTRACT_VERSION}`,
      });
    }
  }

  private toSummaryDto(resume: Resume): ResumeSummaryDto {
    return {
      id: resume.id,
      title: resume.title,
      templateId: resume.templateId,
      contractVersion: resume.contractVersion,
      createdAt: resume.createdAt.toISOString(),
      updatedAt: resume.updatedAt.toISOString(),
    };
  }
}
