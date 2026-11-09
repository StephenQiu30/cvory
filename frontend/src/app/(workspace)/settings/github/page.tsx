"use client";
import { useEffect, useState } from "react";
import { GitFork, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/content";
import {
  getGithubConnection,
  listGithubRepositories,
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

export default function GithubSettings() {
  const [connection, setConnection] = useState<API.GithubConnection | null>(
    null,
  );
  const [enabled, setEnabled] = useState(false);
  const [result, setResult] = useState<API.GithubRepositories | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([getGithubConnection(), getAuthOptions()])
      .then(([value, options]) => {
        if (active) {
          setConnection(value);
          setEnabled(options.githubEnabled);
          setError("");
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof ApiError && cause.code === 404
              ? "此服务尚未启用 GitHub 账户功能。"
              : errorMessage(cause, "无法读取 GitHub 连接，请重试。"),
          );
      });
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
  return (
    <>
      <PageHeader
        title="GitHub 项目"
        description="连接 GitHub，查看本人公开仓库。仓库内容由你决定是否用于简历。"
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
        <Card>
          <CardHeader>
            <CardTitle>
              {connection.connected
                ? `已连接 @${connection.login}`
                : "连接你的 GitHub"}
            </CardTitle>
            <CardDescription>
              {connection.connected
                ? "仅查看本人公开项目，不读取私有仓库。读取结果不会自动发布。"
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
            {result ? (
              <div className="mt-6 flex flex-col gap-4" aria-live="polite">
                <p className="text-xs text-muted-foreground">
                  读取时间：{new Date(result.syncTime).toLocaleString()}
                </p>
                {result.repositories.length ? (
                  result.repositories.map((repo) => (
                    <article key={repo.id} className="flex flex-col gap-1">
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {repo.fullName}
                      </a>
                      <p className="text-sm text-muted-foreground">
                        {repo.description || "暂无项目说明"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {repo.language || "未标注语言"} · {repo.stars} stars
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    暂无可读取的本人公开仓库。
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            {result?.nextPageToken ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void sync(true)}
              >
                加载更多项目
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                GitHub 连接只用于身份与公开项目读取。
              </p>
            )}
          </CardFooter>
        </Card>
      ) : null}
    </>
  );
}
