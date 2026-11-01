"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  RemoveFormatting,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface TiptapEditorProps {
  value: any; // Tiptap JSON doc or string
  onChange: (value: any) => void;
  placeholder?: string;
  className?: string;
}

export function TiptapEditor({
  value,
  onChange,
  placeholder,
  className,
}: TiptapEditorProps) {
  const isComposingRef = React.useRef(false);

  // Normalize initial content
  const initialContent = React.useMemo(() => {
    if (!value) {
      return {
        type: "doc",
        content: [{ type: "paragraph" }],
      };
    }
    if (typeof value === "string") {
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: value }],
          },
        ],
      };
    }
    return value;
  }, [value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // In resume descriptions, headings are structured by sections
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "underline text-primary hover:opacity-80",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none min-h-[90px] px-3 py-2 text-sm text-foreground",
          className
        ),
      },
      handleDOMEvents: {
        compositionstart: () => {
          isComposingRef.current = true;
          return false;
        },
        compositionend: () => {
          isComposingRef.current = false;
          if (editor) {
            onChange(editor.getJSON());
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      if (!isComposingRef.current) {
        onChange(editor.getJSON());
      }
    },
  });

  // Keep editor content in sync when value changes externally
  React.useEffect(() => {
    if (!editor || !value) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const nextJson = JSON.stringify(
      typeof value === "string"
        ? {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
          }
        : value
    );
    if (currentJson !== nextJson && !editor.isFocused) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="h-28 w-full rounded-md border border-border bg-surface-subtle animate-pulse" />
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("请输入链接地址 (URL):", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    // Basic sanitation
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("mailto:")) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: `https://${url}` }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  return (
    <div className="rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-ring transition-all overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-subtle px-1.5 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "h-7 w-7",
            editor.isActive("bold") ? "bg-muted text-primary font-bold" : "text-muted-foreground"
          )}
          title="加粗 (Ctrl+B)"
          aria-label="加粗"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "h-7 w-7",
            editor.isActive("italic") ? "bg-muted text-primary font-bold" : "text-muted-foreground"
          )}
          title="斜体 (Ctrl+I)"
          aria-label="斜体"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "h-7 w-7",
            editor.isActive("bulletList") ? "bg-muted text-primary font-bold" : "text-muted-foreground"
          )}
          title="无序列表"
          aria-label="无序列表"
        >
          <List className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "h-7 w-7",
            editor.isActive("orderedList") ? "bg-muted text-primary font-bold" : "text-muted-foreground"
          )}
          title="有序列表"
          aria-label="有序列表"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(
            "h-7 w-7",
            editor.isActive("code") ? "bg-muted text-primary font-bold" : "text-muted-foreground"
          )}
          title="行内代码"
          aria-label="行内代码"
        >
          <Code className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={setLink}
          className={cn(
            "h-7 w-7",
            editor.isActive("link") ? "bg-muted text-primary font-bold" : "text-muted-foreground"
          )}
          title="添加/编辑链接"
          aria-label="链接"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="清除格式"
          aria-label="清除格式"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="撤销 (Ctrl+Z)"
          aria-label="撤销"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="重做 (Ctrl+Y)"
          aria-label="重做"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
