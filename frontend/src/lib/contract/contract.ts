import { z } from "zod";

/**
 * Single active data & sync contract version (NFR-CV-03).
 * Unsupported formats are rejected before write; no backward compatibility is maintained.
 */
export const CVORY_CONTRACT_VERSION = 1 as const;

export const SUPPORTED_TEMPLATE_IDS = [
  "classic-single",
  "compact-single",
  "chinese-letter",
] as const;

export type SupportedTemplateId = (typeof SUPPORTED_TEMPLATE_IDS)[number];

export const RESUME_SECTION_IDS = ["basics", "education", "work", "projects", "skills"] as const;

export type ResumeSectionId = (typeof RESUME_SECTION_IDS)[number];

export const OPTIONAL_BASICS_FIELDS = ["wechat", "github", "website", "portfolio"] as const;
export type OptionalBasicsField = (typeof OPTIONAL_BASICS_FIELDS)[number];

export type ResumeFontFamily = "sans" | "serif";
export type ResumeSpacingPreset = "compact" | "standard" | "relaxed";

export interface ResumeStyleSettings {
  readonly fontFamily: ResumeFontFamily;
  readonly fontSizePt: 9 | 10 | 11 | 12;
  readonly lineHeight: 1.25 | 1.4 | 1.5 | 1.65;
  readonly spacing: ResumeSpacingPreset;
  readonly accentColor: string;
}

export type ResumeStyleOverrides = Partial<ResumeStyleSettings>;

export interface BasicsData {
  readonly fullName: string;
  readonly targetRole: string;
  readonly phone: string;
  readonly email: string;
  readonly location: string;
  readonly wechat: string;
  readonly github: string;
  readonly website: string;
  readonly portfolio: string;
  readonly visibleOptionalFields: readonly OptionalBasicsField[];
}

export interface EducationItem {
  readonly id: string;
  readonly school: string;
  readonly majorOrDegree: string;
  readonly startMonth: string;
  readonly endMonth: string;
  readonly isCurrent: boolean;
  readonly notes: string;
}

export interface ExperienceItem {
  readonly id: string;
  readonly organization: string;
  readonly role: string;
  readonly startMonth: string;
  readonly endMonth: string;
  readonly isCurrent: boolean;
  /** Rich HTML projected from Tiptap / Y.XmlFragment for preview & PDF mapping */
  readonly descriptionHtml: string;
}

export interface ResumeSnapshot {
  readonly id: string;
  readonly contractVersion: 1;
  readonly title: string;
  readonly templateId: SupportedTemplateId;
  readonly sectionOrder: readonly ResumeSectionId[];
  readonly hiddenSections: readonly ResumeSectionId[];
  readonly styleOverrides: ResumeStyleOverrides;
  readonly basics: BasicsData;
  readonly education: readonly EducationItem[];
  readonly work: readonly ExperienceItem[];
  readonly projects: readonly ExperienceItem[];
  readonly skillsHtml: string;
  readonly updatedAt: string;
}

export const localDraftIndexEntrySchema = z.object({
  id: z.string().min(1),
  contractVersion: z.literal(CVORY_CONTRACT_VERSION),
  title: z.string().min(1),
  templateId: z.enum(SUPPORTED_TEMPLATE_IDS),
  updatedAt: z.string().min(1),
  remoteResumeId: z.string().optional(),
});

export type LocalDraftIndexEntry = z.infer<typeof localDraftIndexEntrySchema>;

export function isSupportedContractVersion(version: unknown): version is 1 {
  return version === CVORY_CONTRACT_VERSION;
}

export function isDateRangeInverted(
  startMonth: string,
  endMonth: string,
  isCurrent: boolean
): boolean {
  if (isCurrent) {
    return false;
  }
  const start = startMonth.trim();
  const end = endMonth.trim();
  if (!start || !end) {
    return false;
  }
  return end < start;
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether the resume has at least one visible non-whitespace content field (AC-CV-05).
 */
export function hasVisibleResumeContent(snapshot: ResumeSnapshot): boolean {
  const hidden = new Set(snapshot.hiddenSections);

  if (!hidden.has("basics")) {
    const b = snapshot.basics;
    if (
      b.fullName.trim() ||
      b.targetRole.trim() ||
      b.phone.trim() ||
      b.email.trim() ||
      b.location.trim()
    ) {
      return true;
    }
    for (const field of b.visibleOptionalFields) {
      if (b[field].trim()) {
        return true;
      }
    }
  }

  if (!hidden.has("education")) {
    for (const item of snapshot.education) {
      if (item.school.trim() || item.majorOrDegree.trim() || item.notes.trim()) {
        return true;
      }
    }
  }

  if (!hidden.has("work")) {
    for (const item of snapshot.work) {
      if (item.organization.trim() || item.role.trim() || stripHtmlToText(item.descriptionHtml)) {
        return true;
      }
    }
  }

  if (!hidden.has("projects")) {
    for (const item of snapshot.projects) {
      if (item.organization.trim() || item.role.trim() || stripHtmlToText(item.descriptionHtml)) {
        return true;
      }
    }
  }

  if (!hidden.has("skills") && stripHtmlToText(snapshot.skillsHtml)) {
    return true;
  }

  return false;
}

export function createEmptyBasics(): BasicsData {
  return {
    fullName: "",
    targetRole: "",
    phone: "",
    email: "",
    location: "",
    wechat: "",
    github: "",
    website: "",
    portfolio: "",
    visibleOptionalFields: [],
  };
}
