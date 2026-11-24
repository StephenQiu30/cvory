import { BadRequestException } from '@nestjs/common';
import * as Y from 'yjs';

const MAX_YJS_UPDATE_BYTES = 2 * 1024 * 1024; // 2 MiB per update frame

/**
 * Decodes a base64 Yjs update and verifies it can be applied to a fresh Y.Doc.
 */
export function decodeAndValidateYjsUpdate(updateBase64: string): Uint8Array {
  const trimmed = updateBase64.trim();
  if (!trimmed) {
    throw new BadRequestException('Yjs update payload must not be empty');
  }

  const buffer = Buffer.from(trimmed, 'base64');
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_YJS_UPDATE_BYTES) {
    throw new BadRequestException('Yjs update payload size is out of bounds');
  }

  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const probeDoc = new Y.Doc();
  try {
    Y.applyUpdate(probeDoc, bytes);
  } catch {
    throw new BadRequestException('Invalid Yjs binary update payload');
  } finally {
    probeDoc.destroy();
  }

  return bytes;
}

export function decodeBase64StateVector(stateVectorBase64: string): Uint8Array {
  const buffer = Buffer.from(stateVectorBase64.trim(), 'base64');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export interface MergedYjsState {
  readonly fullUpdate: Uint8Array;
  readonly stateVector: Uint8Array;
  readonly diffUpdate: Uint8Array;
}

/**
 * Reconstructs a Y.Doc from persisted snapshot + incremental updates and computes
 * both the full merged state and an optional diff against a client's state vector.
 */
export function mergePersistedYjsState(
  snapshotData: Uint8Array | null,
  updates: readonly Uint8Array[],
  clientStateVector?: Uint8Array,
): MergedYjsState {
  const doc = new Y.Doc();
  try {
    if (snapshotData && snapshotData.byteLength > 0) {
      Y.applyUpdate(doc, snapshotData);
    }
    for (const update of updates) {
      if (update.byteLength > 0) {
        Y.applyUpdate(doc, update);
      }
    }

    const fullUpdate = Y.encodeStateAsUpdate(doc);
    const stateVector = Y.encodeStateVector(doc);
    const diffUpdate =
      clientStateVector && clientStateVector.byteLength > 0
        ? Y.encodeStateAsUpdate(doc, clientStateVector)
        : fullUpdate;

    return { fullUpdate, stateVector, diffUpdate };
  } finally {
    doc.destroy();
  }
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}
