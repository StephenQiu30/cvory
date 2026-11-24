/**
 * Single active data & sync contract version (NFR-CV-03).
 * Unsupported formats are rejected before write; no backward compatibility is maintained.
 */
export const CVORY_CONTRACT_VERSION = 1 as const;

export function isSupportedContractVersion(version: unknown): version is 1 {
  return version === CVORY_CONTRACT_VERSION;
}
