import {
  CVORY_CONTRACT_VERSION,
  type LocalResumeDocument,
  type ResumeStyleSettings,
  type StyleOverrides,
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

export const RESUME_TEMPLATE_PRESETS: readonly ResumeTemplatePreset[] = [
  {
    id: "classic-single",
    name: "经典单栏",
    tagline: "左对齐姓名，靠字重区分章节，标准留白",
    scenario: "通用履历 · 清晰耐看",
    defaults: {
      font_family: "sans",
      font_size_pt: 10,
      line_height: 1.4,
      spacing: "standard",
      accent_color: "#171717",
    },
  },
  {
    id: "compact-single",
    name: "紧凑单栏",
    tagline: "日期靠右，短分隔线，收紧条目间距",
    scenario: "工作或项目条目较多",
    defaults: {
      font_family: "sans",
      font_size_pt: 9,
      line_height: 1.25,
      spacing: "compact",
      accent_color: "#1e3a5f",
    },
  },
  {
    id: "chinese-letter",
    name: "中文书简",
    tagline: "黑体标题、宋体正文，宽松留白",
    scenario: "重视连续中文阅读体验",
    defaults: {
      font_family: "serif",
      font_size_pt: 11,
      line_height: 1.5,
      spacing: "relaxed",
      accent_color: "#1f4d3a",
    },
  },
];

export function getTemplatePreset(templateId: SupportedTemplateId): ResumeTemplatePreset {
  return (
    RESUME_TEMPLATE_PRESETS.find((preset) => preset.id === templateId) ?? RESUME_TEMPLATE_PRESETS[0]
  );
}

export function resolveEffectiveStyle(
  templateId: SupportedTemplateId,
  overrides: StyleOverrides
): ResumeStyleSettings {
  const defaults = getTemplatePreset(templateId).defaults;
  return {
    font_family: overrides.font_family ?? defaults.font_family,
    font_size_pt: overrides.font_size_pt ?? defaults.font_size_pt,
    line_height: overrides.line_height ?? defaults.line_height,
    spacing: overrides.spacing ?? defaults.spacing,
    accent_color: overrides.accent_color ?? defaults.accent_color,
  };
}

export const FICTIONAL_SAMPLE_RESUME: LocalResumeDocument = {
  id: "sample-preview",
  contract_version: CVORY_CONTRACT_VERSION,
  title: "林叙白 · 全栈开发工程师（示例）",
  template_id: "classic-single",
  version: 1,
  updated_at: "2026-11-26T00:00:00.000Z",
  content: {
    basics: {
      full_name: "林叙白",
      phone: "138-0000-0192",
      email: "linxubai.sample@example.com",
      avatar_url: "",
      avatar_alignment: "right",
      gender: "男",
      age: "25",
      location: "上海",
      wechat: "linxubai_dev",
      github: "github.com/linxubai-sample",
      website: "",
      degree: "本科",
      work_years: "3年",
      expected_salary: "",
      job_status: "在职-月内到岗",
      target_role: "全栈开发工程师",
      expected_city: "上海",
      custom_fields: [],
    },
    style_overrides: {},
    sections: [
      {
        id: "sample-edu",
        type: "education",
        title: "教育经历",
        visible: true,
        rich_text_html: "",
        items: [
          {
            id: "sample-edu-1",
            title: "华东理工大学",
            subtitle: "软件工程 · 本科",
            start_month: "2018-09",
            end_month: "2022-06",
            is_current: false,
            location: "上海",
            link: "",
            content_html: "<p>主修数据结构、操作系统与分布式系统，连续两年获校级二等奖学金。</p>",
          },
        ],
      },
      {
        id: "sample-skills",
        type: "skills",
        title: "专业技能",
        visible: true,
        items: [],
        rich_text_html:
          "<ul><li><strong>前端栈：</strong>TypeScript、React、Next.js、Tailwind CSS、Radix UI、Tiptap</li><li><strong>后端与工程：</strong>Python FastAPI、PostgreSQL、Redis、Playwright、Docker 容器化部署</li></ul>",
      },
      {
        id: "sample-work",
        type: "work",
        title: "工作经历",
        visible: true,
        rich_text_html: "",
        items: [
          {
            id: "sample-work-1",
            title: "云序科技有限公司",
            subtitle: "全栈开发工程师",
            start_month: "2023-03",
            end_month: "",
            is_current: true,
            location: "上海",
            link: "",
            content_html:
              "<ul><li>主导在线文档平台架构升级，基于 <strong>FastAPI + PostgreSQL JSONB</strong> 与版本号乐观锁实现自动保存与多端续写。</li><li>搭建 Playwright 浏览器池导出管线，保证前端实时预览与导出 A4 PDF 像素级一致。</li></ul>",
          },
        ],
      },
      {
        id: "sample-projects",
        type: "projects",
        title: "项目经历",
        visible: true,
        rich_text_html: "",
        items: [
          {
            id: "sample-proj-1",
            title: "极简自定义简历工作台",
            subtitle: "核心作者",
            start_month: "2025-01",
            end_month: "2025-11",
            is_current: false,
            location: "",
            link: "",
            content_html:
              "<p>支持动态自定义模块、头像上传压缩、Markdown 互转与在线只读分享，个人简历从挑选模板到导出 PDF 全流程 5 分钟内完成。</p>",
          },
        ],
      },
    ],
  },
};
