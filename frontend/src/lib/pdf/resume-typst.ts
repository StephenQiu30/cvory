import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import { stripHtmlToText, type ResumeSnapshot } from "@/lib/contract/contract";
import { resolveEffectiveStyle, SECTION_LABELS } from "@/lib/templates/presets";

type HtmlNode = DefaultTreeAdapterTypes.ChildNode;

const quoted = (value: string) =>
  JSON.stringify(
    [...value].filter((char) => char >= " " || char === "\n" || char === "\t").join("")
  );
const text = (value: string) => `#text(${quoted(value)})`;
const lines = (value: string) => value.split(/\r?\n/).map(text).join("#linebreak()");

function markup(nodes: readonly HtmlNode[]): string {
  return nodes
    .map((node) => {
      if ("value" in node) return text(node.value);
      if (!("tagName" in node)) return "";
      const body = markup(node.childNodes);
      const attr = (name: string) => node.attrs.find((item) => item.name === name)?.value;
      switch (node.tagName) {
        case "br":
          return "#linebreak()";
        case "p": {
          const padding = attr("style")?.match(/(?:padding|margin)-left:\s*(\d{1,3})px/i)?.[1];
          return padding
            ? `#block[#pad(left: ${Math.min(72, Number(padding) * 0.75)}pt)[${body}]]\n\n`
            : `${body}\n\n`;
        }
        case "strong":
        case "b":
          return `#strong[${body}]`;
        case "em":
        case "i":
          return `#emph[${body}]`;
        case "u":
          return `#underline[${body}]`;
        case "s":
        case "del":
          return `#strike[${body}]`;
        case "a": {
          const href = attr("href");
          return href && /^(https?:\/\/|mailto:)/i.test(href)
            ? `#link(${quoted(href)})[#underline[${body}]]`
            : body;
        }
        case "span":
        case "mark": {
          const style = attr("style") ?? "";
          const foreground = style.match(/(?:^|;)\s*color:\s*(#[0-9a-f]{6})\b/i)?.[1];
          const background = style.match(/(?:^|;)\s*background-color:\s*(#[0-9a-f]{6})\b/i)?.[1];
          const styled = foreground ? `#text(fill: rgb(${quoted(foreground)}))[${body}]` : body;
          return background ? `#highlight(fill: rgb(${quoted(background)}))[${styled}]` : styled;
        }
        case "ul":
        case "ol": {
          const format = node.tagName === "ul" ? "list" : "enum";
          const items = node.childNodes.flatMap((child) =>
            "tagName" in child && child.tagName === "li"
              ? [`[${markup(child.childNodes).trim()}]`]
              : []
          );
          return items.length ? `#${format}(${items.join(", ")})\n\n` : "";
        }
        default:
          return body;
      }
    })
    .join("");
}

function dateRange(start: string, end: string, current: boolean): string {
  return [start.trim(), current ? "至今" : end.trim()].filter(Boolean).join(" – ");
}

const spacing = {
  compact: { x: 27, y: 30, chapter: 8, entry: 5 },
  standard: { x: 43, y: 42, chapter: 13, entry: 8 },
  relaxed: { x: 48, y: 44, chapter: 16, entry: 10 },
} as const;

export function toTypst(snapshot: ResumeSnapshot): string {
  const style = resolveEffectiveStyle(snapshot.templateId, snapshot.styleOverrides);
  const { x, y, chapter, entry } = spacing[style.spacing];
  const accent = /^#[\da-f]{6}$/i.test(style.accentColor) ? style.accentColor : "#171717";
  const font = style.fontFamily === "serif" ? "Noto Serif CJK SC" : "Noto Sans CJK SC";
  const compact = snapshot.templateId === "compact-single";
  const letter = snapshot.templateId === "chinese-letter";
  const heading = (key: string, title: string) =>
    `#block(sticky: true, above: ${chapter}pt, below: 4pt)[
  #anchor(${quoted(key)})
  #text(font: "Noto Sans CJK SC", size: ${style.fontSizePt + 1.5}pt, weight: "bold", fill: rgb(${quoted(accent)}))[${text(title)}]
  ${compact || letter ? '#line(length: 100%, stroke: 0.3pt + rgb("#cccccc"))' : ""}
]`;

  const item = (key: string, title: string, subtitle: string, date: string, body: string) => {
    const titleMarkup = title ? `#strong[${text(title)}]` : "";
    const subtitleMarkup = subtitle ? `\n\n#text(fill: rgb("#4d4d4d"))[${text(subtitle)}]` : "";
    const dateMarkup = date
      ? `#text(size: ${style.fontSizePt - 1}pt, fill: rgb("#4d4d4d"))[${text(date)}]`
      : "";
    return `#block(sticky: true, above: ${entry}pt, below: 2pt)[
  #anchor(${quoted(key)})
  ${titleMarkup && dateMarkup ? `#grid(columns: (1fr, auto), column-gutter: 8pt, [${titleMarkup}], [${dateMarkup}])` : titleMarkup || dateMarkup}${subtitleMarkup}
]
${body}`;
  };

  const sections = snapshot.sectionOrder.flatMap((section) => {
    if (snapshot.hiddenSections.includes(section)) return [];
    if (section === "basics") {
      const b = snapshot.basics;
      const contact = [
        b.location,
        b.email,
        b.phone,
        ...b.visibleOptionalFields.map((field) => b[field]),
      ]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" / ");
      if (!b.fullName.trim() && !b.targetRole.trim() && !contact) return [];
      return [
        `#block(sticky: true, below: 9pt)[
#anchor("basics")
${b.fullName.trim() ? `#text(font: "Noto Sans CJK SC", weight: "bold", size: ${compact ? 17 : 21}pt)[${text(b.fullName.trim())}]\n\n` : ""}
${b.targetRole.trim() ? `${text(b.targetRole.trim())}\n\n` : ""}
${contact ? `#text(size: ${style.fontSizePt - 1}pt, fill: rgb("#4d4d4d"))[${text(contact)}]\n` : ""}
#line(length: 100%, stroke: 0.3pt + rgb("#cccccc"))
]`,
      ];
    }
    if (section === "skills") {
      return stripHtmlToText(snapshot.skillsHtml)
        ? [
            heading(section, SECTION_LABELS[section]),
            markup(parseFragment(snapshot.skillsHtml).childNodes),
          ]
        : [];
    }
    const entries =
      section === "education"
        ? snapshot.education
            .filter(({ school, majorOrDegree, notes }) =>
              Boolean(school.trim() || majorOrDegree.trim() || notes.trim())
            )
            .map((entry) =>
              item(
                `${section}:${entry.id}`,
                entry.school.trim(),
                entry.majorOrDegree.trim(),
                dateRange(entry.startMonth, entry.endMonth, entry.isCurrent),
                entry.notes.trim() ? lines(entry.notes) : ""
              )
            )
        : (section === "work" ? snapshot.work : snapshot.projects)
            .filter(({ organization, role, descriptionHtml }) =>
              Boolean(organization.trim() || role.trim() || stripHtmlToText(descriptionHtml))
            )
            .map((entry) =>
              item(
                `${section}:${entry.id}`,
                entry.organization.trim(),
                entry.role.trim(),
                dateRange(entry.startMonth, entry.endMonth, entry.isCurrent),
                markup(parseFragment(entry.descriptionHtml).childNodes)
              )
            );
    return entries.length ? [heading(section, SECTION_LABELS[section]), ...entries] : [];
  });

  return `#set page("a4", margin: (x: ${x}pt, y: ${y}pt))
#set text(font: ${quoted(font)}, size: ${style.fontSizePt}pt, lang: "zh", region: "CN", fill: rgb("#171717"))
#set par(leading: ${(style.lineHeight - 1).toFixed(2)}em, spacing: 3pt)
#let anchor(key) = context {
  let pos = here().position()
  [#metadata((key: key, page: pos.page, y: pos.y.pt())) <resume-anchor>]
}
${sections.join("\n\n")}`;
}
