"use client";
import { useEffect, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
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
import { Button } from "./button";
import { Dialog } from "./dialog";
import { FormField } from "./form-field";
import { safeLink } from "@/lib/resume/model";
import { cn } from "@/lib/utils";
function normalize(value: unknown): JSONContent {
  if (typeof value === "string")
    return {
      type: "doc",
      content: value.split("\n").map((text) => ({
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      })),
    };
  if (value && typeof value === "object") return value as JSONContent;
  return { type: "doc", content: [{ type: "paragraph" }] };
}
export function TiptapEditor({
  value,
  onChange,
  className,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  className?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [
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
    ],
    content: normalize(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "经历正文",
        "aria-multiline": "true",
        class: cn(
          "min-h-[120px] p-3 text-sm leading-6 outline-none",
          className,
        ),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = normalize(value);
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next))
      editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);
  if (!editor)
    return (
      <div
        role="status"
        className="h-36 animate-pulse rounded-md bg-surface-subtle"
        aria-label="加载正文编辑器"
      />
    );
  const actions = [
    {
      label: "加粗",
      Icon: Bold,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "斜体",
      Icon: Italic,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "无序列表",
      Icon: List,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "有序列表",
      Icon: ListOrdered,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "行内代码",
      Icon: Code,
      active: editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "链接",
      Icon: LinkIcon,
      active: editor.isActive("link"),
      run: () => {
        setUrl(editor.getAttributes("link").href ?? "");
        setLinkError("");
        setLinkOpen(true);
      },
    },
    {
      label: "清除格式",
      Icon: RemoveFormatting,
      run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
    {
      label: "撤销",
      Icon: Undo2,
      disabled: !editor.can().undo(),
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "重做",
      Icon: Redo2,
      disabled: !editor.can().redo(),
      run: () => editor.chain().focus().redo().run(),
    },
  ];
  return (
    <div className="rounded-md border-0 bg-control focus-within:ring-2 focus-within:ring-ring">
      <div
        role="toolbar"
        aria-label="正文格式"
        className="flex flex-wrap gap-1 px-2 pt-2"
      >
        {actions.map(({ label, Icon, run, active, disabled }) => (
          <Button
            key={label}
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={run}
            className={active ? "bg-muted" : ""}
          >
            <Icon aria-hidden className="size-4" />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
      <Dialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="编辑文字链接"
        description="输入有效网址，留空可移除链接。"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url && !safeLink(url)) {
              setLinkError("请输入有效网址，如 https://example.com");
              return;
            }
            if (url)
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: safeLink(url)! })
                .run();
            else
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
            setLinkOpen(false);
          }}
        >
          <FormField
            id="rich-link"
            label="链接地址"
            value={url}
            onChange={setUrl}
            error={linkError}
          />
          <Button type="submit" className="mt-5">
            应用链接
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
