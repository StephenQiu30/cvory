import { z } from "zod";
import type { CreateCVRequest, ResumeData, Section } from "@/lib/api/types";
import { DEFAULT_STYLE, textContent } from "./model";
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export async function parseMarkdown(text: string): Promise<CreateCVRequest> {
  if (!text.trim()) throw Error("文件中没有文字。");
  if (new Blob([text]).size > MAX_IMPORT_BYTES)
    throw Error("文件超过 10 MB，请选择较小的文件。");
  const { parseBodyMarkdown } = await import("./body-markdown");
  const sections: Section[] = [];
  let name = "";
  let headline = "";
  let current: Section | undefined;
  let lines: string[] = [];
  const flush = () => {
    if (current) current.content = parseBodyMarkdown(lines.join("\n"));
    lines = [];
  };
  const start = (title: string, type: Section["type"]) => {
    flush();
    current = {
      id: crypto.randomUUID(),
      type,
      title,
      visible: true,
      items: [],
      content: null,
    };
    sections.push(current);
    if (sections.length > 100) throw Error("模块超过 100 个，请精简后导入。");
  };
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("# ") && !name && !current) {
      name = line.slice(2).trim();
      continue;
    }
    if (/^## /.test(line)) {
      start(line.slice(3).trim(), "custom");
      continue;
    }
    if (!current && !line.trim()) continue;
    if (!current && name && !headline) {
      headline = line;
      continue;
    }
    if (!current) start("个人简介", "summary");
    lines.push(/^### /.test(line) ? `**${line.slice(4)}**` : line);
  }
  flush();
  return {
    displayName: name || "导入的简历",
    profile: { fullName: name, headline },
    sections,
    styleSettings: DEFAULT_STYLE,
  };
}
const itemSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  dateRange: z.string().optional(),
  location: z.string().optional(),
  description: z.unknown().optional(),
  tags: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  degree: z.string().optional(),
  educationType: z.string().optional(),
  department: z.string().optional(),
  link: z.string().optional(),
});
const profileSchema = z.object({
  fullName: z.string().optional(),
  headline: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  github: z.string().optional(),
  wechat: z.string().optional(),
  jobStatus: z.string().optional(),
  expectedLocation: z.string().optional(),
  experienceYears: z.string().optional(),
  expectedSalary: z.string().optional(),
  hiddenFields: z.array(z.string()).optional(),
  photoHidden: z.boolean().optional(),
  photoPosition: z.enum(["left", "right"]).optional(),
  photoX: z.number().min(0).max(100).optional(),
  photoY: z.number().min(0).max(100).optional(),
  photoScale: z.number().min(1).max(3).optional(),
});
const backupSchema = z.object({
  format: z.literal("cvory"),
  version: z.literal(1),
  document: z.object({
    displayName: z.string().min(1).max(255),
    profile: profileSchema,
    sections: z
      .array(
        z.object({
          id: z.string().min(1),
          type: z.enum([
            "summary",
            "experience",
            "education",
            "project",
            "skill",
            "custom",
          ]),
          title: z.string(),
          visible: z.boolean().optional(),
          content: z.unknown().optional(),
          items: z.array(itemSchema).optional(),
        }),
      )
      .max(100),
    styleSettings: z.object({
      templateId: z.enum(["standard", "compact", "timeline"]).optional(),
      accent: z.enum(["ink", "blue", "graphite"]).optional(),
      fontSize: z.number().min(12).max(20).optional(),
      lineHeight: z.number().min(1.2).max(2).optional(),
      margin: z.number().min(12).max(48).optional(),
    }),
  }),
});
export function parseBackup(text: string): CreateCVRequest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw Error("JSON 文件已损坏，请重新选择。");
  }
  const pending: { value: unknown; depth: number }[] = [
    { value: raw, depth: 0 },
  ];
  let nodes = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (depth > 24 || ++nodes > 50000)
      throw Error("文件内容过于复杂，请精简后重试。");
    if (value && typeof value === "object")
      for (const child of Object.values(value))
        pending.push({ value: child, depth: depth + 1 });
  }
  const result = backupSchema.safeParse(raw);
  if (!result.success)
    throw Error("备份格式或版本不受支持，请使用完整的 CVory v1 JSON。");
  return result.data.document;
}

export async function markdown(document: ResumeData) {
  const { bodyMarkdown: richMarkdown } = await import("./body-markdown");
  const p = document.profile;
  return [
    `# ${p.fullName || ""}`,
    p.headline || "",
    ...(["email", "phone", "location", "website", "github"] as const)
      .filter((key) => !p.hiddenFields?.includes(key))
      .map((key) => p[key])
      .filter(Boolean),
    ...document.sections
      .filter((s) => s.visible !== false)
      .flatMap((s) => [
        `## ${s.title}`,
        richMarkdown(s.content),
        ...(s.items ?? []).flatMap((i) => [
          `### ${i.title ?? ""}`,
          [
            i.subtitle,
            i.degree,
            i.department,
            i.dateRange,
            i.startDate,
            i.current ? "至今" : i.endDate,
            i.link,
          ]
            .filter(Boolean)
            .join(" · "),
          richMarkdown(i.description),
        ]),
      ]),
  ].join("\n\n");
}
export function download(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}
export function hasContent(document: ResumeData) {
  return (
    !!document.profile.fullName?.trim() &&
    document.sections.some(
      (s) =>
        s.visible !== false &&
        (textContent(s.content).trim() ||
          s.items?.some(
            (i) => textContent(i.description).trim() || i.title?.trim(),
          )),
    )
  );
}
