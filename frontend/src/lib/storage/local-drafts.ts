import {
  CVORY_CONTRACT_VERSION,
  createEmptyResumeContent,
  isRichTextOnlySection,
  resumeJsonBackupSchema,
  stripHtmlToText,
  type LocalResumeDocument,
  type ResumeContent,
  type ResumeSection,
  type SupportedTemplateId,
} from "@/lib/contract/contract";

const STORAGE_KEY = `cvory:v${CVORY_CONTRACT_VERSION}:drafts`;
const DRAFTS_CHANGED_EVENT = "cvory:drafts-changed";
const EMPTY_DRAFTS: readonly LocalResumeDocument[] = [];

let cachedRaw: string | null | undefined;
let cachedList: readonly LocalResumeDocument[] = EMPTY_DRAFTS;

export function generateStableId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAllDrafts(): LocalResumeDocument[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (item): item is LocalResumeDocument =>
          typeof item === "object" &&
          item !== null &&
          (item as { contract_version?: unknown }).contract_version === CVORY_CONTRACT_VERSION &&
          typeof (item as { id?: unknown }).id === "string"
      )
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  } catch {
    return [];
  }
}

function writeAllDrafts(drafts: readonly LocalResumeDocument[]): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const sorted = [...drafts].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const serialized = JSON.stringify(sorted);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedList = sorted;
    window.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function subscribeLocalDrafts(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onChange = () => callback();
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFTS_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFTS_CHANGED_EVENT, onChange);
  };
}

export function getLocalDraftsSnapshot(): readonly LocalResumeDocument[] {
  if (typeof window === "undefined") {
    return EMPTY_DRAFTS;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (cachedRaw === raw) {
    return cachedList;
  }
  cachedRaw = raw;
  cachedList = readAllDrafts();
  return cachedList;
}

export function getLocalDraftsServerSnapshot(): readonly LocalResumeDocument[] {
  return EMPTY_DRAFTS;
}

export function getLocalDraftById(id: string): LocalResumeDocument | null {
  return readAllDrafts().find((item) => item.id === id) ?? null;
}

export function createLocalDraft(
  templateId: SupportedTemplateId,
  title: string = "未命名简历",
  content: ResumeContent = createEmptyResumeContent()
): LocalResumeDocument {
  const now = new Date().toISOString();
  const created: LocalResumeDocument = {
    id: generateStableId("draft"),
    contract_version: CVORY_CONTRACT_VERSION,
    title: title.trim() || "未命名简历",
    template_id: templateId,
    version: 1,
    content,
    updated_at: now,
  };
  const existing = readAllDrafts();
  writeAllDrafts([created, ...existing]);
  return created;
}

export function saveLocalDraft(doc: LocalResumeDocument): boolean {
  const existing = readAllDrafts().filter((item) => item.id !== doc.id);
  return writeAllDrafts([doc, ...existing]);
}

export function renameLocalDraft(id: string, title: string): LocalResumeDocument | null {
  const target = getLocalDraftById(id);
  if (!target) {
    return null;
  }
  const updated: LocalResumeDocument = {
    ...target,
    title: title.trim() || target.title,
    updated_at: new Date().toISOString(),
  };
  saveLocalDraft(updated);
  return updated;
}

export function duplicateLocalDraft(sourceId: string): LocalResumeDocument | null {
  const source = getLocalDraftById(sourceId);
  if (!source) {
    return null;
  }
  return createLocalDraft(
    source.template_id,
    `${source.title}（副本）`,
    structuredClone(source.content)
  );
}

export function deleteLocalDraft(id: string): void {
  const remaining = readAllDrafts().filter((item) => item.id !== id);
  writeAllDrafts(remaining);
}

export function exportDraftToJson(doc: LocalResumeDocument): string {
  const payload = {
    contract_version: CVORY_CONTRACT_VERSION,
    title: doc.title,
    template_id: doc.template_id,
    content: doc.content,
  };
  return JSON.stringify(payload, null, 2);
}

export function importDraftFromJson(rawJson: string): LocalResumeDocument {
  const parsed: unknown = JSON.parse(rawJson);
  const validated = resumeJsonBackupSchema.parse(parsed);
  return createLocalDraft(validated.template_id, validated.title, validated.content);
}

/**
 * Converts structured resume sections into clean Markdown for Markdown editing mode.
 */
export function resumeToMarkdown(doc: LocalResumeDocument): string {
  const lines: string[] = [];
  const b = doc.content.basics;
  lines.push(`# ${b.full_name || doc.title}`);
  const meta = [
    b.target_role,
    b.phone,
    b.email,
    b.location || b.expected_city,
    b.github,
    b.wechat ? `微信: ${b.wechat}` : "",
  ].filter(Boolean);
  if (meta.length > 0) {
    lines.push(meta.join(" | "));
  }
  lines.push("");

  for (const sec of doc.content.sections) {
    if (!sec.visible) {
      continue;
    }
    lines.push(`## ${sec.title}`);
    if (isRichTextOnlySection(sec.type)) {
      const text = stripHtmlToText(sec.rich_text_html);
      if (text) {
        lines.push(text);
      }
      lines.push("");
      continue;
    }
    for (const item of sec.items) {
      const dateRange = item.is_current
        ? `${item.start_month} - 至今`
        : [item.start_month, item.end_month].filter(Boolean).join(" - ");
      const header = [item.title, item.subtitle, dateRange].filter(Boolean).join(" | ");
      if (header) {
        lines.push(`### ${header}`);
      }
      const body = stripHtmlToText(item.content_html);
      if (body) {
        lines.push(`- ${body}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n").trim() + "\n";
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function linesToHtml(lines: readonly string[]): string {
  const bulletLines = lines.filter((line) => line.startsWith("- ") || line.startsWith("* "));
  if (bulletLines.length === lines.length && bulletLines.length > 0) {
    const items = bulletLines
      .map((line) => `<li>${escapeHtml(line.slice(2).trim())}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

/**
 * Parses Markdown back into the structured resume document while preserving template & styling.
 */
export function applyMarkdownToResume(
  current: LocalResumeDocument,
  markdown: string
): LocalResumeDocument {
  const lines = markdown.split(/\r?\n/);
  let fullName = current.content.basics.full_name;
  const parsedSections: ResumeSection[] = [];
  let activeSection: {
    id: string;
    type: ResumeSection["type"];
    title: string;
    items: {
      id: string;
      title: string;
      subtitle: string;
      start_month: string;
      end_month: string;
      is_current: boolean;
      lines: string[];
    }[];
    bodyLines: string[];
  } | null = null;

  const flushSection = () => {
    if (!activeSection) {
      return;
    }
    const richOnly = isRichTextOnlySection(activeSection.type) && activeSection.items.length === 0;
    parsedSections.push({
      id: activeSection.id,
      type: activeSection.type,
      title: activeSection.title,
      visible: true,
      rich_text_html: richOnly ? linesToHtml(activeSection.bodyLines) : "",
      items: activeSection.items.map((it) => ({
        id: it.id,
        title: it.title,
        subtitle: it.subtitle,
        start_month: it.start_month,
        end_month: it.end_month,
        is_current: it.is_current,
        location: "",
        link: "",
        content_html: linesToHtml(it.lines),
      })),
    });
    activeSection = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("# ")) {
      fullName = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      flushSection();
      const title = line.slice(3).trim();
      const matched = current.content.sections.find((s) => s.title === title);
      activeSection = {
        id: matched?.id ?? generateStableId("sec"),
        type: matched?.type ?? "custom",
        title,
        items: [],
        bodyLines: [],
      };
      continue;
    }
    if (line.startsWith("### ") && activeSection) {
      const parts = line
        .slice(4)
        .split("|")
        .map((p) => p.trim());
      const datePart = parts[2] ?? "";
      const [start = "", end = ""] = datePart.split("-").map((p) => p.trim());
      activeSection.items.push({
        id: generateStableId("item"),
        title: parts[0] ?? "",
        subtitle: parts[1] ?? "",
        start_month: start,
        end_month: end === "至今" ? "" : end,
        is_current: end === "至今",
        lines: [],
      });
      continue;
    }
    if (activeSection) {
      if (activeSection.items.length > 0) {
        activeSection.items[activeSection.items.length - 1].lines.push(line);
      } else {
        activeSection.bodyLines.push(line);
      }
    }
  }
  flushSection();

  const visibleIds = new Set(parsedSections.map((s) => s.id));
  const hiddenPreserved = current.content.sections
    .filter((s) => !visibleIds.has(s.id))
    .map((s) => ({ ...s, visible: false }));

  return {
    ...current,
    content: {
      ...current.content,
      basics: {
        ...current.content.basics,
        full_name: fullName,
      },
      sections: [...parsedSections, ...hiddenPreserved],
    },
    updated_at: new Date().toISOString(),
  };
}
