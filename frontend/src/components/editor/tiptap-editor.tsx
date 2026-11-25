"use client";

import { useEffect, useRef } from "react";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  readonly value: string;
  readonly placeholder?: string;
  readonly ariaLabel: string;
  readonly onChange: (html: string) => void;
}

const TEXT_COLOR_SWATCHES = ["#171717", "#1e3a5f", "#1f4d3a", "#991b1b"] as const;

export function TiptapEditor({ value, placeholder, ariaLabel, onChange }: TiptapEditorProps) {
  const isComposingRef = useRef(false);
  const lastEmittedRef = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class:
          "min-h-[96px] w-full rounded-b-md bg-muted px-3 py-2.5 text-[16px] leading-relaxed text-foreground outline-none focus:bg-muted focus:ring-2 focus:ring-ring md:text-[14px] [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5",
      },
      handleDOMEvents: {
        compositionstart: () => {
          isComposingRef.current = true;
          return false;
        },
        compositionend: (view) => {
          isComposingRef.current = false;
          const html = view.dom.innerHTML;
          lastEmittedRef.current = html;
          onChange(html);
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (isComposingRef.current) {
        return;
      }
      const html = currentEditor.getHTML();
      if (html !== lastEmittedRef.current) {
        lastEmittedRef.current = html;
        onChange(html);
      }
    },
  });

  useEffect(() => {
    if (!editor || isComposingRef.current) {
      return;
    }
    if (value !== lastEmittedRef.current && value !== editor.getHTML()) {
      lastEmittedRef.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="bg-muted text-muted-foreground min-h-[128px] w-full rounded-md px-3 py-2.5 text-sm">
        {placeholder ?? "正在加载富文本编辑器..."}
      </div>
    );
  }

  const handleToggleLink = () => {
    const previousUrl = String(editor.getAttributes("link").href ?? "");
    const url = window.prompt("输入链接地址（留空则移除链接）", previousUrl);
    if (url === null) {
      return;
    }
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
  };

  const handleCycleColor = () => {
    const current = String(editor.getAttributes("textStyle").color ?? "");
    const idx = TEXT_COLOR_SWATCHES.indexOf(current as (typeof TEXT_COLOR_SWATCHES)[number]);
    const next = TEXT_COLOR_SWATCHES[(idx + 1) % TEXT_COLOR_SWATCHES.length];
    if (next === "#171717") {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(next).run();
    }
  };

  const toolbarBtnClass = (active: boolean) =>
    cn(
      "inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
      active && "bg-accent text-foreground"
    );

  return (
    <div className="w-full">
      <div
        role="toolbar"
        aria-label={`${ariaLabel}格式工具栏`}
        className="bg-muted flex flex-wrap items-center gap-0.5 rounded-t-md px-1.5 py-1"
      >
        <button
          type="button"
          title="加粗"
          aria-label="加粗"
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarBtnClass(editor.isActive("bold"))}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="斜体"
          aria-label="斜体"
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarBtnClass(editor.isActive("italic"))}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="下划线"
          aria-label="下划线"
          aria-pressed={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={toolbarBtnClass(editor.isActive("underline"))}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="无序列表"
          aria-label="无序列表"
          aria-pressed={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarBtnClass(editor.isActive("bulletList"))}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="有序列表"
          aria-label="有序列表"
          aria-pressed={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarBtnClass(editor.isActive("orderedList"))}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="插入或移除链接"
          aria-label="插入或移除链接"
          aria-pressed={editor.isActive("link")}
          onClick={handleToggleLink}
          className={toolbarBtnClass(editor.isActive("link"))}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="切换文字颜色"
          aria-label="切换文字颜色"
          onClick={handleCycleColor}
          className={toolbarBtnClass(Boolean(editor.getAttributes("textStyle").color))}
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="局部高亮"
          aria-label="局部高亮"
          aria-pressed={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
          className={toolbarBtnClass(editor.isActive("highlight"))}
        >
          <Highlighter className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
