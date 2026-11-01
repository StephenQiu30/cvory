import React from "react";

interface RichTextRendererProps {
  content: any;
  className?: string;
}

export function RichTextRenderer({ content, className = "" }: RichTextRendererProps) {
  if (!content) return null;

  // Handle plain string fallback
  if (typeof content === "string") {
    return <div className={`text-sm leading-relaxed whitespace-pre-wrap ${className}`}>{content}</div>;
  }

  // Tiptap JSON parser
  const renderNode = (node: any, index: number): React.ReactNode => {
    if (!node) return null;

    if (node.type === "text") {
      let element: React.ReactNode = node.text;

      if (node.marks) {
        node.marks.forEach((mark: any) => {
          if (mark.type === "bold") {
            element = <strong key="bold" className="font-semibold text-foreground">{element}</strong>;
          } else if (mark.type === "italic") {
            element = <em key="italic">{element}</em>;
          } else if (mark.type === "code") {
            element = (
              <code key="code" className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
                {element}
              </code>
            );
          } else if (mark.type === "link") {
            element = (
              <a
                key="link"
                href={mark.attrs?.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 text-foreground hover:opacity-80"
              >
                {element}
              </a>
            );
          }
        });
      }
      return <React.Fragment key={index}>{element}</React.Fragment>;
    }

    if (node.type === "paragraph") {
      return (
        <p key={index} className="mb-1 leading-relaxed text-sm text-foreground last:mb-0">
          {node.content?.map((child: any, i: number) => renderNode(child, i))}
        </p>
      );
    }

    if (node.type === "bulletList") {
      return (
        <ul key={index} className="list-disc pl-5 mb-2 space-y-1 text-sm text-foreground">
          {node.content?.map((child: any, i: number) => renderNode(child, i))}
        </ul>
      );
    }

    if (node.type === "orderedList") {
      return (
        <ol key={index} className="list-decimal pl-5 mb-2 space-y-1 text-sm text-foreground">
          {node.content?.map((child: any, i: number) => renderNode(child, i))}
        </ol>
      );
    }

    if (node.type === "listItem") {
      return (
        <li key={index} className="leading-relaxed">
          {node.content?.map((child: any, i: number) => renderNode(child, i))}
        </li>
      );
    }

    if (node.type === "doc") {
      return (
        <div key={index} className={className}>
          {node.content?.map((child: any, i: number) => renderNode(child, i))}
        </div>
      );
    }

    return null;
  };

  return <div className={className}>{renderNode(content, 0)}</div>;
}
