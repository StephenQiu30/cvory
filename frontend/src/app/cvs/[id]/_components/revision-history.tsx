"use client";
import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import {
  listCvRevisions,
  restoreCvRevision,
} from "@/lib/api/generated/api/cvs";
import { ApiError } from "@/lib/api/request";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/shared/app-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusMessage } from "@/components/ui/status-message";

function HistoryList({ id }: { id: string }) {
  const [history, setHistory] = useState<API.CvHistory | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requests = useRef(new Map<string, string>());
  useEffect(() => {
    let active = true;
    listCvRevisions({ id })
      .then((value) => {
        if (active) {
          setHistory(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof ApiError && cause.code === 404
              ? "此服务尚未启用简历修订历史。"
              : "读取历史失败，请重试。",
          );
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  async function restore(item: API.CvRevision) {
    setBusy(true);
    setError("");
    setCopy(null);
    const requestId = requests.current.get(item.id) || crypto.randomUUID();
    requests.current.set(item.id, requestId);
    try {
      const value = await restoreCvRevision(
        { id, revision: item.id },
        { requestId },
      );
      setCopy(value.id);
    } catch {
      setError("恢复未完成，请重试。当前简历与输入会保留。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
      {error ? (
        <StatusMessage
          action={
            <Button
              variant="secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              重试
            </Button>
          }
        >
          {error}
        </StatusMessage>
      ) : null}
      {!history && !error ? (
        <LoadingState>正在读取修订历史…</LoadingState>
      ) : null}
      {copy ? (
        <StatusMessage
          tone="success"
          action={
            <Button asChild variant="secondary">
              <a
                href={`/cvs/${encodeURIComponent(copy)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开恢复的副本
              </a>
            </Button>
          }
        >
          已恢复为独立副本，当前编辑内容保持。
        </StatusMessage>
      ) : null}
      {history ? (
        <>
          <p className="text-sm text-muted-foreground">
            每份简历最多保留最近 {history.retentionLimit}{" "}
            个已保存版本。恢复会创建独立副本。
          </p>
          {history.revisions.length ? (
            history.revisions.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.document.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createTime).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void restore(item)}
                >
                  恢复为副本
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              保存简历后将记录修订历史。
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
export function RevisionHistory({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={trigger}
        variant="ghost"
        aria-label="修订历史"
        onClick={() => setOpen(true)}
      >
        <History data-icon="inline-start" aria-hidden />
        <span className="hidden sm:inline">历史</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="修订历史"
        description="查看已保存版本，恢复为独立简历。"
        returnFocusRef={trigger}
      >
        {open ? <HistoryList id={id} /> : null}
      </Dialog>
    </>
  );
}
