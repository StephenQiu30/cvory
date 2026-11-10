"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { useAccount } from "@/components/account/account-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Content, PageHeader } from "@/components/layout/content";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { cvApi, deliveryApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";

const defaultGreeting =
  "您好，我关注到贵司的「{{jobTitle}}」岗位，希望进一步了解该职位。";

type PreferencesDraft = {
  includeKeywords: string;
  excludeKeywords: string;
  cities: string;
  salaryMinK: string;
  salaryMaxK: string;
  excludedCompanies: string;
  greetingTemplate: string;
};

type JobDraft = {
  title: string;
  company: string;
  city: string;
  salaryMinK: string;
  salaryMaxK: string;
  description: string;
  sourceUrl: string;
};

const emptyJob: JobDraft = {
  title: "",
  company: "",
  city: "",
  salaryMinK: "",
  salaryMaxK: "",
  description: "",
  sourceUrl: "",
};

function lines(value: string[]): string {
  return value.join("\n");
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1000)
    throw new Error("薪资请填写 0 到 1000 之间的整数（千元/月）。");
  return parsed;
}

function greetingFor(template: string, job: API.DeliveryJobResource): string {
  return template
    .replace(/\{\{\s*company\s*\}\}/g, job.company)
    .replace(/\{\{\s*jobTitle\s*\}\}/g, job.title)
    .replace(/\{\{\s*city\s*\}\}/g, job.city);
}

const matchLabels: Record<API.DeliveryJobResource["matchStatus"], string> = {
  eligible: "符合已设条件",
  review: "需要核对",
  excluded: "不符合条件",
  unfiltered: "尚未设置筛选条件",
};

function matchVariant(status: API.DeliveryJobResource["matchStatus"]) {
  if (status === "excluded") return "destructive" as const;
  if (status === "eligible") return "default" as const;
  return "secondary" as const;
}

function conditionLabel(status: API.DeliveryMatchCondition["status"]): string {
  return {
    matched: "符合",
    mismatched: "不符",
    unknown: "未知",
    notConfigured: "未设置",
  }[status];
}

function salaryLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return "薪资待补充";
  if (min === null) return `最高 ${max}k/月`;
  if (max === null) return `最低 ${min}k/月`;
  return `${min}–${max}k/月`;
}

export default function DeliveryPreparationPage() {
  const {
    account,
    loading: accountLoading,
    error: accountError,
    refresh,
    openAuth,
  } = useAccount();
  const [preferences, setPreferences] = useState<PreferencesDraft>({
    includeKeywords: "",
    excludeKeywords: "",
    cities: "",
    salaryMinK: "",
    salaryMaxK: "",
    excludedCompanies: "",
    greetingTemplate: defaultGreeting,
  });
  const [jobs, setJobs] = useState<API.DeliveryJobResource[]>([]);
  const [tasks, setTasks] = useState<API.DeliveryTaskResource[]>([]);
  const [cvs, setCvs] = useState<API.CVResource[]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [jobDraft, setJobDraft] = useState<JobDraft>(emptyJob);
  const [loadedOwnerId, setLoadedOwnerId] = useState("");
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskActionId, setTaskActionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pendingTaskRequest = useRef<{ key: string; id: string } | null>(null);

  const selectedCv = useMemo(
    () => cvs.find((cv) => cv.id === selectedCvId) ?? null,
    [cvs, selectedCvId],
  );

  useEffect(() => {
    if (!account) return;
    let active = true;
    Promise.all([
      deliveryApi.getPreferences(),
      deliveryApi.listJobs(),
      deliveryApi.listTasks(),
      cvApi.listCvs(100),
    ])
      .then(([currentPreferences, jobList, taskList, cvList]) => {
        if (!active) return;
        setPreferences({
          includeKeywords: lines(currentPreferences.includeKeywords),
          excludeKeywords: lines(currentPreferences.excludeKeywords),
          cities: lines(currentPreferences.cities),
          salaryMinK: currentPreferences.salaryMinK?.toString() ?? "",
          salaryMaxK: currentPreferences.salaryMaxK?.toString() ?? "",
          excludedCompanies: lines(currentPreferences.excludedCompanies),
          greetingTemplate: currentPreferences.greetingTemplate,
        });
        setJobs(jobList.jobs);
        setTasks(taskList.tasks);
        setCvs(cvList.cvs);
        setSelectedCvId((current) => current || cvList.cvs[0]?.id || "");
      })
      .catch((cause: unknown) => {
        if (active)
          setError(errorMessage(cause, "无法读取求职准备资料，请重试。"));
      })
      .finally(() => {
        if (active) setLoadedOwnerId(account.id);
      });
    return () => {
      active = false;
    };
  }, [account?.id, account]);

  async function reloadJobs() {
    const result = await deliveryApi.listJobs();
    setJobs(result.jobs);
    const eligibleIds = new Set(
      result.jobs
        .filter((job) => job.matchStatus !== "excluded")
        .map((job) => job.id),
    );
    setSelectedJobIds(
      (current) => new Set([...current].filter((id) => eligibleIds.has(id))),
    );
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPreferences(true);
    setError("");
    setMessage("");
    try {
      const salaryMinK = optionalInteger(preferences.salaryMinK);
      const salaryMaxK = optionalInteger(preferences.salaryMaxK);
      if (salaryMinK !== null && salaryMaxK !== null && salaryMinK > salaryMaxK)
        throw new Error("月薪下限不能高于上限。");
      const result = await deliveryApi.updatePreferences({
        includeKeywords: parseLines(preferences.includeKeywords),
        excludeKeywords: parseLines(preferences.excludeKeywords),
        cities: parseLines(preferences.cities),
        salaryMinK,
        salaryMaxK,
        excludedCompanies: parseLines(preferences.excludedCompanies),
        greetingTemplate: preferences.greetingTemplate,
      });
      setPreferences({
        includeKeywords: lines(result.includeKeywords),
        excludeKeywords: lines(result.excludeKeywords),
        cities: lines(result.cities),
        salaryMinK: result.salaryMinK?.toString() ?? "",
        salaryMaxK: result.salaryMaxK?.toString() ?? "",
        excludedCompanies: lines(result.excludedCompanies),
        greetingTemplate: result.greetingTemplate,
      });
      await reloadJobs();
      setMessage("筛选偏好已保存，候选岗位已重新计算。");
    } catch (cause) {
      setError(errorMessage(cause, "保存筛选偏好失败。"));
    } finally {
      setSavingPreferences(false);
    }
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingJob(true);
    setError("");
    setMessage("");
    try {
      const salaryMinK = optionalInteger(jobDraft.salaryMinK);
      const salaryMaxK = optionalInteger(jobDraft.salaryMaxK);
      if (salaryMinK !== null && salaryMaxK !== null && salaryMinK > salaryMaxK)
        throw new Error("岗位薪资下限不能高于上限。");
      const created = await deliveryApi.createJob({
        title: jobDraft.title.trim(),
        company: jobDraft.company.trim(),
        city: jobDraft.city.trim(),
        salaryMinK,
        salaryMaxK,
        description: jobDraft.description,
        sourceUrl: jobDraft.sourceUrl.trim() || undefined,
      });
      setJobs((current) => [created, ...current]);
      setJobDraft(emptyJob);
      setMessage("岗位已加入个人候选列表；CVory 未读取你填写的链接。");
    } catch (cause) {
      setError(errorMessage(cause, "添加岗位失败，请检查输入。"));
    } finally {
      setCreatingJob(false);
    }
  }

  async function deleteJob(id: string) {
    setDeletingJobId(id);
    setError("");
    setMessage("");
    try {
      await deliveryApi.deleteJob(id);
      setJobs((current) => current.filter((job) => job.id !== id));
      setSelectedJobIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setMessage("候选岗位已删除。");
    } catch (cause) {
      setError(errorMessage(cause, "删除岗位失败，请重试。"));
    } finally {
      setDeletingJobId("");
    }
  }

  function toggleJob(id: string) {
    if (!selectedJobIds.has(id) && selectedJobIds.size >= 50) {
      setError("每个离线准备任务最多选择 50 个岗位。");
      return;
    }
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyGreeting(job: API.DeliveryJobResource) {
    try {
      await navigator.clipboard.writeText(
        greetingFor(preferences.greetingTemplate, job),
      );
      setError("");
      setMessage("招呼草稿已复制。请自行核对并在平台手工处理。");
    } catch {
      setError("复制失败，请手动选择并复制招呼草稿。");
    }
  }

  async function createTask() {
    if (!selectedCv) {
      setError("请先创建或选择一份简历。");
      return;
    }
    const selected = jobs.filter((job) => selectedJobIds.has(job.id));
    if (!selected.length) {
      setError("请先选择要保存到任务中的岗位。");
      return;
    }
    const request = {
      cvId: selectedCv.id,
      cvEtag: selectedCv.etag,
      jobIds: selected.map((job) => job.id),
    };
    const key = JSON.stringify(request);
    const requestId =
      pendingTaskRequest.current?.key === key
        ? pendingTaskRequest.current.id
        : crypto.randomUUID();
    pendingTaskRequest.current = { key, id: requestId };
    setError("");
    setMessage("");
    setCreatingTask(true);
    try {
      const task = await deliveryApi.createTask({ ...request, requestId });
      setTasks((current) => [
        task,
        ...current.filter((existing) => existing.id !== task.id),
      ]);
      pendingTaskRequest.current = null;
      setMessage("离线准备任务已保存，岗位与简历版本已固定。");
    } catch (cause) {
      setError(
        errorMessage(cause, "保存离线准备任务失败。") +
          " 若请求结果不确定，请保持选择不变后重试。",
      );
    } finally {
      setCreatingTask(false);
    }
  }

  async function simulateTask(taskId: string) {
    setTaskActionId(taskId);
    setError("");
    setMessage("");
    try {
      const task = await deliveryApi.simulateTask(taskId);
      setTasks((current) =>
        current.map((existing) => (existing.id === task.id ? task : existing)),
      );
      setMessage("离线模拟状态已记录；没有访问或操作 BOSS 平台。");
    } catch (cause) {
      setError(errorMessage(cause, "记录离线模拟状态失败。"));
    } finally {
      setTaskActionId("");
    }
  }

  async function deleteTask(taskId: string) {
    setTaskActionId(taskId);
    setError("");
    setMessage("");
    try {
      await deliveryApi.deleteTask(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setMessage("离线准备任务已删除。");
    } catch (cause) {
      setError(errorMessage(cause, "删除离线准备任务失败。"));
    } finally {
      setTaskActionId("");
    }
  }

  if (accountLoading || (account && loadedOwnerId !== account.id))
    return (
      <Content>
        <LoadingState>正在读取求职准备资料…</LoadingState>
      </Content>
    );

  if (!account)
    return (
      <Content>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BriefcaseBusiness aria-hidden />
            </EmptyMedia>
            <EmptyTitle>登录后准备求职材料</EmptyTitle>
            <EmptyDescription>
              筛选偏好、手工录入的岗位和招呼草稿会按账户私有保存。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {accountError ? (
              <StatusMessage>{accountError}</StatusMessage>
            ) : null}
            <Button
              onClick={() => (accountError ? void refresh() : openAuth())}
            >
              {accountError ? "重新连接" : "登录账户"}
            </Button>
          </EmptyContent>
        </Empty>
      </Content>
    );

  return (
    <Content>
      <PageHeader
        title="求职准备"
        description="整理岗位、检查硬条件并准备招呼草稿。当前为离线准备和模拟预览。"
      />
      <div className="space-y-6">
        <StatusMessage tone="info" title="BOSS 页面接入未开放">
          目前没有确认的 BOSS 书面授权。CVory 不读取 BOSS 页面、Cookie
          或接口，也不会发送招呼或上传简历。岗位需要手工录入；下面的模拟只展示筛选结果，不代表真实投递。
        </StatusMessage>
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        {message ? (
          <StatusMessage tone="success" title="已完成">
            {message}
          </StatusMessage>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>筛选偏好</CardTitle>
            <CardDescription>
              职位关键词按“任一命中”处理；每行填写一项。未提供的必要条件会标为未知，AI
              不会覆盖硬条件。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void savePreferences(event)}>
              <FieldGroup className="grid gap-x-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="include-keywords">职位关键词</FieldLabel>
                  <Textarea
                    id="include-keywords"
                    rows={3}
                    value={preferences.includeKeywords}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        includeKeywords: event.target.value,
                      }))
                    }
                    placeholder="例如：前端工程师"
                  />
                  <FieldDescription>
                    至少命中一项才算符合关键词条件。
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="exclude-keywords">排除关键词</FieldLabel>
                  <Textarea
                    id="exclude-keywords"
                    rows={3}
                    value={preferences.excludeKeywords}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        excludeKeywords: event.target.value,
                      }))
                    }
                    placeholder="例如：外包"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cities">期望城市</FieldLabel>
                  <Textarea
                    id="cities"
                    rows={3}
                    value={preferences.cities}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        cities: event.target.value,
                      }))
                    }
                    placeholder="例如：上海"
                  />
                </Field>
                <Field>
                  <FieldLabel>期望月薪（千元）</FieldLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      aria-label="期望月薪下限，千元"
                      type="number"
                      min="0"
                      max="1000"
                      step="1"
                      value={preferences.salaryMinK}
                      onChange={(event) =>
                        setPreferences((current) => ({
                          ...current,
                          salaryMinK: event.target.value,
                        }))
                      }
                      placeholder="最低"
                    />
                    <Input
                      aria-label="期望月薪上限，千元"
                      type="number"
                      min="0"
                      max="1000"
                      step="1"
                      value={preferences.salaryMaxK}
                      onChange={(event) =>
                        setPreferences((current) => ({
                          ...current,
                          salaryMaxK: event.target.value,
                        }))
                      }
                      placeholder="最高"
                    />
                  </div>
                  <FieldDescription>
                    例如 20 表示每月 2 万元；薪资范围按是否相交判断。
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="excluded-companies">排除公司</FieldLabel>
                  <Textarea
                    id="excluded-companies"
                    rows={3}
                    value={preferences.excludedCompanies}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        excludedCompanies: event.target.value,
                      }))
                    }
                    placeholder="每行填写一个公司名"
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="greeting-template">
                    招呼草稿模板
                  </FieldLabel>
                  <Textarea
                    id="greeting-template"
                    rows={3}
                    maxLength={500}
                    value={preferences.greetingTemplate}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        greetingTemplate: event.target.value,
                      }))
                    }
                  />
                  <FieldDescription>
                    可用占位符：{"{{company}}"}、{"{{jobTitle}}"}、{"{{city}}"}
                    。复制后请自行核对。
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <CardFooter className="mt-5 justify-end px-0">
                <Button type="submit" disabled={savingPreferences}>
                  {savingPreferences ? "正在保存" : "保存偏好"}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>手工录入岗位</CardTitle>
            <CardDescription>
              可先在 BOSS
              页面自行查看，再复制必要文字到这里。填写来源链接只用于你回看，CVory
              不会打开或抓取。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void createJob(event)}>
              <FieldGroup className="grid gap-x-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="job-title">职位名称</FieldLabel>
                  <Input
                    id="job-title"
                    required
                    maxLength={200}
                    value={jobDraft.title}
                    onChange={(event) =>
                      setJobDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="job-company">公司名称</FieldLabel>
                  <Input
                    id="job-company"
                    required
                    maxLength={200}
                    value={jobDraft.company}
                    onChange={(event) =>
                      setJobDraft((current) => ({
                        ...current,
                        company: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="job-city">城市</FieldLabel>
                  <Input
                    id="job-city"
                    maxLength={120}
                    value={jobDraft.city}
                    onChange={(event) =>
                      setJobDraft((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    placeholder="未提供时会显示为未知"
                  />
                </Field>
                <Field>
                  <FieldLabel>岗位月薪（千元）</FieldLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      aria-label="岗位月薪下限，千元"
                      type="number"
                      min="0"
                      max="1000"
                      step="1"
                      value={jobDraft.salaryMinK}
                      onChange={(event) =>
                        setJobDraft((current) => ({
                          ...current,
                          salaryMinK: event.target.value,
                        }))
                      }
                      placeholder="最低"
                    />
                    <Input
                      aria-label="岗位月薪上限，千元"
                      type="number"
                      min="0"
                      max="1000"
                      step="1"
                      value={jobDraft.salaryMaxK}
                      onChange={(event) =>
                        setJobDraft((current) => ({
                          ...current,
                          salaryMaxK: event.target.value,
                        }))
                      }
                      placeholder="最高"
                    />
                  </div>
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="job-description">岗位描述</FieldLabel>
                  <Textarea
                    id="job-description"
                    rows={5}
                    maxLength={20000}
                    value={jobDraft.description}
                    onChange={(event) =>
                      setJobDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="粘贴你希望用于筛选的岗位内容"
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="job-source-url">
                    来源链接（可选）
                  </FieldLabel>
                  <Input
                    id="job-source-url"
                    type="url"
                    maxLength={2048}
                    value={jobDraft.sourceUrl}
                    onChange={(event) =>
                      setJobDraft((current) => ({
                        ...current,
                        sourceUrl: event.target.value,
                      }))
                    }
                    placeholder="https://www.zhipin.com/..."
                  />
                  <FieldDescription>
                    链接不会被后台请求；只用于你手动打开核对。
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <CardFooter className="mt-5 justify-end px-0">
                <Button type="submit" disabled={creatingJob}>
                  <Plus aria-hidden data-icon="inline-start" />
                  {creatingJob ? "正在添加" : "加入候选岗位"}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>候选岗位</CardTitle>
            <CardDescription>
              硬条件只使用你提供的文字和字段。未知条件保留为待核对，不会由 AI
              或默认值补齐。
            </CardDescription>
          </CardHeader>
          {jobs.length ? (
            <CardContent className="space-y-5">
              {jobs.map((job) => {
                const greeting = greetingFor(preferences.greetingTemplate, job);
                const selectable = job.matchStatus !== "excluded";
                return (
                  <article
                    key={job.id}
                    className="space-y-3 border-b border-border pb-5 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <input
                        aria-label={`选择${job.company}的${job.title}`}
                        type="checkbox"
                        checked={selectedJobIds.has(job.id)}
                        disabled={
                          !selectable ||
                          (!selectedJobIds.has(job.id) &&
                            selectedJobIds.size >= 50)
                        }
                        onChange={() => toggleJob(job.id)}
                        className="mt-1 size-4 accent-foreground"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{job.title}</h3>
                          <Badge variant={matchVariant(job.matchStatus)}>
                            {matchLabels[job.matchStatus]}
                          </Badge>
                        </div>
                        <p className="text-sm text-secondary-foreground">
                          {job.company} · {job.city || "城市未知"} ·{" "}
                          {salaryLabel(job.salaryMinK, job.salaryMaxK)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {job.sourceUrl ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink
                                aria-hidden
                                data-icon="inline-start"
                              />
                              手动打开
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          disabled={deletingJobId === job.id}
                          aria-label={`删除${job.company}的${job.title}`}
                          onClick={() => void deleteJob(job.id)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <div className="ml-7 grid gap-3 md:grid-cols-2">
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {job.conditions.map((condition) => (
                          <li key={condition.key}>
                            <span className="font-medium text-secondary-foreground">
                              {condition.label}：
                              {conditionLabel(condition.status)}
                            </span>
                            <span> · {condition.explanation}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="space-y-2 rounded-md bg-surface-subtle p-3">
                        <p className="text-xs text-muted-foreground">
                          招呼草稿
                        </p>
                        <p className="text-sm leading-6">{greeting}</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void copyGreeting(job)}
                        >
                          <Clipboard aria-hidden data-icon="inline-start" />
                          复制草稿
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          ) : (
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BriefcaseBusiness aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>还没有候选岗位</EmptyTitle>
                  <EmptyDescription>
                    手工录入岗位后，这里会显示每项条件的判断依据。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          )}
          <CardFooter className="flex-wrap justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              已选 {selectedJobIds.size} 个 · 共 {jobs.length} 个
            </span>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>固定简历</CardTitle>
            <CardDescription>
              创建任务时会固定当前简历版本并保存私有快照；不会上传到 BOSS。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cvs.length ? (
              <Field>
                <FieldLabel htmlFor="delivery-cv">选择简历</FieldLabel>
                <Select value={selectedCvId} onValueChange={setSelectedCvId}>
                  <SelectTrigger id="delivery-cv" className="w-full">
                    <SelectValue placeholder="选择一份简历" />
                  </SelectTrigger>
                  <SelectContent>
                    {cvs.map((cv) => (
                      <SelectItem key={cv.id} value={cv.id}>
                        {cv.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCv ? (
                  <FieldDescription>
                    当前版本：{selectedCv.etag} · {selectedCv.updateTime}
                  </FieldDescription>
                ) : null}
              </Field>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>先准备一份简历</EmptyTitle>
                  <EmptyDescription>
                    选定的简历可用于后续人工材料核对。
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="secondary" asChild>
                    <Link href="/workspace">打开简历工作区</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </CardContent>
          {cvs.length ? (
            <CardFooter className="flex-wrap justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                已选 {selectedJobIds.size} 个岗位 · 简历快照仅供本人查看
              </span>
              <Button
                disabled={
                  !selectedCv || selectedJobIds.size === 0 || creatingTask
                }
                onClick={() => void createTask()}
              >
                <FileText aria-hidden data-icon="inline-start" />
                {creatingTask ? "正在保存任务" : "保存离线准备任务"}
              </Button>
            </CardFooter>
          ) : null}
        </Card>{" "}
        <Card>
          <CardHeader>
            <CardTitle>离线准备任务</CardTitle>
            <CardDescription>
              保存时会固定简历版本、岗位条件和招呼草稿。记录“已模拟”只更新 CVory
              内的任务状态，不代表真实联系或投递。
            </CardDescription>
          </CardHeader>
          {tasks.length ? (
            <CardContent className="space-y-5">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="space-y-3 border-b border-border pb-5 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{task.cvName}</h3>
                        <Badge variant="secondary">
                          {task.status === "draft" ? "草稿" : "已模拟"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        简历版本 {task.cvEtag} · 创建于{" "}
                        {new Date(task.createTime).toLocaleString()}
                        {task.simulationTime
                          ? " · 模拟于 " +
                            new Date(task.simulationTime).toLocaleString()
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status === "draft" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={taskActionId === task.id}
                          onClick={() => void simulateTask(task.id)}
                        >
                          <Check aria-hidden data-icon="inline-start" />
                          记录离线模拟
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        disabled={taskActionId === task.id}
                        aria-label={
                          "删除简历 " + task.cvName + " 的离线准备任务"
                        }
                        onClick={() => void deleteTask(task.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {task.items.map((item) => (
                      <div
                        key={item.jobId}
                        className="rounded-md bg-surface-subtle p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {item.company} · {item.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.city || "城市未知"} ·{" "}
                              {salaryLabel(item.salaryMinK, item.salaryMaxK)} ·{" "}
                              {matchLabels[item.matchStatus]}
                            </p>
                            {item.sourceUrl ? (
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink
                                    aria-hidden
                                    data-icon="inline-start"
                                  />
                                  手动打开来源
                                </a>
                              </Button>
                            ) : null}
                          </div>
                          <Badge variant={matchVariant(item.matchStatus)}>
                            {matchLabels[item.matchStatus]}
                          </Badge>
                        </div>
                        {item.description ? (
                          <details className="mt-3 text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                              查看固定岗位描述
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap leading-6">
                              {item.description}
                            </p>
                          </details>
                        ) : null}
                        <p className="mt-3 text-sm leading-6">
                          {item.greeting}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    简历内容已作为私有快照保存在服务器数据库中。需要联系时，请自行导出
                    PDF 并在平台核对、上传和发送。
                  </p>
                </article>
              ))}
            </CardContent>
          ) : (
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BriefcaseBusiness aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>还没有离线准备任务</EmptyTitle>
                  <EmptyDescription>
                    选择简历版本和候选岗位后，可以保存一份供之后核对的快照。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          )}
        </Card>
      </div>
    </Content>
  );
}
