"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Globe, Copy, Eye } from "lucide-react";
import { cvApi } from "@/lib/api/client";
import type { CVResource } from "@/lib/api/types";
import {
  getPublication,
  previewPublication,
  publishPublication,
  withdrawPublication,
} from "@/lib/api/generated/api/publication";
import { PageHeader } from "@/components/layout/content";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { ResumeDocument } from "@/components/resume/resume-document";
const FIELDS = [
  ["email", "电子邮箱"],
  ["phone", "联系电话"],
  ["location", "所在城市"],
  ["website", "个人网站"],
  ["github", "GitHub"],
  ["avatarUrl", "简历照片"],
] as const;
export default function Publication() {
  const [cvs, setCvs] = useState<CVResource[]>([]);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<API.PublicationStatus | null>(null);
  const [fields, setFields] = useState<string[]>([
    "email",
    "location",
    "website",
    "github",
  ]);
  const [modules, setModules] = useState<string[]>([]);
  const [review, setReview] = useState<API.PublicationReview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const current = cvs.find((c) => c.id === source);
  async function load() {
    setLoading(true);
    try {
      const [list, pub] = await Promise.all([
        cvApi.listCvs(100),
        getPublication(),
      ]);
      setCvs(list.cvs ?? []);
      setStatus(pub);
      setUrl(`${location.origin}/u/${pub.publicId}`);
      const first = list.cvs?.[0];
      if (first) {
        setSource(first.id);
        setModules(
          first.sections.filter((s) => s.visible !== false).map((s) => s.id),
        );
      }
      setError("");
    } catch {
      setError("无法读取公开设置，请重试。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  async function capture() {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const saved = await cvApi.getCv(current.id);
      const frozen = await previewPublication({
        sourceId: saved.id,
        etag: saved.etag,
        fields,
        sectionIds: modules,
      });
      setReview(frozen);
    } catch {
      setError("无法预览，请确认已保存姓名、来源仍可访问且登录有效。");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!review) return;
    setBusy(true);
    setError("");
    const request = { reviewId: review.id };
    try {
      setStatus(await publishPublication(request));
      setConfirm(false);
      setReview(null);
      setMessage("公开内容已更新");
    } catch {
      setError("发布失败，原公开内容已保留。可重试当前预览，或重新登录。");
    } finally {
      setBusy(false);
    }
  }
  if (review && !confirm)
    return (
      <div>
        <PageHeader
          title="本次公开预览"
          description={`仅你可见 · 来源：${review.sourceName}。后续编辑不会自动进入此预览。`}
          actions={
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                返回设置
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void capture()}
              >
                刷新预览
              </Button>
              <Button disabled={busy} onClick={() => setConfirm(true)}>
                确认发布
              </Button>
            </>
          }
        />
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <div className="rounded-md bg-white p-5 sm:p-8">
          <ResumeDocument web document={review.document} />
        </div>
      </div>
    );
  return (
    <>
      <PageHeader
        title="公开简历"
        description="选择一份已保存简历，核对后发布到固定网址。保存简历不会自动更新公开页。"
      />
      {loading ? (
        <p role="status">正在读取公开设置…</p>
      ) : (
        <FieldGroup>
          {error ? (
            <>
              <StatusMessage>{error}</StatusMessage>
              <Button variant="ghost" onClick={() => void load()}>
                重新读取
              </Button>
            </>
          ) : null}
          {message ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}
          <div className="flex items-center gap-2 text-sm">
            <Globe aria-hidden className="size-4" />
            {status?.published ? "已发布" : "尚未发布"}
            {status?.sourceName ? (
              <span className="text-xs text-muted-foreground">
                来源：{status.sourceName}
              </span>
            ) : null}
          </div>
          <FormField id="public-url" label="公开网址">
            <input
              id="public-url"
              className="h-11 w-full rounded-md border-0 bg-control px-3 text-sm"
              value={url}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <a
              href={url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center px-3 text-sm text-link"
            >
              查看公开页
            </a>
            <Button
              variant="ghost"
              onClick={async () => {
                if (!status?.published) {
                  setMessage("请先预览并发布内容，再分享公开链接。");
                  return;
                }
                try {
                  await navigator.clipboard.writeText(url);
                  setMessage("链接已复制");
                  setCopyFailed(false);
                } catch {
                  setCopyFailed(true);
                  setMessage("复制失败，请在上方网址中全选并手动复制。");
                }
              }}
            >
              <Copy aria-hidden className="size-4" />
              复制链接
            </Button>
            {status?.published ? (
              <Button variant="ghost" onClick={() => setWithdrawing(true)}>
                撤回公开内容
              </Button>
            ) : null}
          </div>
          {copyFailed ? (
            <p className="text-xs text-muted-foreground">
              网址输入框支持全选复制。
            </p>
          ) : null}
          <FormField id="source" label="内容来源">
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v);
                setModules(
                  cvs
                    .find((c) => c.id === v)
                    ?.sections.filter((s) => s.visible !== false)
                    .map((s) => s.id) ?? [],
                );
              }}
            >
              <SelectTrigger
                id="source"
                className="w-full border-0 bg-surface-subtle"
              >
                <SelectValue placeholder="选择已保存简历" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cvs.map((cv) => (
                    <SelectItem key={cv.id} value={cv.id}>
                      {cv.displayName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormField>
          {!cvs.length ? (
            <p className="text-sm">
              还没有可选简历，请先
              <Link className="text-link" href="/">
                创建简历
              </Link>
              。
            </p>
          ) : null}
          <p className="text-xs leading-5 text-muted-foreground">
            姓名和求职职位随简历展示。源简历中隐藏或空白的信息不会公开。
          </p>
          <fieldset className="space-y-2">
            <legend className="mb-3 text-sm font-medium">公开信息</legend>
            {FIELDS.map(([key, label]) => (
              <label
                key={key}
                className="flex min-h-11 items-center justify-between gap-4 text-sm"
              >
                {label}
                <Switch
                  checked={fields.includes(key)}
                  onCheckedChange={(v) =>
                    setFields(
                      v ? [...fields, key] : fields.filter((f) => f !== key),
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-3 text-sm font-medium">展示模块</legend>
            {current?.sections.map((s) => (
              <label
                key={s.id}
                className="flex min-h-11 items-center justify-between gap-4 text-sm"
              >
                {s.title}
                {s.visible === false ? (
                  <span className="mr-auto text-xs text-muted-foreground">
                    来源中已隐藏
                  </span>
                ) : null}
                <Switch
                  checked={modules.includes(s.id)}
                  onCheckedChange={(v) =>
                    setModules(
                      v
                        ? [...modules, s.id]
                        : modules.filter((k) => k !== s.id),
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
          <div className="sticky bottom-0 flex justify-end gap-2 bg-background py-4">
            <Button disabled={busy || !current} onClick={() => void capture()}>
              <Eye aria-hidden className="size-4" />
              {busy ? "读取中" : "预览公开内容"}
            </Button>
          </div>
        </FieldGroup>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(v) => !busy && setConfirm(v)}
        title="发布本次预览？"
        description={`即将公开「${review?.document.profile.fullName ?? ""}」的选定信息。来源：${review?.sourceName ?? ""}。后续编辑需重新预览并发布。`}
      >
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            核对预览
          </Button>
          <Button disabled={busy} onClick={() => void publish()}>
            {busy ? "发布中" : "确认发布"}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={withdrawing}
        onOpenChange={(v) => !busy && setWithdrawing(v)}
        title="撤回公开简历？"
        description="本站公开页将停止展示。私有简历保留，已被访客保存的副本无法召回。"
      >
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setWithdrawing(false)}
          >
            保留公开
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await withdrawPublication();
                setStatus((s) =>
                  s ? { ...s, published: false, sourceName: "" } : s,
                );
                setWithdrawing(false);
                setMessage("公开内容已撤回");
              } catch {
                setError("撤回失败，公开页仍保留。请重试。");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "撤回中" : "确认撤回"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
