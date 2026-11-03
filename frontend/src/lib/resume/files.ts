import { z } from "zod";
import type { CreateCVRequest, ResumeData, Section } from "@/lib/api/types";
import { DEFAULT_STYLE, textContent } from "./model";
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
function inline(text: string): unknown[] {
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let index = 0;
  const nodes: unknown[] = [];
  for (const m of text.matchAll(re)) {
    if (m.index! > index)
      nodes.push({ type: "text", text: text.slice(index, m.index) });
    nodes.push({
      type: "text",
      text: m[2] ?? m[3] ?? m[4],
      marks: [
        {
          type: m[2] ? "bold" : m[3] ? "italic" : "link",
          ...(m[5] ? { attrs: { href: m[5] } } : {}),
        },
      ],
    });
    index = m.index! + m[0].length;
  }
  if (index < text.length)
    nodes.push({ type: "text", text: text.slice(index) });
  return nodes;
}
export function parseMarkdown(text: string): CreateCVRequest {
  if (!text.trim()) throw Error("文件中没有文字。");
  const sections: Section[] = [];
  let name = "";
  let headline = "";
  let current: Section | undefined;
  const add = (line: string) => {
    if (!current) {
      current = {
        id: crypto.randomUUID(),
        type: "summary",
        title: "个人简介",
        visible: true,
        items: [],
        content: { type: "doc", content: [] },
      };
      sections.push(current);
    }
    const doc = current.content as { type: string; content: unknown[] };
    const list = /^\s*[-*+]\s+/.test(line);
    const numbered = /^\s*\d+\.\s+/.test(line);
    const p = {
      type: "paragraph",
      content: /^### /.test(line) ? [{type:"text",text:line.slice(4),marks:[{type:"bold"}]}] : inline(line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")),
    };
    if (list || numbered)
      doc.content.push({
        type: numbered ? "orderedList" : "bulletList",
        content: [{ type: "listItem", content: [p] }],
      });
    else doc.content.push(p);
  };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith("# ") && !name) {
      name = line.slice(2).trim();
      continue;
    }
    if (/^## /.test(line)) {
      current = {
        id: crypto.randomUUID(),
        type: "custom",
        title: line.slice(3).trim(),
        visible: true,
        items: [],
        content: { type: "doc", content: [] },
      };
      sections.push(current);
      continue;
    }
    if (!current && name && !headline) {
      headline = line;
      continue;
    }
    add(line);
  }
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

function richMarkdown(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const n = value as {
    type?: string;
    text?: string;
    content?: unknown[];
    marks?: { type: string; attrs?: { href?: string } }[];
  };
  if (n.type === "text") {
    let t = n.text ?? "";
    for (const m of n.marks ?? [])
      t =
        m.type === "bold"
          ? `**${t}**`
          : m.type === "italic"
            ? `*${t}*`
            : m.type === "link"
              ? `[${t}](${m.attrs?.href})`
              : t;
    return t;
  }
  const children = (n.content ?? []).map(richMarkdown);
  if (n.type === "listItem") return `- ${children.join("").trim()}\n`;
  if (n.type === "paragraph") return `${children.join("")}\n`;
  return children.join("");
}
export function markdown(document: ResumeData) {
  const p = document.profile;
  return [
    `# ${p.fullName || ""}`,
    p.headline || "",
    ...(["email","phone","location","website","github"] as const).filter(key=>!p.hiddenFields?.includes(key)).map(key=>p[key]).filter(Boolean),
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
