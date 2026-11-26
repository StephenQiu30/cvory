import { z } from "zod";

/**
 * Single active modular resume contract (1:1 aligned with backend/app/core/contract.py).
 * Unsupported contract versions are rejected; no backward compatibility is maintained.
 */
export const CVORY_CONTRACT_VERSION = 1 as const;

export const SUPPORTED_TEMPLATE_IDS = [
  "classic-single",
  "compact-single",
  "chinese-letter",
] as const;

export type SupportedTemplateId = (typeof SUPPORTED_TEMPLATE_IDS)[number];

export const RESUME_SECTION_TYPES = [
  "education",
  "work",
  "projects",
  "skills",
  "campus",
  "awards",
  "other",
  "research",
  "portfolio",
  "summary",
  "custom",
] as const;

export type ResumeSectionType = (typeof RESUME_SECTION_TYPES)[number];
export type AvatarAlignment = "left" | "right" | "hidden";
export type ResumeFontFamily = "sans" | "serif";
export type ResumeSpacingPreset = "compact" | "standard" | "relaxed";

export interface CustomFieldItem {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly visible: boolean;
}

export interface BasicsSection {
  readonly full_name: string;
  readonly phone: string;
  readonly email: string;
  readonly avatar_url: string;
  readonly avatar_alignment: AvatarAlignment;
  readonly gender: string;
  readonly age: string;
  readonly location: string;
  readonly wechat: string;
  readonly github: string;
  readonly website: string;
  readonly degree: string;
  readonly work_years: string;
  readonly expected_salary: string;
  readonly job_status: string;
  readonly target_role: string;
  readonly expected_city: string;
  readonly custom_fields: readonly CustomFieldItem[];
}

export interface ResumeSectionItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly start_month: string;
  readonly end_month: string;
  readonly is_current: boolean;
  readonly location: string;
  readonly link: string;
  readonly content_html: string;
}

export interface ResumeSection {
  readonly id: string;
  readonly type: ResumeSectionType;
  readonly title: string;
  readonly visible: boolean;
  readonly items: readonly ResumeSectionItem[];
  readonly rich_text_html: string;
}

export interface StyleOverrides {
  readonly font_family?: ResumeFontFamily | null;
  readonly font_size_pt?: 9 | 10 | 11 | 12 | null;
  readonly line_height?: number | null;
  readonly spacing?: ResumeSpacingPreset | null;
  readonly accent_color?: string | null;
}

export interface ResumeStyleSettings {
  readonly font_family: ResumeFontFamily;
  readonly font_size_pt: 9 | 10 | 11 | 12;
  readonly line_height: number;
  readonly spacing: ResumeSpacingPreset;
  readonly accent_color: string;
}

export interface ResumeContent {
  readonly basics: BasicsSection;
  readonly style_overrides: StyleOverrides;
  readonly sections: readonly ResumeSection[];
}

export interface LocalResumeDocument {
  readonly id: string;
  readonly contract_version: 1;
  readonly title: string;
  readonly template_id: SupportedTemplateId;
  readonly version: number;
  readonly remote_id?: string;
  readonly share_enabled?: boolean;
  readonly share_token?: string | null;
  readonly content: ResumeContent;
  readonly updated_at: string;
}

export const resumeJsonBackupSchema = z.object({
  contract_version: z.literal(CVORY_CONTRACT_VERSION),
  title: z.string().min(1).max(120),
  template_id: z.enum(SUPPORTED_TEMPLATE_IDS),
  content: z.object({
    basics: z.object({
      full_name: z.string().default(""),
      phone: z.string().default(""),
      email: z.string().default(""),
      avatar_url: z.string().default(""),
      avatar_alignment: z.enum(["left", "right", "hidden"]).default("right"),
      gender: z.string().default(""),
      age: z.string().default(""),
      location: z.string().default(""),
      wechat: z.string().default(""),
      github: z.string().default(""),
      website: z.string().default(""),
      degree: z.string().default(""),
      work_years: z.string().default(""),
      expected_salary: z.string().default(""),
      job_status: z.string().default(""),
      target_role: z.string().default(""),
      expected_city: z.string().default(""),
      custom_fields: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            value: z.string().default(""),
            visible: z.boolean().default(true),
          })
        )
        .default([]),
    }),
    style_overrides: z
      .object({
        font_family: z.enum(["sans", "serif"]).nullable().optional(),
        font_size_pt: z
          .union([z.literal(9), z.literal(10), z.literal(11), z.literal(12)])
          .nullable()
          .optional(),
        line_height: z.number().min(1.1).max(2.0).nullable().optional(),
        spacing: z.enum(["compact", "standard", "relaxed"]).nullable().optional(),
        accent_color: z.string().nullable().optional(),
      })
      .default({}),
    sections: z.array(
      z.object({
        id: z.string().min(1),
        type: z.enum(RESUME_SECTION_TYPES),
        title: z.string().min(1),
        visible: z.boolean().default(true),
        items: z
          .array(
            z.object({
              id: z.string().min(1),
              title: z.string().default(""),
              subtitle: z.string().default(""),
              start_month: z.string().default(""),
              end_month: z.string().default(""),
              is_current: z.boolean().default(false),
              location: z.string().default(""),
              link: z.string().default(""),
              content_html: z.string().default(""),
            })
          )
          .default([]),
        rich_text_html: z.string().default(""),
      })
    ),
  }),
});

export type ResumeJsonBackup = z.infer<typeof resumeJsonBackupSchema>;

export function isRichTextOnlySection(type: ResumeSectionType): boolean {
  return type === "skills" || type === "summary";
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

export function hasVisibleResumeContent(content: ResumeContent): boolean {
  const b = content.basics;
  if (
    b.full_name.trim() ||
    b.phone.trim() ||
    b.email.trim() ||
    b.target_role.trim() ||
    b.custom_fields.some((f) => f.visible && f.value.trim())
  ) {
    return true;
  }
  for (const sec of content.sections) {
    if (!sec.visible) {
      continue;
    }
    if (stripHtmlToText(sec.rich_text_html)) {
      return true;
    }
    for (const item of sec.items) {
      if (item.title.trim() || item.subtitle.trim() || stripHtmlToText(item.content_html)) {
        return true;
      }
    }
  }
  return false;
}

export function createEmptyBasics(): BasicsSection {
  return {
    full_name: "",
    phone: "",
    email: "",
    avatar_url: "",
    avatar_alignment: "right",
    gender: "",
    age: "",
    location: "",
    wechat: "",
    github: "",
    website: "",
    degree: "",
    work_years: "",
    expected_salary: "",
    job_status: "",
    target_role: "",
    expected_city: "",
    custom_fields: [],
  };
}

export function createDefaultSections(): readonly ResumeSection[] {
  return [
    {
      id: "sec-education",
      type: "education",
      title: "教育经历",
      visible: true,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-skills",
      type: "skills",
      title: "专业技能",
      visible: true,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-work",
      type: "work",
      title: "工作经历",
      visible: true,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-projects",
      type: "projects",
      title: "项目经历",
      visible: true,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-campus",
      type: "campus",
      title: "大学信息",
      visible: false,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-awards",
      type: "awards",
      title: "荣誉奖项",
      visible: false,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-other",
      type: "other",
      title: "其他经历",
      visible: false,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-research",
      type: "research",
      title: "研究经历",
      visible: false,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-portfolio",
      type: "portfolio",
      title: "作品集",
      visible: false,
      items: [],
      rich_text_html: "",
    },
    {
      id: "sec-summary",
      type: "summary",
      title: "个人简介",
      visible: false,
      items: [],
      rich_text_html: "",
    },
  ];
}

export function createEmptyResumeContent(): ResumeContent {
  return {
    basics: createEmptyBasics(),
    style_overrides: {},
    sections: createDefaultSections(),
  };
}
