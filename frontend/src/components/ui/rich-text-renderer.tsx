import type { ReactNode } from "react";
import { safeLink } from "@/lib/resume/model";
type Node = {
  type?: string;
  text?: string;
  content?: Node[];
  marks?: { type: string; attrs?: { href?: string } }[];
};
function render(node: Node, key: number): ReactNode {
  const children = node.content?.map(render);
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      if (mark.type === "italic") text = <em>{text}</em>;
      if (mark.type === "code") text = <code>{text}</code>;
      if (mark.type === "link" && safeLink(mark.attrs?.href))
        text = (
          <a
            href={safeLink(mark.attrs?.href)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {text}
          </a>
        );
    }
    return <span key={key}>{text}</span>;
  }
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "hardBreak":
      return <br key={key} />;
    default:
      return <span key={key}>{children}</span>;
  }
}
export function RichTextRenderer({
  content,
  className,
}: {
  content: unknown;
  className?: string;
}) {
  return (
    <div className={className}>
      {typeof content === "string" ? (
        <p className="whitespace-pre-wrap">{content}</p>
      ) : content && typeof content === "object" ? (
        render(content as Node, 0)
      ) : null}
    </div>
  );
}
