"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  FileCode2,
  FileText,
  Globe,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { ApiError, cvApi } from "@/lib/api/client";
import {
  getPublication,
  getPublicResume,
} from "@/lib/api/generated/api/publication";
import type { CVResource, ResumeData, StyleSettings } from "@/lib/api/types";
import { editable, TEMPLATES } from "@/lib/resume/model";
import { Content } from "@/components/layout/content";
import { useAccount } from "@/components/account/account-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/shared/app-dialog";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PaperPreview } from "@/components/ui/paper-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusMessage } from "@/components/ui/status-message";
import { ImportDialog } from "@/components/resume/import-dialog";
import { ExportDialog } from "@/components/resume/export-dialog";
import {
  TemplateGallery,
  templateExample,
  templateStyle,
} from "./_components/template-gallery";

type TemplateId = NonNullable<StyleSettings["templateId"]>;
const TAB_CLASS =
  "data-[state=active]:text-link data-[state=active]:after:bg-primary";
function updatedAt(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function ResumeCard({
  cv,
  busy,
  onDelete,
  onCopy,
  onExport,
  onRename,
}: {
  cv: CVResource;
  busy: boolean;
  onDelete: (trigger: HTMLElement) => void;
  onCopy: () => void;
  onExport: (trigger: HTMLElement) => void;
  onRename: (trigger: HTMLElement) => void;
}) {
  return (
    <article className="grid min-w-0 grid-cols-[42%_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-border py-5 first:pt-0">
      <div className="relative col-start-1 row-start-1 w-full max-w-40 self-start overflow-hidden rounded-md bg-white transition-opacity hover:opacity-90 sm:row-span-2">
        <div className="pointer-events-none" aria-hidden inert>
          <PaperPreview cv={cv} firstPageOnly />
        </div>
        <Link
          href={`/cvs/${cv.id}`}
          aria-label={`编辑${cv.displayName}`}
          className="absolute inset-0 rounded-md"
        />
      </div>
      <div className="col-start-2 row-start-1 flex min-w-0 flex-col items-start">
        <Link
          href={`/cvs/${cv.id}`}
          className="line-clamp-2 break-all text-base font-medium leading-6 hover:text-primary"
          title={cv.displayName}
        >
          {cv.displayName}
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          {
            TEMPLATES.find(
              (template) => template.id === cv.styleSettings.templateId,
            )?.title
          }
        </p>
        <div className="mt-auto pt-5">
          <p className="text-xs leading-5 text-muted-foreground">
            上次更新：{updatedAt(cv.updateTime)}
          </p>
        </div>
      </div>
      <div className="col-span-2 row-start-2 flex min-w-0 flex-nowrap justify-between gap-0.5 text-muted-foreground sm:col-span-1 sm:col-start-2 sm:-ml-2 sm:justify-start sm:self-end">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="size-11 sm:size-9"
        >
          <Link
            href="/settings/publication"
            aria-label={`管理${cv.displayName}的公开分享`}
            title="公开分享"
          >
            <Share2 aria-hidden className="size-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          disabled={busy}
          onClick={onCopy}
          aria-label={`复制${cv.displayName}`}
          title="复制为新版本"
        >
          <Copy aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          disabled={busy}
          onClick={(event) => onExport(event.currentTarget)}
          aria-label={`下载${cv.displayName}`}
          title="下载简历"
        >
          <Download aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          disabled={busy}
          onClick={(event) => onRename(event.currentTarget)}
          aria-label={`修改${cv.displayName}的名称`}
          title="修改名称"
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          disabled={busy}
          onClick={(event) => onDelete(event.currentTarget)}
          aria-label={`删除${cv.displayName}`}
          title="删除简历"
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>
    </article>
  );
}
export default function Library() {
  const {
    account,
    loading: accountLoading,
    error: accountError,
    refresh,
    openAuth,
  } = useAccount();
  const [cvs, setCvs] = useState<CVResource[]>([]);
  const [listOwner, setListOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [next, setNext] = useState("");
  const [total, setTotal] = useState(0);
  const [create, setCreate] = useState(false);
  const [importMode, setImportMode] = useState<"files" | "markdown" | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<TemplateId>("standard");
  const [preview, setPreview] = useState<TemplateId | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<CVResource | null>(null);
  const [renaming, setRenaming] = useState<CVResource | null>(null);
  const [exporting, setExporting] = useState<CVResource | null>(null);
  const [actionError, setActionError] = useState("");
  const [publication, setPublication] = useState<API.PublicationStatus | null>(
    null,
  );
  const [publicDocument, setPublicDocument] = useState<ResumeData | null>(null);
  const [publicationError, setPublicationError] = useState("");
  const [publicationLoading, setPublicationLoading] = useState(false);
  const [leftTab, setLeftTab] = useState("private");
  const [rightTab, setRightTab] = useState("templates");
  const router = useRouter();
  const requestId = useRef("");
  const loadGeneration = useRef(0);
  const actionTrigger = useRef<HTMLElement | null>(null);
  const ownerId = account?.id ?? "";
  const currentCvs = listOwner === ownerId ? cvs : [];
  const load = useCallback(
    async (token?: string) => {
      if (!ownerId) return;
      const generation = loadGeneration.current;
      setLoading(true);
      try {
        const data = await cvApi.listCvs(24, token);
        if (generation !== loadGeneration.current) return;
        setListOwner(ownerId);
        setCvs((current) =>
          token
            ? [
                ...current,
                ...(data.cvs ?? []).filter(
                  (cv) => !current.some((item) => item.id === cv.id),
                ),
              ]
            : (data.cvs ?? []),
        );
        setTotal(data.totalSize ?? 0);
        setNext(data.nextPageToken ?? "");
        setError("");
      } catch {
        if (generation === loadGeneration.current)
          setError("无法读取简历列表，请重试。");
      } finally {
        if (generation === loadGeneration.current) setLoading(false);
      }
    },
    [ownerId],
  );
  const loadPublication = useCallback(async () => {
    if (!ownerId) return;
    const generation = loadGeneration.current;
    setPublicationLoading(true);
    setPublicationError("");
    try {
      const status = await getPublication();
      if (generation !== loadGeneration.current) return;
      setPublication(status);
      setPublicDocument(null);
      if (status.published) {
        const document = await getPublicResume({ public_id: status.publicId });
        if (generation === loadGeneration.current) setPublicDocument(document);
      }
    } catch {
      if (generation === loadGeneration.current)
        setPublicationError("无法读取公开状态，请重试或进入公开管理。");
    } finally {
      if (generation === loadGeneration.current) setPublicationLoading(false);
    }
  }, [ownerId]);
  useEffect(() => {
    let active = true;
    loadGeneration.current += 1;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCvs([]);
      setTotal(0);
      setNext("");
      setError("");
      setMessage("");
      setPublication(null);
      setPublicDocument(null);
      setCreate(false);
      setTarget(null);
      setRenaming(null);
      setExporting(null);
      setImportMode(null);
      if (ownerId) void load();
    });
    return () => {
      active = false;
      loadGeneration.current += 1;
    };
  }, [ownerId, load]);
  useEffect(() => {
    if (leftTab === "public" && ownerId)
      void Promise.resolve().then(loadPublication);
  }, [leftTab, ownerId, loadPublication]);
  useEffect(() => {
    function selectTemplates() {
      if (window.location.hash === "#resume-templates")
        setRightTab("templates");
    }
    selectTemplates();
    window.addEventListener("hashchange", selectTemplates);
    return () => window.removeEventListener("hashchange", selectTemplates);
  }, []);
  function beginCreate(selected: TemplateId, trigger: HTMLElement) {
    actionTrigger.current = trigger;
    if (!account) {
      openAuth();
      return;
    }
    setTitle("");
    setTemplate(selected);
    setActionError("");
    requestId.current = crypto.randomUUID();
    setCreate(true);
  }
  function beginImport(mode: "files" | "markdown", trigger: HTMLElement) {
    actionTrigger.current = trigger;
    if (!account) {
      openAuth();
      return;
    }
    setImportMode(mode);
  }
  return (
    <Content className="py-6 sm:py-6">
      <h1 className="sr-only">我的简历工作台</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <section
          aria-label="简历管理"
          className="min-w-0 rounded-md bg-surface px-4 pb-5 pt-3 sm:px-5 lg:min-h-[720px]"
        >
          <Tabs value={leftTab} onValueChange={setLeftTab} className="gap-0">
            <div className="flex items-center justify-between gap-3 border-b border-border">
              <TabsList variant="line" aria-label="简历列表" className="gap-6">
                <TabsTrigger value="private" className={TAB_CLASS}>
                  我的简历
                </TabsTrigger>
                <TabsTrigger value="public" className={TAB_CLASS}>
                  公开简历
                </TabsTrigger>
              </TabsList>
              {account && leftTab === "private" ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {listOwner === ownerId ? total : "—"} 份
                </span>
              ) : null}
            </div>
            {accountLoading ? (
              <p role="status" className="py-14 text-sm text-muted-foreground">
                正在读取工作区…
              </p>
            ) : !account ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-3 text-center">
                <FileText aria-hidden className="mb-4 size-9 text-primary/60" />
                <h2 className="text-base font-medium">开始整理你的经历</h2>
                <p className="mb-5 mt-2 text-sm leading-6 text-muted-foreground">
                  {accountError || "登录后，新建、编辑并管理个人简历。"}
                </p>
                {accountError ? (
                  <Button onClick={() => void refresh()}>重试连接</Button>
                ) : (
                  <Button onClick={() => openAuth()}>登录或注册</Button>
                )}
              </div>
            ) : (
              <>
                <TabsContent value="private" className="mt-5">
                  {error ? (
                    <div className="mb-4 space-y-2">
                      <StatusMessage>{error}</StatusMessage>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading}
                        onClick={() => void load()}
                      >
                        重试
                      </Button>
                    </div>
                  ) : null}
                  {message ? (
                    <p role="status" className="mb-4 text-sm text-primary">
                      {message}
                    </p>
                  ) : null}
                  {loading && !currentCvs.length ? (
                    <div
                      className="flex gap-4 py-1"
                      aria-label="正在加载简历"
                      role="status"
                    >
                      <div className="aspect-[.707] w-[42%] animate-pulse rounded-md bg-surface-subtle" />
                      <div className="h-6 w-[45%] animate-pulse rounded bg-surface-subtle" />
                    </div>
                  ) : currentCvs.length ? (
                    currentCvs.map((cv) => (
                      <ResumeCard
                        key={cv.id}
                        cv={cv}
                        busy={busy}
                        onDelete={(trigger) => {
                          actionTrigger.current = trigger;
                          setActionError("");
                          setTarget(cv);
                        }}
                        onRename={(trigger) => {
                          actionTrigger.current = trigger;
                          setActionError("");
                          setTitle(cv.displayName);
                          setRenaming(cv);
                        }}
                        onExport={(trigger) => {
                          actionTrigger.current = trigger;
                          setExporting(cv);
                        }}
                        onCopy={async () => {
                          if (busy) return;
                          setBusy(true);
                          setError("");
                          try {
                            const saved = await cvApi.getCv(cv.id);
                            const created = await cvApi.createCv({
                              ...editable(saved),
                              displayName: `${saved.displayName.slice(0, 250)} · 副本`,
                              requestId: crypto.randomUUID(),
                            });
                            router.push(`/cvs/${created.id}`);
                          } catch {
                            setError("复制失败，请检查登录后重试。");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    ))
                  ) : !error ? (
                    <div className="flex min-h-64 flex-col items-center justify-center text-center">
                      <FileText
                        aria-hidden
                        className="mb-4 size-9 text-primary/50"
                      />
                      <h2 className="font-medium">还没有简历</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        选择模板，开始你的第一份简历。
                      </p>
                    </div>
                  ) : null}
                  {next ? (
                    <Button
                      className="mt-4 w-full"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => void load(next)}
                    >
                      {loading ? "正在加载" : "加载更多"}
                    </Button>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(event) =>
                        beginCreate("standard", event.currentTarget)
                      }
                    >
                      <Plus aria-hidden className="size-4" />
                      新建简历
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) =>
                        beginImport("files", event.currentTarget)
                      }
                    >
                      <Upload aria-hidden className="size-4" />
                      导入
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="public" className="mt-5">
                  {publicationLoading ? (
                    <p
                      role="status"
                      className="py-10 text-sm text-muted-foreground"
                    >
                      正在读取公开简历…
                    </p>
                  ) : publicationError ? (
                    <div className="space-y-3">
                      <StatusMessage>{publicationError}</StatusMessage>
                      <Button
                        variant="secondary"
                        onClick={() => void loadPublication()}
                      >
                        重试公开状态
                      </Button>
                    </div>
                  ) : publication?.published ? (
                    <div>
                      {publicDocument ? (
                        <div className="relative w-40 overflow-hidden rounded-md bg-white">
                          <div
                            aria-hidden
                            inert
                            className="pointer-events-none"
                          >
                            <PaperPreview cv={publicDocument} firstPageOnly />
                          </div>
                          <Link
                            href={`/u/${publication.publicId}`}
                            aria-label="查看已公开简历"
                            className="absolute inset-0 rounded-md"
                          />
                        </div>
                      ) : null}
                      <h2 className="mt-4 break-all text-base font-medium">
                        {publication.sourceName || "已公开简历"}
                      </h2>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        已发布
                        {publication.updateTime
                          ? ` · ${updatedAt(publication.updateTime)}`
                          : ""}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        这里展示当前公开快照。私有简历的后续编辑不会自动公开。
                      </p>
                      <Button className="mt-4" variant="secondary" asChild>
                        <Link href={`/u/${publication.publicId}`}>
                          查看公开页面
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex min-h-64 flex-col items-center justify-center text-center">
                      <Globe
                        aria-hidden
                        className="mb-4 size-9 text-primary/50"
                      />
                      <h2 className="font-medium">还没有公开简历</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        选择内容，核对预览后再发布。
                      </p>
                    </div>
                  )}
                  <Button variant="ghost" className="mt-5" asChild>
                    <Link href="/settings/publication">
                      <Share2 aria-hidden className="size-4" />
                      管理公开简历
                    </Link>
                  </Button>
                </TabsContent>
              </>
            )}
          </Tabs>
        </section>
        <section
          aria-label="新建简历"
          id="resume-templates"
          className="min-w-0 scroll-mt-24 rounded-md bg-surface px-4 pb-6 pt-3 sm:px-6 lg:min-h-[720px]"
        >
          <Tabs value={rightTab} onValueChange={setRightTab} className="gap-0">
            <TabsList
              variant="line"
              aria-label="新建方式"
              className="w-full justify-start gap-4 border-b border-border sm:gap-7"
            >
              <TabsTrigger value="templates" className={TAB_CLASS}>
                从模板新建
              </TabsTrigger>
              <TabsTrigger value="markdown" className={TAB_CLASS}>
                Markdown 简历
              </TabsTrigger>
              <TabsTrigger value="import" className={TAB_CLASS}>
                导入简历
              </TabsTrigger>
            </TabsList>
            <TabsContent value="templates" className="mt-5">
              <TemplateGallery
                onCreate={beginCreate}
                onPreview={(selected, trigger) => {
                  actionTrigger.current = trigger;
                  setPreview(selected);
                }}
                onMarkdown={(trigger) => beginImport("markdown", trigger)}
              />
            </TabsContent>
            <TabsContent value="markdown" className="mt-5">
              <div className="flex min-h-[460px] flex-col items-center justify-center rounded-md bg-surface-subtle px-5 text-center">
                <FileCode2
                  aria-hidden
                  className="mb-6 size-16 text-primary"
                  strokeWidth={1.5}
                />
                <h2 className="text-xl font-medium">
                  用 Markdown 整理你的经历
                </h2>
                <p className="mb-6 mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  粘贴正文或上传 Markdown 文件，校对姓名和模块后另存为新简历。
                </p>
                <Button
                  className="rounded-md px-6"
                  onClick={(event) =>
                    beginImport("markdown", event.currentTarget)
                  }
                >
                  创建 Markdown 简历
                </Button>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  支持标题、段落、强调、列表与链接；版式由模板控制。
                </p>
              </div>
            </TabsContent>
            <TabsContent value="import" className="mt-5">
              <div className="flex min-h-[460px] flex-col items-center justify-center rounded-md bg-surface-subtle px-5 text-center">
                <Upload
                  aria-hidden
                  className="mb-6 size-14 text-primary"
                  strokeWidth={1.5}
                />
                <h2 className="text-xl font-medium">导入已有简历</h2>
                <p className="mb-6 mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  支持 CVory v1 JSON 备份和 Markdown，单文件不超过 10
                  MB。校对后另存，保留已有简历。
                </p>
                <Button
                  className="rounded-md px-6"
                  onClick={(event) => beginImport("files", event.currentTarget)}
                >
                  选择文件导入
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">
                  暂不支持 PDF、Word 或图片解析。
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>
      <Dialog
        open={create}
        onOpenChange={(open) => {
          if (!busy) setCreate(open);
        }}
        title="新建简历"
        description="选择初始版式，之后随时可以调整。简历将从空白内容开始。"
        returnFocusRef={actionTrigger}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !title.trim()) return;
            setBusy(true);
            setActionError("");
            try {
              const cv = await cvApi.createCv({
                displayName: title.trim(),
                requestId: requestId.current,
                styleSettings: templateStyle(template),
              });
              setCreate(false);
              router.push(`/cvs/${cv.id}`);
            } catch {
              setActionError("创建失败，请检查登录后重试。");
            } finally {
              setBusy(false);
            }
          }}
        >
          <FieldGroup>
            <FormField
              id="new-title"
              label="简历名称"
              value={title}
              onChange={setTitle}
              required
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs">初始模板</legend>
              <RadioGroup
                value={template}
                onValueChange={(value) => {
                  const selected = TEMPLATES.find((item) => item.id === value);
                  if (selected) setTemplate(selected.id);
                }}
              >
                {TEMPLATES.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-11 items-center gap-3 rounded-md bg-surface-subtle px-3 py-2 text-sm"
                  >
                    <RadioGroupItem value={item.id} aria-label={item.title} />
                    {item.title}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
            {actionError ? <StatusMessage>{actionError}</StatusMessage> : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setCreate(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy ? "创建中" : "创建并编辑"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>
      <Dialog
        open={!!renaming}
        onOpenChange={(open) => {
          if (!open && !busy) setRenaming(null);
        }}
        title="修改简历名称"
        description="只修改这份私有简历的名称。"
        returnFocusRef={actionTrigger}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!renaming || busy || !title.trim()) return;
            setBusy(true);
            setActionError("");
            try {
              const updated = await cvApi.updateCv(
                renaming.id,
                { displayName: title.trim(), updateMask: "displayName" },
                renaming.etag,
              );
              setCvs((current) =>
                current.map((cv) => (cv.id === updated.id ? updated : cv)),
              );
              setRenaming(null);
              setMessage("简历名称已更新。");
            } catch (cause) {
              setActionError(
                cause instanceof ApiError && cause.code === 409
                  ? "简历已有更新。请保留新名称，关闭后刷新列表再重试。"
                  : "改名失败，输入已保留，请重试。",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <FieldGroup>
            <FormField
              id="rename-title"
              label="简历名称"
              value={title}
              onChange={setTitle}
              required
            />
            {actionError ? <StatusMessage>{actionError}</StatusMessage> : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setRenaming(null)}
              >
                取消
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy ? "保存中" : "保存名称"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
        title={`删除「${target?.displayName}」？`}
        description="这份私有简历将永久删除，无法撤销。已发布内容需要另行撤回。"
        returnFocusRef={actionTrigger}
      >
        {actionError ? (
          <div className="mb-4">
            <StatusMessage>{actionError}</StatusMessage>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setTarget(null)}
          >
            保留
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!target || busy) return;
              setBusy(true);
              setActionError("");
              try {
                await cvApi.deleteCv(target.id, target.etag);
                setTarget(null);
                setMessage("简历已删除。");
                void load();
              } catch (cause) {
                setActionError(
                  cause instanceof ApiError && cause.code === 409
                    ? "简历已有更新，请关闭后刷新列表再确认删除。"
                    : "删除失败，列表已保留，请重试。",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "删除中" : "确认删除"}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={`${TEMPLATES.find((item) => item.id === preview)?.title ?? "模板"}预览`}
        description="合成示例仅用于展示版式，新建简历不会写入示例正文。"
        returnFocusRef={actionTrigger}
        className="max-w-2xl"
      >
        {preview ? (
          <>
            <div className="max-h-[60dvh] overflow-auto rounded-md bg-surface-subtle p-3">
              <div aria-hidden inert className="pointer-events-none">
                <PaperPreview cv={templateExample(preview)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPreview(null)}>
                关闭预览
              </Button>
              <Button
                onClick={(event) => {
                  const selected = preview;
                  setPreview(null);
                  beginCreate(
                    selected,
                    actionTrigger.current ?? event.currentTarget,
                  );
                }}
              >
                使用这个模板
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>
      {exporting ? (
        <ExportDialog
          open={!!exporting}
          onOpenChange={(open) => {
            if (!open) setExporting(null);
          }}
          cv={exporting}
          dirty={false}
          save={async () => true}
          returnFocusRef={actionTrigger}
        />
      ) : null}
      {importMode ? (
        <ImportDialog
          open
          mode={importMode}
          onOpenChange={(open) => {
            if (!open) setImportMode(null);
          }}
          returnFocusRef={actionTrigger}
        />
      ) : null}
    </Content>
  );
}
