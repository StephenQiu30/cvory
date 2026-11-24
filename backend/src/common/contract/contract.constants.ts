/**
 * Single active data & sync contract version (NFR-CV-03).
 * No backward compatibility is maintained; unsupported versions are rejected before write.
 */
export const CVORY_CONTRACT_VERSION = 1 as const;

export const SUPPORTED_TEMPLATE_IDS = [
  'classic-single',
  'compact-single',
  'chinese-letter',
] as const;

export type SupportedTemplateId = (typeof SUPPORTED_TEMPLATE_IDS)[number];

export function isSupportedContractVersion(version: unknown): version is 1 {
  return version === CVORY_CONTRACT_VERSION;
}

export function isSupportedTemplateId(templateId: unknown): templateId is SupportedTemplateId {
  return (
    typeof templateId === 'string' &&
    (SUPPORTED_TEMPLATE_IDS as readonly string[]).includes(templateId)
  );
}
