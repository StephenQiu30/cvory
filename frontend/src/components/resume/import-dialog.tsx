"use client";
import { errorMessage } from "@/lib/api/error-message";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/shared/app-dialog";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import type { CreateCVRequest, ResumeImportCandidate } from "@/lib/api/types";
import { cvApi, fileApi } from "@/lib/api/client";
import {
  IMPORT_CANDIDATE_TTL_MS,
  MAX_IMPORT_BYTES,
  parseBackup,
  parseMarkdown,
} from "@/lib/resume/files";
import { editableText, mapDocumentImport } from "@/lib/resume/document-import";

type ProfileField =
  | "fullName"
  | "headline"
  | "email"
  | "phone"
  | "location"
  | "website"
  | "github";
type ImportSection = NonNullable<CreateCVRequest["sections"]>[number];
type ImportItem = NonNullable<ImportSection["items"]>[number];
type ItemTextField =
  | "title"
  | "subtitle"
  | "dateRange"
  | "startDate"
  | "endDate"
  | "location"
  | "degree"
  | "educationType"
  | "department"
  | "link";
type DocumentReview = {
  source: ResumeImportCandidate;
  warnings: string[];
  mappedFields: string[];
};

const profileFields: Array<{ key: ProfileField; label: string }> = [
  { key: "headline", label: "求职职位" },
  { key: "email", label: "邮箱" },
  { key: "phone", label: "电话" },
  { key: "location", label: "所在地" },
  { key: "website", label: "个人网站" },
  { key: "github", label: "GitHub" },
];
const itemFields: Array<{ key: ItemTextField; label: string }> = [
  { key: "title", label: "经历标题" },
  { key: "subtitle", label: "组织或岗位" },
  { key: "dateRange", label: "时间范围" },
  { key: "startDate", label: "开始月份" },
  { key: "endDate", label: "结束月份" },
  { key: "location", label: "地点" },
  { key: "degree", label: "学位" },
  { key: "educationType", label: "学历类型" },
  { key: "department", label: "部门或专业" },
  { key: "link", label: "链接" },
];
const sourceKindLabel: Record<
  ResumeImportCandidate["blocks"][number]["kind"],
  string
> = {
  heading: "标题",
  paragraph: "段落",
  "list-item": "列表项",
  "table-row": "表格行",
  line: "文本行",
};

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
  const [documentReview, setDocumentReview] = useState<DocumentReview | null>(
    null,
  );
  const [markdownText, setMarkdownText] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [candidateExpiresAt, setCandidateExpiresAt] = useState<number | null>(
    null,
  );
  const [error, setError] = useState("");
  const router = useRouter();
  const requestId = useRef("");
  const parseController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!candidate || candidateExpiresAt === null) return;
    const expire = () => {
      setCandidate(null);
      setDocumentReview(null);
      setCandidateExpiresAt(null);
      setError("校对内容已过期，请重新导入文件。");
    };
    const remaining = candidateExpiresAt - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, remaining);
    return () => window.clearTimeout(timer);
  }, [candidate, candidateExpiresAt]);

  function setNewCandidate(value: CreateCVRequest) {
    setCandidate(value);
    setCandidateExpiresAt(Date.now() + IMPORT_CANDIDATE_TTL_MS);
  }

  function clearReview() {
    setCandidate(null);
    setDocumentReview(null);
    setCandidateExpiresAt(null);
    setError("");
  }

  function closeDialog() {
    parseController.current?.abort();
    parseController.current = null;
    setParsing(false);
    onOpenChange(false);
    clearReview();
  }

  function updateProfile(field: ProfileField, value: string) {
    setCandidate((current) =>
      current
        ? { ...current, profile: { ...current.profile, [field]: value } }
        : current,
    );
  }

  function updateSection(index: number, update: Partial<ImportSection>) {
    setCandidate((current) =>
      current
        ? {
            ...current,
            sections: current.sections?.map((section, sectionIndex) =>
              sectionIndex === index ? { ...section, ...update } : section,
            ),
          }
        : current,
    );
  }

  function updateItem(
    sectionIndex: number,
    itemIndex: number,
    update: Partial<ImportItem>,
  ) {
    setCandidate((current) =>
      current
        ? {
            ...current,
            sections: current.sections?.map((section, currentSectionIndex) =>
              currentSectionIndex === sectionIndex
                ? {
                    ...section,
                    items: section.items?.map((item, currentItemIndex) =>
                      currentItemIndex === itemIndex
                        ? { ...item, ...update }
                        : item,
                    ),
                  }
                : section,
            ),
          }
        : current,
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          onOpenChange(true);
          return;
        }
        if (parseController.current) {
          closeDialog();
          return;
        }
        if (!busy) {
          onOpenChange(false);
          clearReview();
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
          : "支持 CVory v1 JSON、Markdown、DOCX 和文字型 PDF，单文件不超过 10 MiB。扫描 PDF 暂不支持 OCR；确认后另存，不覆盖已有简历。"
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
                : "选择 JSON、Markdown、DOCX 或 PDF 文件"}
            </label>
            <Input
              id="import-file"
              type="file"
              aria-label="选择简历文件"
              accept={
                mode === "markdown"
                  ? ".md,.markdown"
                  : ".json,.md,.markdown,.docx,.pdf"
              }
              disabled={busy}
              className="min-h-11 text-sm"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setBusy(true);
                setError("");
                setDocumentReview(null);
                let controller: AbortController | undefined;
                try {
                  if (file.size > MAX_IMPORT_BYTES)
                    throw Error("文件超过 10 MiB，请选择较小的文件。");
                  if (mode === "files" && /\.json$/i.test(file.name)) {
                    setNewCandidate(parseBackup(await file.text()));
                    requestId.current = crypto.randomUUID();
                  } else if (/\.(md|markdown)$/i.test(file.name)) {
                    const text = await file.text();
                    setMarkdownText(text);
                    setNewCandidate(await parseMarkdown(text));
                    requestId.current = crypto.randomUUID();
                  } else if (
                    mode === "files" &&
                    /\.(docx|pdf)$/i.test(file.name)
                  ) {
                    controller = new AbortController();
                    parseController.current = controller;
                    setParsing(true);
                    const extracted = await fileApi.parseResumeImport(
                      file,
                      controller.signal,
                    );
                    if (controller.signal.aborted) return;
                    const mapped = await mapDocumentImport(
                      extracted,
                      file.name,
                    );
                    if (controller.signal.aborted) return;
                    setNewCandidate(mapped.candidate);
                    setDocumentReview({
                      source: extracted,
                      warnings: mapped.warnings,
                      mappedFields: mapped.mappedFields,
                    });
                    requestId.current = crypto.randomUUID();
                  } else {
                    throw Error(
                      "暂不支持此格式。请使用 CVory v1 JSON、Markdown、DOCX 或 PDF 文件。",
                    );
                  }
                } catch (cause) {
                  if (!controller?.signal.aborted) {
                    setError(
                      errorMessage(
                        cause,
                        "读取失败，请检查文件内容和格式后重试。",
                      ),
                    );
                  }
                } finally {
                  if (parseController.current === controller)
                    parseController.current = null;
                  setParsing(false);
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
              onChange={(value) =>
                setCandidate({ ...candidate, displayName: value })
              }
            />
            <FormField
              id="import-name"
              label="姓名"
              value={candidate.profile?.fullName}
              onChange={(value) => updateProfile("fullName", value)}
            />
            {profileFields.map(({ key, label }) => (
              <FormField
                id={`import-profile-${key}`}
                key={key}
                label={label}
                value={candidate.profile?.[key]}
                onChange={(value) => updateProfile(key, value)}
              />
            ))}
            {documentReview ? (
              <StatusMessage tone="info" title="请对照原文校对">
                <p>
                  已提取 {documentReview.source.blocks.length} 个文字片段
                  {documentReview.source.format === "pdf" &&
                  documentReview.source.pageCount
                    ? `，共 ${documentReview.source.pageCount} 页`
                    : ""}
                  。
                  {documentReview.mappedFields.length
                    ? `已按明确标签映射 ${documentReview.mappedFields.length} 项资料字段。`
                    : "没有自动猜测姓名、公司、学校或日期。"}
                </p>
                {documentReview.warnings.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {documentReview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                <details className="mt-3 rounded-md bg-muted/60 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    查看提取原文与来源位置
                  </summary>
                  <ol className="mt-3 max-h-64 space-y-3 overflow-auto text-xs leading-5">
                    {documentReview.source.blocks.slice(0, 80).map((block) => (
                      <li key={block.order} className="break-words">
                        <p className="text-muted-foreground">
                          {block.page
                            ? `第 ${block.page} 页`
                            : `${sourceKindLabel[block.kind]} · ${block.order + 1}`}
                          {block.position
                            ? ` · x ${block.position.x}、y ${block.position.y} pt`
                            : ""}
                        </p>
                        <p>{block.text}</p>
                      </li>
                    ))}
                  </ol>
                  {documentReview.source.blocks.length > 80 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      原文预览显示前 80 项；其余文字已保留在下方可编辑模块中。
                    </p>
                  ) : null}
                </details>
              </StatusMessage>
            ) : null}
            <p className="text-xs leading-5 text-muted-foreground">
              请检查字段、正文和条目。导入不会补造学校、公司、日期或成果；确认后另存为独立简历。校对内容仅保留在当前页面，一小时后清除。
            </p>
            {candidate.sections?.map((section, sectionIndex) => (
              <FieldGroup
                key={section.id}
                className="rounded-md bg-muted/40 p-3"
              >
                <FormField
                  id={`import-section-title-${sectionIndex}`}
                  label="模块标题"
                  value={section.title}
                  onChange={(value) =>
                    updateSection(sectionIndex, { title: value })
                  }
                />
                {(section.content !== null && section.content !== undefined) ||
                !section.items?.length ? (
                  <FormField
                    id={`import-section-${sectionIndex}`}
                    label="模块正文"
                  >
                    <Textarea
                      id={`import-section-${sectionIndex}`}
                      rows={5}
                      value={editableText(section.content)}
                      onChange={(event) =>
                        updateSection(sectionIndex, {
                          content: event.target.value,
                        })
                      }
                    />
                  </FormField>
                ) : null}
                {section.items?.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className="space-y-3 rounded-md bg-background p-3"
                  >
                    <p className="text-xs font-medium">条目 {itemIndex + 1}</p>
                    {itemFields.map(({ key, label }) => (
                      <FormField
                        id={`import-item-${sectionIndex}-${itemIndex}-${key}`}
                        key={key}
                        label={label}
                        value={item[key]}
                        onChange={(value) =>
                          updateItem(sectionIndex, itemIndex, { [key]: value })
                        }
                      />
                    ))}
                    <label
                      className="flex min-h-11 items-center gap-2 text-sm"
                      htmlFor={`import-item-${sectionIndex}-${itemIndex}-current`}
                    >
                      <input
                        id={`import-item-${sectionIndex}-${itemIndex}-current`}
                        type="checkbox"
                        checked={item.current ?? false}
                        onChange={(event) =>
                          updateItem(sectionIndex, itemIndex, {
                            current: event.target.checked,
                          })
                        }
                      />
                      仍在进行
                    </label>
                    <FormField
                      id={`import-item-${sectionIndex}-${itemIndex}-tags`}
                      label="标签，每行一项"
                    >
                      <Textarea
                        id={`import-item-${sectionIndex}-${itemIndex}-tags`}
                        rows={2}
                        value={item.tags?.join("\n") ?? ""}
                        onChange={(event) =>
                          updateItem(sectionIndex, itemIndex, {
                            tags: event.target.value
                              .split(/\r?\n/)
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </FormField>
                    <FormField
                      id={`import-item-${sectionIndex}-${itemIndex}-description`}
                      label="条目描述"
                    >
                      <Textarea
                        id={`import-item-${sectionIndex}-${itemIndex}-description`}
                        rows={4}
                        value={editableText(item.description)}
                        onChange={(event) =>
                          updateItem(sectionIndex, itemIndex, {
                            description: event.target.value,
                          })
                        }
                      />
                    </FormField>
                  </div>
                ))}
              </FieldGroup>
            ))}
          </>
        )}
        {busy ? (
          <StatusMessage loading>
            {parsing ? "正在安全解析文件…" : "正在处理导入内容…"}
          </StatusMessage>
        ) : null}
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={closeDialog}
            disabled={busy && !parsing}
          >
            {parsing ? "取消解析并关闭" : "取消"}
          </Button>
          {!candidate && mode === "markdown" ? (
            <Button
              disabled={busy || !markdownText.trim()}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  if (new Blob([markdownText]).size > MAX_IMPORT_BYTES)
                    throw Error("正文超过 10 MiB，请精简后重试。");
                  const parsed = await parseMarkdown(markdownText);
                  requestId.current = crypto.randomUUID();
                  setNewCandidate(parsed);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "解析失败，请检查内容。",
                  );
                } finally {
                  setBusy(false);
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
                  clearReview();
                  router.push(`/cvs/${created.id}`);
                } catch (cause) {
                  setError(
                    errorMessage(
                      cause,
                      "另存失败，候选已保留，请检查格式或登录后重试。",
                    ),
                  );
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
