"use client";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/components/account/account-provider";
import { PageHeader } from "@/components/layout/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FieldGroup } from "@/components/ui/field";
import {
  StatusBadge,
  StatusMessage,
  type StatusTone,
} from "@/components/ui/status-message";
import { changeAccountPassword } from "@/lib/api/generated/api/account";
import { errorMessage } from "@/lib/api/error-message";
export default function Access() {
  const { account, setAccount } = useAccount();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);
  return (
    <>
      <PageHeader
        title="账户与访问"
        description="管理 GitHub 连接与存量账户密码。"
      />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge success={account?.githubConnected}>
            {account?.githubConnected ? "已连接 GitHub" : "尚未连接 GitHub"}
          </StatusBadge>
          <Button asChild variant="secondary">
            <Link href="/settings/github">管理 GitHub 连接</Link>
          </Button>
        </div>
        {account?.email ? (
          <p className="text-sm text-muted-foreground">
            存量登录邮箱：{account.email}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            使用 GitHub 登录，无需邮箱或本地密码。
          </p>
        )}
        <StatusMessage tone="info">
          邮箱恢复与账户注销暂未开放。请保管 GitHub 账户及自部署数据备份。
        </StatusMessage>
        {account?.email ? (
          <>
            <h2 className="mt-5 text-lg font-medium">修改密码</h2>
            <p className="text-sm text-muted-foreground">
              修改后其他设备需要重新登录。
            </p>
            <form
              className="max-w-md"
              onSubmit={async (event) => {
                event.preventDefault();
                setFeedback(null);
                if (next !== confirmation) {
                  setFeedback({
                    tone: "error",
                    message: "两次输入的密码不一致。",
                  });
                  return;
                }
                setBusy(true);
                try {
                  setAccount(
                    await changeAccountPassword({
                      password: current,
                      newPassword: next,
                    }),
                  );
                  setCurrent("");
                  setNext("");
                  setConfirmation("");
                  setFeedback({ tone: "success", message: "密码已修改。" });
                } catch (cause) {
                  setFeedback({
                    tone: "error",
                    message: errorMessage(
                      cause,
                      "密码修改失败，请检查当前密码后重试。",
                      "密码修改失败，请检查当前密码后重试。",
                    ),
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FieldGroup>
                <FormField id="current-password" label="当前密码">
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={current}
                    onChange={(event) => setCurrent(event.target.value)}
                    maxLength={128}
                  />
                </FormField>
                <FormField id="new-password" label="新密码">
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={next}
                    onChange={(event) => setNext(event.target.value)}
                  />
                </FormField>
                <FormField id="confirm-password" label="确认新密码">
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </FormField>
                {feedback ? (
                  <StatusMessage tone={feedback.tone}>
                    {feedback.message}
                  </StatusMessage>
                ) : null}
                <div className="flex justify-end">
                  <Button type="submit" disabled={busy}>
                    {busy ? "正在修改…" : "更新密码"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </>
        ) : null}
      </div>
    </>
  );
}
