import type { CreateCVRequest, Section } from "@/lib/api/types";
import { DEFAULT_STYLE, blankProfile, safeLink } from "./model";

type ExtractedCandidate = API.ResumeImportCandidate;
type ImportProfileKey =
  | "fullName"
  | "headline"
  | "email"
  | "phone"
  | "location"
  | "website"
  | "github";
type SectionBuilder = {
  type: Section["type"];
  title: string;
  lines: string[];
  characters: number;
  nonEmptyLines: number;
};

const fieldPatterns: Array<{
  field: ImportProfileKey;
  pattern: RegExp;
}> = [
  { field: "fullName", pattern: /^(?:姓名|name)\s*[:：]\s*(.+)$/i },
  {
    field: "headline",
    pattern:
      /^(?:求职意向|目标职位|应聘职位|求职岗位|job title|position)\s*[:：]\s*(.+)$/i,
  },
  {
    field: "email",
    pattern: /^(?:邮箱|电子邮箱|email|e-mail)\s*[:：]\s*(.+)$/i,
  },
  {
    field: "phone",
    pattern: /^(?:手机|电话|联系电话|phone|mobile)\s*[:：]\s*(.+)$/i,
  },
  {
    field: "location",
    pattern: /^(?:所在地|现居地|地址|location)\s*[:：]\s*(.+)$/i,
  },
  { field: "website", pattern: /^(?:个人网站|网站|website)\s*[:：]\s*(.+)$/i },
  { field: "github", pattern: /^(?:github)\s*[:：]\s*(.+)$/i },
];

const sectionTypes = new Map<string, Section["type"]>([
  ["个人简介", "summary"],
  ["自我评价", "summary"],
  ["个人总结", "summary"],
  ["summary", "summary"],
  ["profile", "summary"],
  ["about me", "summary"],
  ["工作经历", "experience"],
  ["工作经验", "experience"],
  ["职业经历", "experience"],
  ["work experience", "experience"],
  ["employment", "experience"],
  ["项目经历", "project"],
  ["项目经验", "project"],
  ["project experience", "project"],
  ["projects", "project"],
  ["教育经历", "education"],
  ["教育背景", "education"],
  ["education", "education"],
  ["专业技能", "skill"],
  ["技能特长", "skill"],
  ["skills", "skill"],
  ["technical skills", "skill"],
]);

function normalizeHeading(value: string): string {
  return value
    .trim()
    .replace(/[:：\s]+$/g, "")
    .toLocaleLowerCase("en-US");
}

function estimatedBodySize(builder: SectionBuilder, nextLine: string): number {
  const lineCount = builder.lines.length + 1;
  const characters = builder.characters + nextLine.length;
  const nonEmptyLines = builder.nonEmptyLines + (nextLine ? 1 : 0);
  const emptyLines = lineCount - nonEmptyLines;
  return 24 + characters + nonEmptyLines * 60 + emptyLines * 19 + lineCount - 1;
}

function suggestedDisplayName(
  filename: string,
  format: ExtractedCandidate["format"],
): string {
  const name = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  const withoutExtension = name.replace(/\.(docx|pdf)$/i, "").trim();
  return (
    withoutExtension || (format === "docx" ? "从 DOCX 导入" : "从 PDF 导入")
  ).slice(0, 255);
}

export async function mapDocumentImport(
  extracted: ExtractedCandidate,
  filename: string,
): Promise<{
  candidate: CreateCVRequest;
  warnings: string[];
  mappedFields: string[];
}> {
  if (!extracted.blocks.length) throw Error("文件中没有可导入的文字。");
  const profile = blankProfile();
  const mappedFields = new Set<string>();
  const warnings = [...extracted.warnings];
  const builders: SectionBuilder[] = [];
  let current: SectionBuilder | undefined;
  const createSection = (
    type: Section["type"],
    title: string,
  ): SectionBuilder => {
    if (builders.length >= 100) {
      throw Error("文档章节超过 100 个，请简化文件结构后重试。");
    }
    const section: SectionBuilder = {
      type,
      title: title.slice(0, 200),
      lines: [],
      characters: 0,
      nonEmptyLines: 0,
    };
    builders.push(section);
    current = section;
    return section;
  };
  const appendText = (line: string) => {
    if (!current) createSection("custom", "未归类内容");
    if (current && estimatedBodySize(current, line) > 120000) {
      createSection(current.type, `${current.title}（续）`);
      warnings.push("较长内容已拆成连续模块，请核对拆分位置。");
    }
    if (!current) return;
    current.lines.push(line);
    current.characters += line.length;
    current.nonEmptyLines += line ? 1 : 0;
  };

  for (const block of [...extracted.blocks].sort(
    (first, second) => first.order - second.order,
  )) {
    const line = block.text.trim();
    if (!line) continue;
    let mapped = false;
    for (const { field, pattern } of fieldPatterns) {
      const match = pattern.exec(line);
      if (!match || profile[field]) continue;
      const value = match[1].trim();
      if (value.length > 10000) continue;
      if ((field === "website" || field === "github") && !safeLink(value))
        continue;
      profile[field] =
        field === "website" || field === "github"
          ? (safeLink(value) ?? value)
          : value;
      mappedFields.add(field);
      mapped = true;
      break;
    }
    if (mapped) continue;

    const heading = sectionTypes.get(normalizeHeading(line));
    if (heading) {
      createSection(heading, line);
      continue;
    }
    if (block.kind === "heading") {
      createSection("custom", line);
      if (line.length > 200) appendText(line.slice(200));
      continue;
    }
    appendText(line);
  }

  if (!builders.length) createSection("custom", "未归类内容");
  if (!mappedFields.size)
    warnings.push(
      "没有识别到带姓名、职位或联系方式标签的字段；未归类文字保留在正文中。",
    );
  if (
    !extracted.blocks.some((block) =>
      sectionTypes.has(normalizeHeading(block.text)),
    )
  )
    warnings.push(
      "没有识别到常见简历模块标题；正文已保留为可编辑的未归类内容。",
    );

  const { plainBody } = await import("./body-markdown");
  const sections: API.SectionInput[] = builders.map((builder) => ({
    id: crypto.randomUUID(),
    type: builder.type,
    title: builder.title,
    visible: true,
    items: [],
    content: plainBody(builder.lines.join("\n")),
  }));
  const candidate: CreateCVRequest = {
    displayName: suggestedDisplayName(filename, extracted.format),
    profile,
    sections,
    styleSettings: DEFAULT_STYLE,
  };
  return {
    candidate,
    warnings: [...new Set(warnings)],
    mappedFields: [...mappedFields],
  };
}

export function editableText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const node = value as Record<string, unknown>;
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  const children = node.content.map(editableText);
  return children.join(
    ["doc", "listItem", "bulletList", "orderedList"].includes(String(node.type))
      ? "\n"
      : "",
  );
}
