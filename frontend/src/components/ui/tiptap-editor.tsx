"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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
import { Dialog } from "@/components/shared/app-dialog";
import { FormField } from "./form-field";
import { safeLink, textContent } from "@/lib/resume/model";
import { StatusMessage } from "./status-message";
import { cn } from "@/lib/utils";
import {
  bodyExtensions,
  bodyMarkdown,
  normalizeBody,
  parseBodyMarkdown,
  plainBody,
} from "@/lib/resume/body-markdown";
import { Textarea } from "./textarea";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { RichTextRenderer } from "./rich-text-renderer";
export function TiptapEditor({
  value,
  onChange,
  className,
  pendingSource,
  onPendingChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  className?: string;
  pendingSource?: string;
  onPendingChange?: (source: string | undefined) => void;
}) {
  const [mode, setMode] = useState(
    pendingSource !== undefined ? "markdown" : "rich",
  );
  const [source, setSource] = useState(() => {
    if (pendingSource !== undefined) return pendingSource;
    try {
      return bodyMarkdown(value);
    } catch {
      return textContent(value);
    }
  });
  const [sourceError, setSourceError] = useState("");
  const [conversionOpen, setConversionOpen] = useState(false);
  const composing = useRef(false);
  const sourceRef = useRef(source);
  const latestChange = useRef(onChange);
  useEffect(() => {
    latestChange.current = onChange;
  });
  function applySource(text: string) {
    sourceRef.current = text;
    setSource(text);
    if (composing.current) {
      onPendingChange?.(text);
      return;
    }
    try {
      const doc = parseBodyMarkdown(text);
      editor?.commands.setContent(doc, { emitUpdate: false });
      onChange(doc);
      onPendingChange?.(undefined);
      setSourceError("");
    } catch (cause) {
      setSourceError(
        cause instanceof Error
          ? cause.message
          : "无法转换此段正文，请保留源码并修改。",
      );
      onPendingChange?.(text);
    }
  }
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [pasteWarning, setPasteWarning] = useState("");
  const editor = useEditor({
    extensions: bodyExtensions(),
    content: normalizeBody(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          setUrl(editor?.getAttributes("link").href ?? "");
          setLinkError("");
          setLinkOpen(true);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html");
        if (!html) return false;
        const doc = new DOMParser().parseFromString(html, "text/html");
        const allowed = new Set([
          "P",
          "DIV",
          "SPAN",
          "BR",
          "STRONG",
          "B",
          "EM",
          "I",
          "UL",
          "OL",
          "LI",
          "CODE",
          "A",
        ]);
        const unsupported = [...doc.body.querySelectorAll("*")].some(
          (element) =>
            !allowed.has(element.tagName) ||
            (element.tagName === "A" &&
              (!safeLink(element.getAttribute("href")) ||
                !/^(https?:|mailto:|tel:)/i.test(
                  element.getAttribute("href") || "",
                ))) ||
            element.hasAttribute("style") ||
            element.hasAttribute("class") ||
            [...element.attributes].some((attr) => attr.name.startsWith("on")),
        );
        if (!unsupported) return false;
        const text =
          event.clipboardData?.getData("text/plain") ||
          doc.body.textContent ||
          "";
        editor?.commands.insertContent(plainBody(text).content ?? []);
        setPasteWarning(
          "粘贴内容含不支持的格式或网页样式，已仅保留可读文字。可撤销后重新整理。",
        );
        return true;
      },
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
    onUpdate: ({ editor }) => latestChange.current(editor.getJSON()),
  });
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = normalizeBody(value);
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next))
      editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    if (pendingSource !== undefined) {
      try {
        parseBodyMarkdown(pendingSource);
      } catch (cause) {
        void Promise.resolve().then(() =>
          setSourceError(
            cause instanceof Error ? cause.message : "请检查 Markdown 源码。",
          ),
        );
      }
    }
  }, [pendingSource]);
  if (!editor)
    return <StatusMessage loading>正在加载正文编辑器…</StatusMessage>;
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
      <Tabs
        value={mode}
        onValueChange={(next) => {
          if (composing.current) return;
          if (next !== "markdown" && sourceError) {
            setConversionOpen(true);
            return;
          }
          if (
            next === "markdown" &&
            mode !== "markdown" &&
            pendingSource === undefined
          ) {
            try {
              const text = bodyMarkdown(editor.getJSON());
              sourceRef.current = text;
              setSource(text);
            } catch (cause) {
              sourceRef.current = textContent(editor.getJSON());
              setSource(sourceRef.current);
              setSourceError(
                cause instanceof Error ? cause.message : "无法转换原格式。",
              );
              setConversionOpen(true);
              return;
            }
          }
          setMode(next);
        }}
        className="px-2 pt-2"
      >
        <TabsList aria-label="正文编辑模式">
          <TabsTrigger value="rich">富文本</TabsTrigger>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="preview">正文预览</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "markdown" ? (
        <div className="flex flex-col gap-3 p-3">
          <p className="text-xs text-muted-foreground">
            支持段落、加粗、斜体、列表、链接和行内代码；结构化信息仍在表单中填写。
          </p>
          <Textarea
            aria-label="Markdown 正文"
            value={source}
            className="min-h-48 font-mono"
            spellCheck={false}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              applySource(event.currentTarget.value);
            }}
            onChange={(event) => applySource(event.target.value)}
          />
          {sourceError ? (
            <StatusMessage>
              {sourceError} 原输入已保留，尚未应用到简历。
            </StatusMessage>
          ) : null}
        </div>
      ) : null}
      {mode === "preview" ? (
        <div className="resume-body p-3" aria-label="正文预览">
          <RichTextRenderer content={value} />
        </div>
      ) : null}
      <div hidden={mode !== "rich"}>
        <div
          role="toolbar"
          aria-label="正文格式"
          className="flex flex-wrap gap-1 px-2 pt-2"
        >
          {actions.map(({ label, Icon, run, active, disabled }) => (
            <Button
              type="button"
              key={label}
              variant="ghost"
              size="icon"
              aria-label={label}
              title={label}
              aria-pressed={active}
              disabled={disabled}
              onClick={run}
              className={cn(active && "bg-muted")}
            >
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
        <EditorContent editor={editor} />
        {pasteWarning ? (
          <StatusMessage tone="info">{pasteWarning}</StatusMessage>
        ) : null}
      </div>
      <Dialog
        open={conversionOpen}
        onOpenChange={(open) => {
          setConversionOpen(open);
          if (!open && mode === "rich") setSourceError("");
        }}
        title="正文含有不兼容格式"
        description={
          mode === "rich"
            ? "原有富文本仍保留。转为纯文本会保留可读文字并取消格式。"
            : "原源码仍在编辑框中。转为纯文本会保留可读字符并取消格式。"
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setConversionOpen(false);
              if (mode === "rich") setSourceError("");
            }}
          >
            取消切换
          </Button>
          <Button
            type="button"
            onClick={() => {
              const doc = plainBody(sourceRef.current);
              if (
                JSON.stringify(doc).length > 150000 ||
                (doc.content ?? []).reduce(
                  (count, node) => count + 1 + (node.content?.length ?? 0),
                  1,
                ) > 5000
              ) {
                setSourceError(
                  "正文超过可保存上限，请先精简源码；原输入仍保留。",
                );
                return;
              }
              editor.commands.setContent(doc, { emitUpdate: false });
              onChange(doc);
              onPendingChange?.(undefined);
              setSourceError("");
              setMode("rich");
              setConversionOpen(false);
            }}
          >
            转为纯文本
          </Button>
        </div>
      </Dialog>
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
