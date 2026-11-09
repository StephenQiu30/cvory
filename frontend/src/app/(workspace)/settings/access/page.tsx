"use client";
import { errorMessage } from "@/lib/api/error-message";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/account/account-provider";
import { PageHeader } from "@/components/layout/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog } from "@/components/shared/app-dialog";
import { FieldGroup } from "@/components/ui/field";
import {
  changeAccountPassword,
  requestEmailVerification,
  requestAccountDeletion,
} from "@/lib/api/generated/api/account";

import {
  StatusMessage,
  StatusBadge,
  type StatusTone,
} from "@/components/ui/status-message";

type Feedback = { message: string; tone: StatusTone } | null;
export default function Access() {
  const { account, setAccount } = useAccount();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState<Feedback>(null);
  const [verification, setVerification] = useState<Feedback>(null);
  const [operation, setOperation] = useState<
    "verify" | "password" | "delete" | null
  >(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader title="账户与访问" description="管理登录邮箱与密码。" />
      <dl className="grid gap-5 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">登录邮箱</dt>
          <dd className="mt-2">{account?.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">邮箱状态</dt>
          <dd className="mt-2">
            <StatusBadge success={account?.emailVerified}>
              {account?.emailVerified ? "已验证" : "尚未验证"}
            </StatusBadge>
          </dd>
        </div>
      </dl>
      {!account?.emailVerified ? (
        <>
          <p className="mt-5 text-sm text-muted-foreground">
            验证邮箱后可发布简历。
          </p>
          <Button
            variant="outline"
            className="mt-4"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setOperation("verify");
              setVerification(null);
              try {
                await requestEmailVerification();
                setVerification({
                  tone: "success",
                  message: "如果邮箱符合条件，验证说明将发送到你的邮箱。",
                });
              } catch (cause) {
                setVerification({
                  tone: "error",
                  message: errorMessage(
                    cause,
                    "暂时无法发送验证邮件，请稍后重试。",
                  ),
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            发送验证邮件
          </Button>
        </>
      ) : null}
      {busy && operation === "verify" ? (
        <StatusMessage loading className="mt-4">
          正在发送验证邮件…
        </StatusMessage>
      ) : verification ? (
        <StatusMessage tone={verification.tone} className="mt-4">
          {verification.message}
        </StatusMessage>
      ) : null}
      <h2 className="mt-10 text-lg font-medium">修改密码</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        修改后其他设备需要重新登录。
      </p>
      <form
        className="mt-5 grid max-w-md gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setNotice(null);
          if (next !== confirmation) {
            setNotice({ tone: "error", message: "两次输入的密码不一致。" });
            return;
          }
          setBusy(true);
          setOperation("password");
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
            setNotice({ tone: "success", message: "密码已修改。" });
          } catch (cause) {
            setNotice({
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
        <FormField id="current-password" label="当前密码">
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </FormField>
        <FormField id="settings-password" label="新密码">
          <Input
            id="settings-password"
            type="password"
            autoComplete="new-password"
            placeholder="至少 8 位"
            minLength={8}
            maxLength={128}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </FormField>
        <FormField id="settings-confirm" label="确认新密码">
          <Input
            id="settings-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="至少 8 位"
            minLength={8}
            maxLength={128}
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={busy}>
          修改密码
        </Button>
      </form>
      {busy && operation === "password" ? (
        <StatusMessage loading className="mt-4">
          正在修改密码…
        </StatusMessage>
      ) : null}
      {notice ? (
        <StatusMessage tone={notice.tone} className="mt-4">
          {notice.message}
        </StatusMessage>
      ) : null}
      <h2 className="mt-10 text-lg font-medium">注销账户</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        注销后立即退出并停止公开展示，7 天内可撤销。请先导出需要保留的简历。
      </p>
      <Button
        variant="outline"
        className="mt-4"
        onClick={() => setDeleting(true)}
      >
        注销账户
      </Button>
      <Dialog
        open={deleting}
        onOpenChange={(open) => {
          if (!busy) {
            setDeleting(open);
            setDeleteError("");
            setDeletePassword("");
          }
        }}
        title="确认注销账户"
        description="7 天后清理账户、简历、照片和公开内容，清理开始后无法撤销。备份按保留策略处理，已下载的副本无法收回。"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setDeleteError("");
            setOperation("delete");
            try {
              await requestAccountDeletion({ password: deletePassword });
              setAccount(null);
              setDeleting(false);
              router.push("/");
            } catch (cause) {
              setDeleteError(
                errorMessage(cause, "无法提交注销，请检查密码或稍后重试。"),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <FieldGroup>
            <FormField id="delete-password" label="当前密码" required>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                required
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </FormField>
            {busy && operation === "delete" ? (
              <StatusMessage loading>正在提交注销…</StatusMessage>
            ) : null}
            {deleteError ? <StatusMessage>{deleteError}</StatusMessage> : null}
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "正在提交…" : "确认注销"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              暂不注销
            </Button>
          </FieldGroup>
        </form>
      </Dialog>
    </>
  );
}
