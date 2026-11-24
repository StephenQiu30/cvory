/**
 * Single active data & sync contract version (NFR-CV-03).
 * No backward compatibility is maintained; unsupported versions are rejected before write.
 */
export const CVORY_CONTRACT_VERSION = 1 as const;

export function isSupportedContractVersion(version: unknown): version is 1 {
  return version === CVORY_CONTRACT_VERSION;
}
