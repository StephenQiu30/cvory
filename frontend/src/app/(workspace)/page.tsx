"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Upload,
  FileText,
  ArrowRight,
  Ellipsis,
  Copy,
  Trash2,
} from "lucide-react";
import { cvApi } from "@/lib/api/client";
import type { CVResource, StyleSettings } from "@/lib/api/types";
import { TEMPLATES, DEFAULT_STYLE, editable } from "@/lib/resume/model";
import { Content, PageHeader } from "@/components/layout/content";
import { useAccount } from "@/components/account/account-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { PaperPreview } from "@/components/ui/paper-preview";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { StatusMessage } from "@/components/ui/status-message";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ImportDialog } from "@/components/resume/import-dialog";
function ResumeCard({
  cv,
  onDelete,
  onCopy,
}: {
  cv: CVResource;
  onDelete: () => void;
  onCopy: () => void;
}) {
  return (
    <article className="min-w-0">
      <Link
        href={`/cvs/${cv.id}`}
        aria-label={`编辑${cv.displayName}`}
        className="flex aspect-[1.06] items-center justify-center overflow-hidden rounded-[24px] bg-surface-subtle p-6 transition-transform hover:scale-[1.01]"
      >
        <div className="pointer-events-none w-[66%]" aria-hidden>
          <PaperPreview cv={cv} firstPageOnly />
        </div>
      </Link>
      <div className="px-3 pt-4">
        <h2 className="truncate text-sm font-medium" title={cv.displayName}>
          {cv.displayName}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {TEMPLATES.find((t) => t.id === cv.styleSettings.templateId)?.title} ·{" "}
          {new Date(cv.updateTime).toLocaleDateString("zh-CN")} 更新
        </p>
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={`/cvs/${cv.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-xs text-link"
          >
            编辑简历
            <ArrowRight aria-hidden className="size-3" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${cv.displayName}更多操作`}
              >
                <Ellipsis aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={onCopy}>
                  <Copy />
                  复制为新版本
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDelete}>
                  <Trash2 />
                  删除简历
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
  } = useAccount();
  const [cvs, setCvs] = useState<CVResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState("");
  const [total, setTotal] = useState(0);
  const [create, setCreate] = useState(false);
  const [importing, setImport] = useState(false);
  const [title, setTitle] = useState("");
  const [template, setTemplate] =
    useState<StyleSettings["templateId"]>("standard");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<CVResource | null>(null);
  const router = useRouter();
  const requestId = useRef("");
  const load = useCallback(async (token?: string) => {
    setLoading(true);
    try {
      const data = await cvApi.listCvs(24, token);
      setCvs((current) =>
        token
          ? [
              ...current,
              ...(data.cvs ?? []).filter(
                (cv) => !current.some((v) => v.id === cv.id),
              ),
            ]
          : (data.cvs ?? []),
      );
      setTotal(data.totalSize ?? 0);
      setNext(data.nextPageToken ?? "");
      setError("");
    } catch {
      setError("无法读取简历列表，请重试。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (account?.id) void Promise.resolve().then(() => load());
  }, [account, load]);
  return (
    <Content>
      <PageHeader
        title="我的简历"
        description={account ? `${total} 份简历` : "管理属于你的经历与表达。"}
        actions={
          account && cvs.length ? (
            <>
              <Button variant="secondary" onClick={() => setImport(true)}>
                <Upload aria-hidden className="size-4" />
                导入
              </Button>
              <Button
                onClick={() => {
                  setTitle("");
                  requestId.current = crypto.randomUUID();
                  setCreate(true);
                }}
              >
                <Plus aria-hidden className="size-4" />
                新建简历
              </Button>
            </>
          ) : undefined
        }
      />
      {accountLoading ? (
        <p role="status" className="py-12 text-sm text-muted-foreground">
          正在读取工作区…
        </p>
      ) : !account ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia>
              <FileText aria-hidden className="size-6" />
            </EmptyMedia>
            <EmptyTitle>开始整理你的经历</EmptyTitle>
            <EmptyDescription>
              {accountError || "登录后，新建、编辑并管理个人简历。"}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {accountError ? (
              <Button onClick={() => void refresh()}>重试连接</Button>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-primary px-4 py-3 text-sm text-primary-foreground"
              >
                登录或注册
              </Link>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {error ? (
            <div className="mb-6 flex items-center justify-between gap-3">
              <StatusMessage>{error}</StatusMessage>
              <Button variant="secondary" onClick={() => void load()}>
                重试
              </Button>
            </div>
          ) : null}
          {loading && !cvs.length ? (
            <div
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="正在加载简历"
            >
              {[0, 1, 2].map((i) => (
                <div
                  className="aspect-[1.06] animate-pulse rounded-md bg-surface-subtle"
                  key={i}
                />
              ))}
            </div>
          ) : cvs.length ? (
            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {cvs.map((cv) => (
                <ResumeCard
                  key={cv.id}
                  cv={cv}
                  onDelete={() => {
                    setError("");
                    setTarget(cv);
                  }}
                  onCopy={async () => {
                    if (busy) return;
                    setBusy(true);
                    try {
                      const created = await cvApi.createCv({
                        ...editable(cv),
                        displayName: `${cv.displayName} · 副本`,
                      });
                      router.push(`/cvs/${created.id}`);
                    } catch {
                      setError("复制失败，请重试。");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ))}
            </div>
          ) : !error ? (
            <Empty className="min-h-80">
              <EmptyHeader>
                <EmptyMedia>
                  <FileText aria-hidden className="size-6" />
                </EmptyMedia>
                <EmptyTitle>还没有简历</EmptyTitle>
                <EmptyDescription>
                  从空白内容开始，选择适合你的表达方式。
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onClick={() => {
                    setTitle("");
                    requestId.current = crypto.randomUUID();
                    setCreate(true);
                  }}
                >
                  <Plus aria-hidden className="size-4" />
                  新建简历
                </Button>
                <Button variant="ghost" onClick={() => setImport(true)}>
                  导入已有内容
                </Button>
              </EmptyContent>
            </Empty>
          ) : null}
          {next ? (
            <Button
              className="mt-8"
              variant="ghost"
              disabled={loading}
              onClick={() => void load(next)}
            >
              {loading ? "正在加载" : "加载更多"}
            </Button>
          ) : null}
        </>
      )}
      <Dialog
        open={create}
        onOpenChange={(v) => {
          if (!busy) setCreate(v);
        }}
        title="新建简历"
        description="选择初始版式，之后随时可以调整。简历将从空白内容开始。"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !title.trim()) return;
            setBusy(true);
            setError("");
            try {
              const cv = await cvApi.createCv({
                displayName: title.trim(),
                requestId: requestId.current,
                styleSettings: { ...DEFAULT_STYLE, templateId: template },
              });
              setCreate(false);
              router.push(`/cvs/${cv.id}`);
            } catch {
              setError("创建失败，请检查登录后重试。");
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
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs">初始模板</legend>
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className="flex min-h-11 items-center gap-3 rounded-md bg-surface-subtle px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="template"
                    checked={template === t.id}
                    onChange={() => setTemplate(t.id)}
                  />
                  {t.title}
                  <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                    {t.detail}
                  </span>
                </label>
              ))}
            </fieldset>
            {error ? <StatusMessage>{error}</StatusMessage> : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setCreate(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "创建中" : "创建并编辑"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>
      <Dialog
        open={!!target}
        onOpenChange={(v) => {
          if (!v && !busy) setTarget(null);
        }}
        title={`删除「${target?.displayName}」？`}
        description="这份私有简历将永久删除，无法撤销。已发布内容需要另行撤回。"
      >
        {error ? (
          <div className="mb-4">
            <StatusMessage>{error}</StatusMessage>
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
            disabled={busy}
            onClick={async () => {
              if (!target) return;
              setBusy(true);
              try {
                await cvApi.deleteCv(target.id, target.etag);
                setTarget(null);
                void load();
              } catch {
                setError("删除失败，列表已保留，请重试。");
              } finally {
                setBusy(false);
              }
            }}
          >
            确认删除
          </Button>
        </div>
      </Dialog>
      <ImportDialog open={importing} onOpenChange={setImport} />
    </Content>
  );
}
