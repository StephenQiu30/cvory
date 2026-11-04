"use client";
import { useState, useRef, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/shared/app-dialog";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import type { CreateCVRequest } from "@/lib/api/types";
import {
  MAX_IMPORT_BYTES,
  parseBackup,
  parseMarkdown,
} from "@/lib/resume/files";
import { cvApi } from "@/lib/api/client";
import { textContent } from "@/lib/resume/model";
export function ImportDialog({
  open,
  onOpenChange,
  mode = "files",
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode?: "files" | "markdown";
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [candidate, setCandidate] = useState<CreateCVRequest | null>(null);
  const [markdownText, setMarkdownText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const requestId = useRef("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          onOpenChange(v);
          if (!v) {
            setCandidate(null);
            setError("");
          }
        }
      }}
      title={
        candidate
          ? "校对导入内容"
          : mode === "markdown"
            ? "创建 Markdown 简历"
            : "导入简历"
      }
      description={
        mode === "markdown"
          ? "粘贴正文或上传 Markdown，校对后另存为新简历。正文不包含默认示例，版式由模板控制。"
          : "支持 CVory v1 JSON 备份与 Markdown，单文件不超过 10 MB。确认后另存，不覆盖已有简历。"
      }
      returnFocusRef={returnFocusRef}
    >
      <FieldGroup>
        {!candidate ? (
          <>
            {mode === "markdown" ? (
              <FormField id="markdown-source" label="Markdown 正文">
                <Textarea
                  id="markdown-source"
                  rows={9}
                  className="min-h-56 font-mono text-sm"
                  value={markdownText}
                  placeholder={
                    "# 你的姓名\n求职职位\n\n## 个人简介\n填写你的经历与成果…"
                  }
                  onChange={(event) => {
                    setMarkdownText(event.target.value);
                    setError("");
                  }}
                />
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  一级标题作为姓名，二级标题作为模块。正文支持强调、列表和链接。
                </p>
              </FormField>
            ) : null}
            <label className="text-sm" htmlFor="import-file">
              {mode === "markdown"
                ? "或上传 Markdown 文件"
                : "选择 JSON 或 Markdown 文件"}
            </label>
            <Input
              id="import-file"
              type="file"
              aria-label="选择简历文件"
              accept={
                mode === "markdown" ? ".md,.markdown" : ".json,.md,.markdown"
              }
              disabled={busy}
              className="min-h-11 text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setBusy(true);
                setError("");
                try {
                  if (file.size > MAX_IMPORT_BYTES)
                    throw Error("文件超过 10 MB，请选择较小的文件。");
                  const text = await file.text();
                  requestId.current = crypto.randomUUID();
                  if (mode === "files" && /\.json$/i.test(file.name))
                    setCandidate(parseBackup(text));
                  else if (/\.(md|markdown)$/i.test(file.name)) {
                    setMarkdownText(text);
                    setCandidate(parseMarkdown(text));
                  } else
                    throw Error(
                      "暂不支持 PDF、Word 或图片，请使用 JSON／Markdown。",
                    );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "读取失败，请重试。",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : (
          <>
            <FormField
              id="import-title"
              label="简历名称"
              value={candidate.displayName}
              onChange={(v) => setCandidate({ ...candidate, displayName: v })}
            />
            <FormField
              id="import-name"
              label="姓名"
              value={candidate.profile?.fullName}
              onChange={(v) =>
                setCandidate({
                  ...candidate,
                  profile: { ...candidate.profile, fullName: v },
                })
              }
            />
            <p className="text-xs leading-5 text-muted-foreground">
              请核对内容，确认后保存为独立简历。Markdown
              段落保留在对应模块，不自动猜测学校、公司或日期。
            </p>
            {candidate.sections?.map((s, index) => (
              <FormField
                id={`import-section-${index}`}
                key={s.id}
                label={s.title}
              >
                <Textarea
                  id={`import-section-${index}`}
                  value={
                    textContent(s.content) ||
                    s.items
                      ?.map((i) =>
                        [i.title, i.subtitle, textContent(i.description)]
                          .filter(Boolean)
                          .join("\n"),
                      )
                      .join("\n\n") ||
                    ""
                  }
                  onChange={(e) =>
                    setCandidate({
                      ...candidate,
                      sections: candidate.sections?.map((v, i) =>
                        i === index
                          ? { ...v, content: e.target.value, items: [] }
                          : v,
                      ),
                    })
                  }
                />
              </FormField>
            ))}
          </>
        )}
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              setCandidate(null);
              setError("");
            }}
            disabled={busy}
          >
            取消
          </Button>
          {!candidate && mode === "markdown" ? (
            <Button
              disabled={busy || !markdownText.trim()}
              onClick={() => {
                setError("");
                try {
                  if (new Blob([markdownText]).size > MAX_IMPORT_BYTES)
                    throw Error("正文超过 10 MB，请精简后重试。");
                  const parsed = parseMarkdown(markdownText);
                  requestId.current = crypto.randomUUID();
                  setCandidate(parsed);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "解析失败，请检查内容。",
                  );
                }
              }}
            >
              校对 Markdown
            </Button>
          ) : null}
          {candidate && mode === "markdown" ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setCandidate(null);
                setError("");
              }}
            >
              返回正文
            </Button>
          ) : null}
          {candidate ? (
            <Button
              disabled={busy || !candidate.displayName.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const created = await cvApi.createCv({
                    ...candidate,
                    requestId: requestId.current,
                  });
                  onOpenChange(false);
                  router.push(`/cvs/${created.id}`);
                } catch {
                  setError("另存失败，候选已保留，请检查格式或登录后重试。");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "另存中" : "确认并新建"}
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </Dialog>
  );
}
