import { z } from 'zod';

export const clientSyncMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('AUTH'),
    accessToken: z.string().min(1),
  }),
  z.object({
    type: z.literal('JOIN'),
    resumeId: z.string().min(1),
    contractVersion: z.number().int(),
    stateVectorBase64: z.string().optional(),
  }),
  z.object({
    type: z.literal('UPDATE'),
    resumeId: z.string().min(1),
    contractVersion: z.number().int(),
    clientSeq: z.number().int().nonnegative(),
    updateBase64: z.string().min(1),
  }),
  z.object({
    type: z.literal('LEAVE'),
    resumeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('PING'),
  }),
]);

export type ClientSyncMessage = z.infer<typeof clientSyncMessageSchema>;

export type SyncErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONTRACT_UNSUPPORTED'
  | 'INVALID_MESSAGE'
  | 'INVALID_UPDATE'
  | 'NOT_JOINED'
  | 'INTERNAL_ERROR';

export type ServerSyncMessage =
  | { readonly type: 'AUTH_OK'; readonly userId: string }
  | {
      readonly type: 'SYNC_STATE';
      readonly resumeId: string;
      readonly updateBase64: string;
      readonly stateVectorBase64: string;
      readonly latestClientSeq: number;
    }
  | {
      readonly type: 'ACK';
      readonly resumeId: string;
      readonly clientSeq: number;
      readonly serverTimestamp: string;
    }
  | {
      readonly type: 'REMOTE_UPDATE';
      readonly resumeId: string;
      readonly updateBase64: string;
      readonly clientSeq: number;
    }
  | {
      readonly type: 'DOC_DELETED';
      readonly resumeId: string;
      readonly deletedAt: string;
    }
  | {
      readonly type: 'ERROR';
      readonly code: SyncErrorCode;
      readonly message: string;
      readonly resumeId?: string;
    }
  | { readonly type: 'PONG' };
