import {
  CVORY_CONTRACT_VERSION,
  type ResumeSectionId,
  type ResumeSnapshot,
  type ResumeStyleOverrides,
  type ResumeStyleSettings,
  type SupportedTemplateId,
} from "@/lib/contract/contract";

export interface ResumeTemplatePreset {
  readonly id: SupportedTemplateId;
  readonly name: string;
  readonly tagline: string;
  readonly scenario: string;
  readonly defaults: ResumeStyleSettings;
}

export const ACCENT_COLOR_PRESETS = [
  { name: "墨黑", value: "#171717" },
  { name: "石板蓝", value: "#1e3a5f" },
  { name: "深松绿", value: "#1f4d3a" },
  { name: "暖岩棕", value: "#5c4033" },
  { name: "深靛蓝", value: "#2c3e75" },
] as const;

export const SECTION_LABELS: Record<ResumeSectionId, string> = {
  basics: "基本信息",
  education: "教育经历",
  work: "工作经历",
  projects: "项目经历",
  skills: "专业技能",
};

export const RESUME_TEMPLATE_PRESETS: readonly ResumeTemplatePreset[] = [
  {
    id: "classic-single",
    name: "经典单栏",
    tagline: "左对齐姓名，靠字重区分章节，标准留白",
    scenario: "通用履历 · 清晰耐看",
    defaults: {
      fontFamily: "sans",
      fontSizePt: 10,
      lineHeight: 1.4,
      spacing: "standard",
      accentColor: "#171717",
    },
  },
  {
    id: "compact-single",
    name: "紧凑单栏",
    tagline: "日期靠右，短分隔线，收紧条目间距",
    scenario: "工作或项目条目较多",
    defaults: {
      fontFamily: "sans",
      fontSizePt: 9,
      lineHeight: 1.25,
      spacing: "compact",
      accentColor: "#1e3a5f",
    },
  },
  {
    id: "chinese-letter",
    name: "中文书简",
    tagline: "黑体标题、宋体正文，宽松留白",
    scenario: "重视连续中文阅读体验",
    defaults: {
      fontFamily: "serif",
      fontSizePt: 11,
      lineHeight: 1.5,
      spacing: "relaxed",
      accentColor: "#1f4d3a",
    },
  },
];

export function getTemplatePreset(templateId: SupportedTemplateId): ResumeTemplatePreset {
  return (
    RESUME_TEMPLATE_PRESETS.find((preset) => preset.id === templateId) ?? RESUME_TEMPLATE_PRESETS[0]
  );
}

/**
 * Resolves effective style settings: user overrides take precedence; unset keys follow active template (AC-CV-10).
 */
export function resolveEffectiveStyle(
  templateId: SupportedTemplateId,
  overrides: ResumeStyleOverrides
): ResumeStyleSettings {
  const defaults = getTemplatePreset(templateId).defaults;
  return {
    fontFamily: overrides.fontFamily ?? defaults.fontFamily,
    fontSizePt: overrides.fontSizePt ?? defaults.fontSizePt,
    lineHeight: overrides.lineHeight ?? defaults.lineHeight,
    spacing: overrides.spacing ?? defaults.spacing,
    accentColor: overrides.accentColor ?? defaults.accentColor,
  };
}

/**
 * Shared fictional Chinese resume sample for side-by-side comparison across all 3 templates (AC-CV-01).
 * Never copied into user's created draft.
 */
export const FICTIONAL_SAMPLE_RESUME: ResumeSnapshot = {
  id: "sample-preview",
  contractVersion: CVORY_CONTRACT_VERSION,
  title: "林之遥 · 产品设计师（示例）",
  templateId: "classic-single",
  sectionOrder: ["basics", "education", "work", "projects", "skills"],
  hiddenSections: [],
  styleOverrides: {},
  basics: {
    fullName: "林之遥",
    targetRole: "产品设计师",
    phone: "138 0000 0000",
    email: "lin@example.com",
    location: "杭州",
    wechat: "",
    github: "",
    website: "",
    portfolio: "",
    visibleOptionalFields: [],
  },
  education: [
    {
      id: "sample-edu-1",
      school: "江南艺术学院",
      majorOrDegree: "视觉传达设计 · 本科",
      startMonth: "2018-09",
      endMonth: "2022-06",
      isCurrent: false,
      notes: "信息设计、用户研究与数字产品设计。",
    },
  ],
  work: [
    {
      id: "sample-work-1",
      organization: "向野设计工作室",
      role: "产品设计师",
      startMonth: "2022-07",
      endMonth: "",
      isCurrent: true,
      descriptionHtml:
        "<p>负责协作产品的体验设计，推进需求梳理、原型验证和交付。梳理创建设计流程，整合多处设置到同一操作面板。</p>",
    },
  ],
  projects: [
    {
      id: "sample-proj-1",
      organization: "知行笔记",
      role: "核心设计",
      startMonth: "2023-03",
      endMonth: "2024-08",
      isCurrent: false,
      descriptionHtml: "<p>设计标签、检索和内容管理，验证移动端整理流程。</p>",
    },
  ],
  skillsHtml: "<p>交互设计、信息架构、用户研究、Figma、原型验证</p>",
  updatedAt: "2026-11-24T00:00:00.000Z",
};
