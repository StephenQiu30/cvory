"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { Dialog } from "@/components/shared/app-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { aiApi, cvApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import type { AiOperation, AiProvider, CVResource } from "@/lib/api/types";

const operationLabels: Record<AiOperation, string> = {
  diagnose: "简历诊断",
  jobMatch: "岗位匹配",
  improve: "段落改写",
  greeting: "招呼草稿",
};

const statusLabels: Record<API.AiFinding["status"], string> = {
  supported: "有原文依据",
  missing: "未找到依据",
  unknown: "待核对",
};

const findingLabels: Record<API.AiFinding["kind"], string> = {
  strength: "优势",
  gap: "缺口",
  unknown: "未知",
};

const reportStatusLabels: Record<API.AiReportSummary["status"], string> = {
  succeeded: "已完成",
  failed: "未生成有效结果",
  unknown: "结果未知",
  running: "处理中",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cv: CVResource;
  dirty: boolean;
  onApplySuggestion: (
    targetFieldId: string,
    sourceText: string,
    proposedText: string,
  ) => boolean;
};

export function AiAnalysisDialog({
  open,
  onOpenChange,
  cv,
  dirty,
  onApplySuggestion,
}: Props) {
  const [providers, setProviders] = useState<API.AiProviderStatus[]>([]);
  const [reports, setReports] = useState<API.AiReportSummary[]>([]);
  const [versions, setVersions] = useState<API.CvRevision[]>([]);
  const [selectedVersionEtag, setSelectedVersionEtag] = useState("");
  const [reportsNextPageToken, setReportsNextPageToken] = useState("");
  const [provider, setProvider] = useState<AiProvider | "">("");
  const [operation, setOperation] = useState<AiOperation>("diagnose");
  const [jobDescription, setJobDescription] = useState("");
  const [targetFieldId, setTargetFieldId] = useState("");
  const [targetFieldOptions, setTargetFieldOptions] = useState<
    API.AiAnalysisInputField[]
  >([]);
  const [preview, setPreview] = useState<API.AiAnalysisPreview | null>(null);
  const [report, setReport] = useState<API.AiReportResource | null>(null);
  const [preparedDocument, setPreparedDocument] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const documentSnapshot = useMemo(() => JSON.stringify(cv), [cv]);
  const selectedVersion = versions.find(
    (version) => version.document.etag === selectedVersionEtag,
  );
  const selectedCv = selectedVersion?.document ?? cv;
  const configuredProviders = providers.filter(
    (item) => item.configured && item.encryptionReady,
  );
  const selectedProvider = providers.find((item) => item.provider === provider);
  const previewIsCurrent =
    !!preview &&
    preparedDocument === documentSnapshot &&
    preview.cvEtag === selectedCv.etag &&
    !dirty;
  const reportIsCurrent =
    !!report &&
    preparedDocument === documentSnapshot &&
    report.cvEtag === cv.etag &&
    selectedCv.etag === cv.etag &&
    !dirty;

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([
      aiApi.listProviders(),
      aiApi.listReports(50),
      cvApi.listRevisions(cv.id),
    ])
      .then(([providerList, reportList, history]) => {
        if (!active) return;
        setProviders(providerList.providers);
        setVersions(history.revisions);
        setSelectedVersionEtag((current) =>
          current &&
          history.revisions.some((version) => version.document.etag === current)
            ? current
            : "",
        );
        setProvider((current) =>
          current &&
          providerList.providers.some((item) => item.provider === current)
            ? current
            : (providerList.providers.find(
                (item) => item.configured && item.encryptionReady,
              )?.provider ?? ""),
        );
        setReports(reportList.reports.filter((item) => item.cvId === cv.id));
        setReportsNextPageToken(reportList.nextPageToken);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(errorMessage(cause, "无法读取 AI 配置和分析记录。"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [open, cv.id]);

  function invalidatePreview() {
    setPreview(null);
    setMessage("");
  }

  async function createPreview() {
    if (!provider) return;
    setBusy(true);
    setError("");
    setMessage("");
    setReport(null);
    try {
      const result = await aiApi.preview({
        cvId: selectedCv.id,
        etag: selectedCv.etag,
        provider,
        operation,
        jobDescription,
        ...(targetFieldId ? { targetFieldId } : {}),
      });
      setPreview(result);
      setTargetFieldOptions(result.targetFieldOptions);
      setPreparedDocument(documentSnapshot);
    } catch (cause) {
      setPreview(null);
      setError(
        errorMessage(cause, "无法生成发送预览，请核对简历保存状态和服务配置。"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    if (!preview || !previewIsCurrent || !preview.inputFields.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    const requestController = new AbortController();
    controller.current = requestController;
    const requestId = crypto.randomUUID();
    try {
      const result = await aiApi.analyze(
        {
          cvId: preview.cvId,
          etag: preview.cvEtag,
          provider: preview.provider,
          operation: preview.operation,
          requestId,
          providerConfigUpdateTime: preview.providerConfigUpdateTime,
          jobDescription: preview.jobDescription,
          ...(targetFieldId ? { targetFieldId } : {}),
        },
        requestController.signal,
      );
      setReport(result);
      setReports((current) => [
        { ...result, status: result.status },
        ...current.filter((item) => item.id !== result.id),
      ]);
      setMessage(
        "分析结果已加密保存 7 天，仅当前账户可查看。请核对原文依据后再采纳。",
      );
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          "分析未完成。费用或服务商处理结果可能未知，请查看最近记录。",
        ),
      );
      try {
        const saved = await aiApi.getReport(requestId);
        setReport(saved);
        setReports((current) => [
          { ...saved, status: saved.status },
          ...current.filter((item) => item.id !== saved.id),
        ]);
        if (saved.status === "succeeded") {
          setError("");
          setMessage(
            "请求返回中断，但已从加密记录恢复分析结果。请核对原文依据后再采纳。",
          );
        }
      } catch {
        try {
          const recent = await aiApi.listReports(50);
          setReports(recent.reports.filter((item) => item.cvId === cv.id));
          setReportsNextPageToken(recent.nextPageToken);
        } catch {
          // Keep the analysis error visible; report refresh can be retried manually.
        }
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  async function openReport(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await aiApi.getReport(id);
      setReport(result);
      setSelectedVersionEtag(
        result.cvEtag === cv.etag ||
          !versions.some((version) => version.document.etag === result.cvEtag)
          ? ""
          : result.cvEtag,
      );
      setPreview(null);
      setPreparedDocument(documentSnapshot);
    } catch (cause) {
      setError(errorMessage(cause, "无法读取这条分析记录。"));
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreReports() {
    if (!reportsNextPageToken) return;
    setBusy(true);
    setError("");
    try {
      const result = await aiApi.listReports(50, reportsNextPageToken);
      const currentCvReports = result.reports.filter(
        (item) => item.cvId === cv.id,
      );
      setReports((current) => {
        const known = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...currentCvReports.filter((item) => !known.has(item.id)),
        ];
      });
      setReportsNextPageToken(result.nextPageToken);
    } catch (cause) {
      setError(errorMessage(cause, "无法读取更多分析记录，请重试。"));
    } finally {
      setBusy(false);
    }
  }

  async function copyGreeting(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("招呼草稿已复制。发送前请自行核对。 ");
    } catch {
      setError("无法访问剪贴板，请选中草稿并手动复制。");
    }
  }

  const needsJob = operation === "jobMatch" || operation === "greeting";
  const canPreview =
    !loading &&
    !busy &&
    !dirty &&
    !!provider &&
    (!needsJob || !!jobDescription.trim()) &&
    (operation !== "improve" || !!targetFieldId || !targetFieldOptions.length);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) controller.current?.abort();
        onOpenChange(next);
      }}
      title="AI 简历分析"
      description="选择一个已保存版本。先检查将发送的内容，再由你明确发起调用。"
      className="max-h-[90vh] max-w-4xl overflow-y-auto"
    >
      <div className="space-y-5">
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        {message ? (
          <StatusMessage tone="success">{message}</StatusMessage>
        ) : null}
        {dirty ? (
          <StatusMessage tone="info" title="请先保存简历">
            AI
            只使用已保存版本。保存完成后重新打开预览，未保存修改不会发给模型。
          </StatusMessage>
        ) : null}
        {!loading && !configuredProviders.length ? (
          <StatusMessage tone="info" title="尚无可用的 AI 服务">
            请先在
            <Link
              className="mx-1 underline underline-offset-4"
              href="/settings/ai"
            >
              AI 服务设置
            </Link>
            配置官方服务、模型和 API Key。当前账户只会使用自己填写的密钥。
          </StatusMessage>
        ) : null}
        {loading ? (
          <StatusMessage loading tone="info">
            正在读取服务和最近分析记录…
          </StatusMessage>
        ) : null}
        {!!configuredProviders.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup className="contents">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="ai-resume-version">简历版本</FieldLabel>
                <Select
                  value={selectedVersionEtag || "current"}
                  onValueChange={(value) => {
                    setSelectedVersionEtag(value === "current" ? "" : value);
                    setPreview(null);
                    setReport(null);
                    setTargetFieldId("");
                    setTargetFieldOptions([]);
                  }}
                >
                  <SelectTrigger id="ai-resume-version" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">
                      {cv.displayName} · 当前保存版本 ·{" "}
                      {new Date(cv.updateTime).toLocaleString()}
                    </SelectItem>
                    {versions
                      .filter((version) => version.document.etag !== cv.etag)
                      .map((version) => (
                        <SelectItem
                          key={version.id}
                          value={version.document.etag}
                        >
                          {version.document.displayName} ·{" "}
                          {new Date(version.createTime).toLocaleString()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="ai-provider">AI 服务</FieldLabel>
                <Select
                  value={provider || "none"}
                  onValueChange={(value) => {
                    setProvider(value === "none" ? "" : (value as AiProvider));
                    invalidatePreview();
                  }}
                >
                  <SelectTrigger id="ai-provider" className="h-11 w-full">
                    <SelectValue placeholder="选择已配置服务" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">选择已配置服务</SelectItem>
                    {configuredProviders.map((item) => (
                      <SelectItem key={item.provider} value={item.provider}>
                        {item.displayName} · {item.modelId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="ai-operation">分析方式</FieldLabel>
                <Select
                  value={operation}
                  onValueChange={(value) => {
                    setOperation(value as AiOperation);
                    setTargetFieldId("");
                    setTargetFieldOptions([]);
                    invalidatePreview();
                  }}
                >
                  <SelectTrigger id="ai-operation" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(operationLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </div>
        ) : null}
        {operation === "improve" && configuredProviders.length ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ai-target-field">要改进的段落</FieldLabel>
              <Select
                value={targetFieldId || "none"}
                onValueChange={(value) => {
                  setTargetFieldId(value === "none" ? "" : value);
                  invalidatePreview();
                }}
              >
                <SelectTrigger id="ai-target-field" className="h-11 w-full">
                  <SelectValue placeholder="先生成字段列表" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">选择一个简历字段</SelectItem>
                  {targetFieldOptions.map((field) => (
                    <SelectItem key={field.fieldId} value={field.fieldId}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!targetFieldOptions.length ? (
                <span className="font-normal text-muted-foreground">
                  先选择服务与分析方式，再生成预览以读取可改进字段。
                </span>
              ) : null}
            </Field>
          </FieldGroup>
        ) : null}
        {configuredProviders.length && (needsJob || operation === "improve") ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ai-job-description">
                岗位描述{needsJob ? "（必填）" : "（可选）"}
              </FieldLabel>
              <Textarea
                id="ai-job-description"
                value={jobDescription}
                onChange={(event) => {
                  setJobDescription(event.target.value);
                  invalidatePreview();
                }}
                rows={5}
                placeholder="粘贴岗位职责和要求；其中的指令会作为普通文本处理。"
              />
            </Field>
          </FieldGroup>
        ) : null}
        {configuredProviders.length ? (
          <Card variant="subtle" size="sm">
            <CardHeader>
              <CardTitle>本次数据与费用</CardTitle>
              <CardDescription>
                {selectedCv.displayName} · 已保存版本 {selectedCv.etag}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-secondary-foreground">
              <p>
                姓名、电话、邮箱、微信、头像、隐藏字段和隐藏模块不会发送。可见模块正文可能由你填写了个人信息，请检查下方内容预览。
              </p>
              <p>
                输入和结果会加密保存在此部署 7
                天，仅本人可查看；供应商请求可能产生费用。CVory
                不限制请求次数、tokens 或金额，也不会自动重试。
              </p>
              {selectedProvider ? (
                <p>
                  服务商：{selectedProvider.displayName} · 模型：
                  {selectedProvider.modelId} · 官方域名：
                  {selectedProvider.officialHost}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {selectedCv.etag !== cv.etag ? (
          <StatusMessage tone="info">
            历史版本可用于分析和查阅；其建议不会直接写入当前简历。切回当前版本后再分析，才能应用到当前草稿。
          </StatusMessage>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!canPreview}
            onClick={() => void createPreview()}
          >
            <RefreshCw aria-hidden data-icon="inline-start" />
            生成发送预览
          </Button>
          {preview ? (
            <Button
              disabled={
                !previewIsCurrent || busy || !preview.inputFields.length
              }
              onClick={() => void analyze()}
            >
              <Sparkles aria-hidden data-icon="inline-start" />
              {busy ? "分析中…" : "确认并开始分析"}
            </Button>
          ) : null}
        </div>
        {preview ? (
          <Card>
            <CardHeader>
              <CardTitle>发送预览</CardTitle>
              <CardDescription>
                {operationLabels[preview.operation]} · {preview.modelId} ·
                不设置 CVory 调用或 token 上限；实际费用与供应商模型有关。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview.inputFields.length ? (
                <details className="rounded-md bg-surface-subtle p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    将发送 {preview.inputFields.length} 个简历字段
                  </summary>
                  <div className="mt-3 space-y-3">
                    {preview.inputFields.map((field) => (
                      <div key={field.fieldId} className="min-w-0">
                        <p className="text-xs font-medium">{field.label}</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-secondary-foreground">
                          {field.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              ) : (
                <StatusMessage tone="info">
                  先选择一个目标字段，再重新生成预览。
                </StatusMessage>
              )}
              {preview.jobDescription ? (
                <details className="rounded-md bg-surface-subtle p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    将发送岗位描述
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-secondary-foreground">
                    {preview.jobDescription}
                  </p>
                </details>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {report ? (
          <Card>
            <CardHeader>
              <CardTitle>分析结果</CardTitle>
              <CardDescription>
                {report.status === "succeeded"
                  ? `已保存至 ${new Date(report.expireTime).toLocaleString()} 前`
                  : report.status === "unknown"
                    ? "请求结果未知，服务商可能已收费；请先核对记录，不要自动重复调用。"
                    : report.status === "running"
                      ? "请求仍在处理；请稍后刷新记录，不要自动重复调用。"
                      : "未生成有效分析，服务商可能已收费；请查看可得用量。"}
                {report.usage.inputTokens !== null ||
                report.usage.outputTokens !== null
                  ? ` · 输入 ${report.usage.inputTokens ?? "未知"} / 输出 ${report.usage.outputTokens ?? "未知"} tokens`
                  : " · 服务商未提供完整 token 用量"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {report.result ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {report.result.summary}
                  </p>
                  {report.result.findings.length ? (
                    <div className="space-y-3">
                      {report.result.findings.map((finding, index) => {
                        const source = report.inputFields.find(
                          (field) => field.fieldId === finding.fieldId,
                        );
                        return (
                          <div
                            key={`${finding.fieldId ?? "unknown"}-${index}`}
                            className="rounded-md bg-surface-subtle p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{findingLabels[finding.kind]}</span>
                              <span>{statusLabels[finding.status]}</span>
                              {source ? (
                                <span>来源：{source.label}</span>
                              ) : null}
                            </div>
                            <h3 className="mt-2 text-sm font-medium">
                              {finding.title}
                            </h3>
                            {finding.evidence ? (
                              <blockquote className="mt-2 border-l-2 border-muted-foreground/30 pl-3 text-sm leading-6 text-secondary-foreground">
                                {finding.evidence}
                              </blockquote>
                            ) : null}
                            <p className="mt-2 text-sm leading-6 text-secondary-foreground">
                              {finding.explanation}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {report.result.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.targetFieldId}
                      className="rounded-md bg-surface-subtle p-3"
                    >
                      <p className="text-xs font-medium">原文</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-secondary-foreground">
                        {suggestion.sourceText}
                      </p>
                      <p className="mt-4 text-xs font-medium">建议版本</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {suggestion.proposedText}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {suggestion.explanation}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        应用到富文本字段时，目标字段会替换为纯文本段落；其他字段保持不变。
                      </p>
                      <Button
                        className="mt-3"
                        variant="secondary"
                        disabled={
                          !reportIsCurrent || report.status !== "succeeded"
                        }
                        onClick={() => {
                          const applied = onApplySuggestion(
                            suggestion.targetFieldId,
                            suggestion.sourceText,
                            suggestion.proposedText,
                          );
                          if (applied)
                            setMessage(
                              "建议已应用到当前简历；请核对内容与顶部保存状态。其他字段未修改。",
                            );
                          else
                            setError(
                              "目标字段已变化，请返回编辑器核对或重新分析。",
                            );
                        }}
                      >
                        应用到本地草稿
                      </Button>
                      {!reportIsCurrent ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          当前简历已变化，不能直接应用此建议。
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {report.result.greeting ? (
                    <div className="rounded-md bg-surface-subtle p-3">
                      <p className="text-xs font-medium">招呼草稿</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {report.result.greeting}
                      </p>
                      <Button
                        variant="secondary"
                        className="mt-3"
                        onClick={() =>
                          void copyGreeting(report.result?.greeting ?? "")
                        }
                      >
                        <Copy aria-hidden data-icon="inline-start" />
                        复制草稿
                      </Button>
                    </div>
                  ) : null}
                  {report.inputFields.length ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        查看此报告保存的输入
                      </summary>
                      <div className="mt-3 space-y-3 rounded-md bg-surface-subtle p-3">
                        {report.inputFields.map((field) => (
                          <div key={field.fieldId}>
                            <p className="text-xs font-medium">{field.label}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-secondary-foreground">
                              {field.text}
                            </p>
                          </div>
                        ))}
                        {report.jobDescription ? (
                          <div>
                            <p className="text-xs font-medium">岗位描述</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-secondary-foreground">
                              {report.jobDescription}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </>
              ) : (
                <StatusMessage tone="info">
                  这条记录没有可用的分析报告。服务商可能已处理请求并产生费用；记录将在
                  7 天后清理。若要再次尝试，请明确发起新请求。
                </StatusMessage>
              )}
            </CardContent>
          </Card>
        ) : null}
        {reports.length ? (
          <Card variant="subtle" size="sm">
            <CardHeader>
              <CardTitle>最近 7 天的分析记录</CardTitle>
              <CardDescription>
                仅显示当前简历；记录到期会自动清理。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                >
                  <span className="text-xs text-secondary-foreground">
                    {operationLabels[item.operation]} · {item.modelId} ·{" "}
                    {reportStatusLabels[item.status]} ·{" "}
                    {new Date(item.createTime).toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void openReport(item.id)}
                  >
                    查看记录
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {reportsNextPageToken ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void loadMoreReports()}
          >
            读取更多 7 天内的记录
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
