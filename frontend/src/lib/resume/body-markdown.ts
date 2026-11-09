import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { JSONContent } from "@tiptap/react";
import { safeLink } from "./model";

export function bodyExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      strike: false,
      underline: false,
      blockquote: false,
      horizontalRule: false,
      codeBlock: false,
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
  ];
}
const manager = new MarkdownManager({
  extensions: bodyExtensions(),
  indentation: { style: "space", size: 2 },
});
export function normalizeBody(value: unknown): JSONContent {
  if (typeof value === "string") return plainBody(value);
  if (value && typeof value === "object") return value as JSONContent;
  return { type: "doc", content: [{ type: "paragraph" }] };
}
export function plainBody(text: string): JSONContent {
  return {
    type: "doc",
    content: text.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}
export function bodyMarkdown(value: unknown) {
  const doc = normalizeBody(value);
  function check(node: JSONContent) {
    if (
      node.type === "orderedList" &&
      node.attrs?.type &&
      node.attrs.type !== "1"
    )
      throw Error(
        "字母或罗马数字列表不能无损转成 Markdown，请取消切换或转为纯文本。",
      );
    node.content?.forEach(check);
  }
  check(doc);
  return manager.serialize(doc);
}
export function parseBodyMarkdown(source: string): JSONContent {
  if (source.length > 150000)
    throw Error("正文过长，请精简至 150,000 字符以内。");
  const allowed = new Set([
    "space",
    "paragraph",
    "text",
    "escape",
    "strong",
    "em",
    "codespan",
    "link",
    "br",
    "list",
    "list_item",
    "def",
  ]);
  const tokens = manager.instance.lexer(source);
  manager.instance.walkTokens(tokens, (token) => {
    if (!allowed.has(token.type) || (token.type === "list_item" && token.task))
      throw Error(
        "包含不支持的格式（如标题、表格、图片、HTML 或任务列表）。请修改源码，或明确转为纯文本。",
      );
    if (token.type === "link" && !safeLink(token.href))
      throw Error(
        "链接仅支持 http、https、mailto 和 tel，请修正链接或转为纯文本。",
      );
  });
  const doc = manager.parse(source);
  let count = 0;
  function check(node: JSONContent, depth: number) {
    if (++count > 5000 || depth > 20)
      throw Error("正文层级或节点过多，请精简。");
    for (const mark of node.marks ?? []) {
      if (mark.type === "link") {
        const href = safeLink(mark.attrs?.href);
        if (!href) throw Error("链接格式无效，请修正。");
        mark.attrs = { ...mark.attrs, href };
      }
    }
    node.content?.forEach((child) => check(child, depth + 1));
  }
  check(doc, 0);
  if (JSON.stringify(doc).length > 150000)
    throw Error("正文过长，请精简后重试。");
  return doc;
}
