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
  title: "林叙白 · 前端工程师（示例）",
  templateId: "classic-single",
  sectionOrder: ["basics", "education", "work", "projects", "skills"],
  hiddenSections: [],
  styleOverrides: {},
  basics: {
    fullName: "林叙白",
    targetRole: "高级前端工程师",
    phone: "138-0000-0192",
    email: "linxubai.sample@example.com",
    location: "上海",
    wechat: "",
    github: "github.com/linxubai-sample",
    website: "",
    portfolio: "",
    visibleOptionalFields: ["github"],
  },
  education: [
    {
      id: "sample-edu-1",
      school: "华东理工大学",
      majorOrDegree: "软件工程 · 本科",
      startMonth: "2017-09",
      endMonth: "2021-06",
      isCurrent: false,
      notes: "主修数据结构、编译原理与人机交互，连续两年获校级二等奖学金。",
    },
  ],
  work: [
    {
      id: "sample-work-1",
      organization: "云序科技有限公司",
      role: "前端工程师 · 协作文档团队",
      startMonth: "2023-03",
      endMonth: "",
      isCurrent: true,
      descriptionHtml:
        "<ul><li>主导离线优先编辑器架构升级，基于 <strong>Yjs + IndexedDB</strong> 实现断网续写与多端自动合并，文档丢失反馈归零。</li><li>重构 PDF 导出管线，统一预览与下载产物，解决中文长段断行截断问题，导出耗时降低 42%。</li></ul>",
    },
    {
      id: "sample-work-2",
      organization: "星帆数据技术有限公司",
      role: "前端开发工程师",
      startMonth: "2021-07",
      endMonth: "2023-02",
      isCurrent: false,
      descriptionHtml:
        "<ul><li>负责设计系统与无障碍键盘交互建设，封装 24 个 Radix 基础控件，首屏 LCP 稳定在 1.2s 以内。</li></ul>",
    },
  ],
  projects: [
    {
      id: "sample-proj-1",
      organization: "极简文档排版引擎",
      role: "核心作者",
      startMonth: "2024-01",
      endMonth: "2024-11",
      isCurrent: false,
      descriptionHtml:
        "<p>面向中文求职履历的纯浏览器排版方案，支持 A4 自动分页、章标题跟随首行与点击纸面反查表单条目。</p>",
    },
  ],
  skillsHtml:
    "<p><strong>核心栈：</strong>TypeScript、React、Next.js、Tailwind CSS、Radix UI、Yjs、Tiptap</p><p><strong>工程能力：</strong>Web Worker 性能优化、PWA 离线缓存、Playwright 端到端测试、Docker 容器化部署</p>",
  updatedAt: "2026-11-24T00:00:00.000Z",
};
