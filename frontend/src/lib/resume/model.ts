import {
  BriefcaseBusiness,
  FolderCode,
  GraduationCap,
  UserRound,
  Wrench,
  FileText,
} from "lucide-react";
import type {
  Section,
  SectionItem,
  StyleSettings,
  ResumeData,
} from "@/lib/api/types";
export const MODULES = [
  { type: "summary", title: "个人简介", icon: UserRound },
  { type: "experience", title: "工作经历", icon: BriefcaseBusiness },
  { type: "project", title: "项目经历", icon: FolderCode },
  { type: "education", title: "教育经历", icon: GraduationCap },
  { type: "skill", title: "专业技能", icon: Wrench },
  { type: "custom", title: "补充信息", icon: FileText },
] as const;
export const TEMPLATES = [
  { id: "standard", title: "标准单栏", detail: "清晰的层次，均衡的留白" },
  { id: "compact", title: "紧凑单栏", detail: "收紧间距，适合更丰富的经历" },
  { id: "timeline", title: "时间索引", detail: "日期索引，突出经历脉络" },
] as const;
export const DEFAULT_STYLE: StyleSettings = {
  templateId: "standard",
  accent: "ink",
  fontSize: 14,
  lineHeight: 1.52,
  margin: 40,
};
export const ACCENTS = {
  ink: "#171717",
  blue: "#1D4ED8",
  graphite: "#475569",
} as const;
export function blankItem(): SectionItem {
  return {
    id: crypto.randomUUID(),
    title: "",
    subtitle: "",
    dateRange: "",
    location: "",
    description: null,
    tags: [],
    startDate: "",
    endDate: "",
    current: false,
    degree: "",
    educationType: "",
    department: "",
    link: "",
  };
}
export function dateLabel(item: SectionItem, type: string) {
  if (!item.startDate && !item.endDate && !item.current)
    return item.dateRange || "";
  return [
    item.startDate?.replace("-", "."),
    item.current
      ? type === "education"
        ? "在读"
        : "至今"
      : item.endDate?.replace("-", "."),
  ]
    .filter(Boolean)
    .join(" — ");
}
export function safeLink(value?: string | null) {
  if (!value?.trim()) return undefined;
  const candidate = value.includes(":") ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: string; content?: unknown[] };
  return node.text ?? node.content?.map(textContent).join(" ") ?? "";
}
export function visibleSections(sections: Section[]) {
  return sections.filter(
    (s) =>
      s.visible !== false &&
      (textContent(s.content).trim() ||
        s.items?.some((i) =>
          [i.title, i.subtitle, i.degree, textContent(i.description)].some(
            (v) => v?.trim(),
          ),
        )),
  );
}
export function editable(data: ResumeData & { displayName: string }) {
  return {
    displayName: data.displayName,
    profile: data.profile,
    sections: data.sections,
    styleSettings: data.styleSettings,
  };
}
