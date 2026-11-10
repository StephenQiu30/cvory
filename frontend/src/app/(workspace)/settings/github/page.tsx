"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GitFork,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/content";
import {
  getGithubConnection,
  getGithubFeaturedProjects,
  listGithubRepositories,
  saveGithubFeaturedProjects,
} from "@/lib/api/generated/api/github";
import { getAuthOptions } from "@/lib/api/generated/api/account";
import { ApiError } from "@/lib/api/request";
import { errorMessage } from "@/lib/api/error-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";

function ordered(projects: API.GithubFeaturedProject[]) {
  return projects.map((project, displayOrder) => ({
    ...project,
    displayOrder,
  }));
}

function selection(projects: API.GithubFeaturedProject[]) {
  return projects.map(({ repositoryId, contribution }) => ({
    repositoryId,
    contribution,
  }));
}

export default function GithubSettings() {
  const [connection, setConnection] = useState<API.GithubConnection | null>(
    null,
  );
  const [enabled, setEnabled] = useState(false);
  const [result, setResult] = useState<API.GithubRepositories | null>(null);
  const [featured, setFeatured] = useState<API.GithubFeaturedProject[]>([]);
  const [savedFeatured, setSavedFeatured] = useState<
    API.GithubFeaturedProject[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [error, setError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const dirty =
    JSON.stringify(selection(featured)) !==
    JSON.stringify(selection(savedFeatured));

  useEffect(() => {
    let active = true;
    async function load() {
      let value: API.GithubConnection;
      try {
        const [connectionValue, options] = await Promise.all([
          getGithubConnection(),
          getAuthOptions(),
        ]);
        value = connectionValue;
        if (!active) return;
        setConnection(value);
        setEnabled(options.githubEnabled);
        setError("");
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof ApiError && cause.code === 404
            ? "此服务尚未启用 GitHub 账户功能。"
            : errorMessage(cause, "无法读取 GitHub 连接，请重试。"),
        );
        return;
      }
      if (!value.connected) return;

      setLoadingFeatured(true);
      try {
        const response = await getGithubFeaturedProjects();
        if (active) {
          const projects = ordered(response.projects);
          setFeatured(projects);
          setSavedFeatured(projects);
          setProjectError("");
        }
      } catch (cause) {
        if (active)
          setProjectError(errorMessage(cause, "无法读取精选项目，请重试。"));
      } finally {
        if (active) setLoadingFeatured(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [revision]);

  async function sync(more = false) {
    setBusy(true);
    setError("");
    try {
      const next = await listGithubRepositories({
        pageToken: more ? result?.nextPageToken : undefined,
      });
      setResult((current) => ({
        ...next,
        repositories:
          more && current
            ? [...current.repositories, ...next.repositories]
            : next.repositories,
      }));
    } catch (cause) {
      setError(errorMessage(cause, "读取公开仓库失败，已读取的项目会保留。"));
    } finally {
      setBusy(false);
    }
  }

  function add(project: API.GithubRepository) {
    setProjectError("");
    setMessage("");
    if (featured.some((item) => item.repositoryId === project.id)) return;
    if (featured.length >= 12) {
      setProjectError("精选项目最多选择 12 个。");
      return;
    }
    setFeatured((current) =>
      ordered([
        ...current,
        {
          ...project,
          repositoryId: project.id,
          contribution: "",
          displayOrder: current.length,
        },
      ]),
    );
  }

  function move(index: number, offset: -1 | 1) {
    setFeatured((current) => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return ordered(next);
    });
  }

  async function save() {
    setSaving(true);
    setProjectError("");
    setMessage("");
    try {
      const response = await saveGithubFeaturedProjects({
        projects: selection(featured),
      });
      const projects = ordered(response.projects);
      setFeatured(projects);
      setSavedFeatured(projects);
      setMessage(
        "精选项目已同步并保存；公开页面未变化。要公开更新，请前往公开简历设置预览并发布。",
      );
    } catch (cause) {
      setProjectError(
        errorMessage(
          cause,
          "无法保存精选项目，请确认仓库仍属于本人且保持公开。",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="GitHub 项目"
        description="查看本人公开仓库，编辑精选顺序和个人贡献。保存会刷新仓库信息，但不会自动发布。"
      />
      {error ? (
        <StatusMessage
          action={
            <Button
              variant="secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              重试连接
            </Button>
          }
        >
          {error}
        </StatusMessage>
      ) : null}
      {!connection && !error ? (
        <LoadingState>正在读取 GitHub 连接…</LoadingState>
      ) : null}
      {connection ? (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {connection.connected
                  ? `已连接 @${connection.login}`
                  : "连接你的 GitHub"}
              </CardTitle>
              <CardDescription>
                {connection.connected
                  ? "只读取本人公开仓库。仓库简介、星标和个人贡献会分开展示。"
                  : "保留现有账户和简历，在 GitHub 授权后绑定。"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connection.connected ? (
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() => void sync()}
                >
                  <RefreshCw data-icon="inline-start" aria-hidden />
                  {busy ? "读取中…" : "读取公开仓库"}
                </Button>
              ) : enabled ? (
                <form
                  action="/api/account/github/link?returnTo=%2Fsettings%2Fgithub"
                  method="post"
                >
                  <Button type="submit">
                    <GitFork data-icon="inline-start" aria-hidden />
                    授权并绑定 GitHub
                  </Button>
                </form>
              ) : (
                <StatusMessage tone="info">
                  部署者尚未配置 GitHub 登录。
                </StatusMessage>
              )}
              {error ? (
                <StatusMessage className="mt-4">{error}</StatusMessage>
              ) : null}
            </CardContent>
          </Card>

          {connection.connected ? (
            <Card>
              <CardHeader>
                <CardTitle>个人主页精选项目</CardTitle>
                <CardDescription>
                  最多 12 个。保存或刷新会重查仓库状态、更新 GitHub
                  元数据并保留个人贡献；要公开这些项目，还需在公开简历设置中预览并发布。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {projectError ? (
                  <StatusMessage
                    action={
                      !dirty ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setRevision((value) => value + 1)}
                        >
                          重试读取精选项目
                        </Button>
                      ) : undefined
                    }
                  >
                    {projectError}
                  </StatusMessage>
                ) : null}
                {message ? (
                  <StatusMessage tone="success">{message}</StatusMessage>
                ) : null}
                {loadingFeatured ? (
                  <LoadingState>正在读取精选项目…</LoadingState>
                ) : featured.length ? (
                  <ol className="flex flex-col divide-y divide-border">
                    {featured.map((project, index) => (
                      <li
                        key={project.repositoryId}
                        className="grid min-w-0 gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-sm font-medium underline-offset-4 hover:underline"
                          >
                            {project.fullName}
                          </a>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            {project.description || "暂无仓库简介"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {project.language || "未标注语言"} · {project.stars}{" "}
                            stars
                            {project.fork ? " · Fork 仓库" : ""}
                          </p>
                          <label
                            htmlFor={`contribution-${project.repositoryId}`}
                            className="mt-4 mb-2 block text-sm font-medium"
                          >
                            个人贡献（可选）
                          </label>
                          <Textarea
                            id={`contribution-${project.repositoryId}`}
                            maxLength={2000}
                            disabled={saving}
                            value={project.contribution}
                            aria-describedby={`contribution-count-${project.repositoryId}`}
                            onChange={(event) =>
                              setFeatured((current) =>
                                current.map((item) =>
                                  item.repositoryId === project.repositoryId
                                    ? {
                                        ...item,
                                        contribution: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            placeholder="描述你在这个项目中的工作"
                            className="min-h-24 field-sizing-fixed"
                          />
                          <p
                            id={`contribution-count-${project.repositoryId}`}
                            className="mt-1 text-right text-xs text-muted-foreground"
                          >
                            {project.contribution.length}/2000
                          </p>
                        </div>
                        <div className="flex items-start justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            disabled={saving || index === 0}
                            aria-label={`将 ${project.fullName} 上移`}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            disabled={saving || index === featured.length - 1}
                            aria-label={`将 ${project.fullName} 下移`}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            disabled={saving}
                            aria-label={`移除 ${project.fullName}`}
                            onClick={() =>
                              setFeatured((current) =>
                                ordered(
                                  current.filter(
                                    (item) =>
                                      item.repositoryId !==
                                      project.repositoryId,
                                  ),
                                ),
                              )
                            }
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    尚未选择精选项目。先读取本人公开仓库，再从列表中添加。
                  </p>
                )}
                {result ? (
                  <div className="border-t border-border pt-4">
                    <h3 className="mb-3 text-sm font-medium">本人公开仓库</h3>
                    {result.repositories.length ? (
                      <ul className="flex flex-col divide-y divide-border">
                        {result.repositories.map((repo) => {
                          const selected = featured.some(
                            (item) => item.repositoryId === repo.id,
                          );
                          return (
                            <li
                              key={repo.id}
                              className="flex min-w-0 items-center justify-between gap-3 py-3"
                            >
                              <div className="min-w-0">
                                <a
                                  href={repo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="break-all text-sm font-medium underline-offset-4 hover:underline"
                                >
                                  {repo.fullName}
                                </a>
                                <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                                  {repo.description || "暂无仓库简介"}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant={selected ? "secondary" : "ghost"}
                                className="shrink-0"
                                disabled={
                                  saving || selected || featured.length >= 12
                                }
                                onClick={() => add(repo)}
                                aria-label={
                                  selected
                                    ? `${repo.fullName} 已精选`
                                    : `将 ${repo.fullName} 加入精选项目`
                                }
                              >
                                {selected ? (
                                  "已精选"
                                ) : (
                                  <>
                                    <Plus aria-hidden />
                                    添加
                                  </>
                                )}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        暂无可读取的本人公开仓库。
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
              <CardFooter className="flex-wrap justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {featured.length}/12 个精选项目
                  {dirty ? " · 有未保存更改" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {result?.nextPageToken ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void sync(true)}
                    >
                      加载更多项目
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    disabled={
                      (!dirty && featured.length === 0) ||
                      saving ||
                      loadingFeatured
                    }
                    onClick={() => void save()}
                  >
                    <Save data-icon="inline-start" aria-hidden />
                    {saving
                      ? "保存中…"
                      : dirty
                        ? "保存精选项目"
                        : "刷新项目并保存"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
