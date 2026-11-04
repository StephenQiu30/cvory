"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  loginAccount,
  registerAccount,
  requestPasswordReset,
  cancelAccountDeletion,
} from "@/lib/api/generated/api/account";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";

export function AuthDialog({
  onClose,
  onSuccess,
  returnFocusRef,
}: {
  onClose: () => void;
  onSuccess: (account: API.AccountResource) => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "cancel">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={
        mode === "login"
          ? "欢迎回来"
          : mode === "register"
            ? "创建你的账户"
            : mode === "forgot"
              ? "找回密码"
              : "撤销注销"
      }
      description="整理经历，从一份清晰的简历开始。"
      returnFocusRef={returnFocusRef}
      className="w-[calc(100%-3rem)] max-w-[416px]"
      titleClassName="text-xl font-medium"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            if (mode === "forgot") {
              await requestPasswordReset({ email });
              setNotice(
                "如果邮箱符合条件，重置说明将发送到该邮箱。请检查收件箱。",
              );
            } else if (mode === "cancel") {
              await cancelAccountDeletion({ email, password });
              setNotice("注销已撤销，请重新登录。");
              setMode("login");
            } else {
              const account = await (
                mode === "login" ? loginAccount : registerAccount
              )({ email, password, displayName: name });
              onSuccess(account);
            }
          } catch {
            setError(
              mode === "login"
                ? "邮箱或密码不正确，或当前无法连接，请检查后重试。"
                : mode === "register"
                  ? "注册失败，邮箱可能已被使用，请尝试登录。"
                  : "操作未完成，请稍后重试。",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <FieldGroup>
          {mode === "register" ? (
            <FormField id="auth-name" label="显示名称">
              <Input
                id="auth-name"
                className="h-10"
                autoComplete="name"
                placeholder="请输入显示名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
          ) : null}
          <FormField id="auth-email" label="邮箱" required>
            <Input
              id="auth-email"
              className="h-10"
              type="email"
              autoComplete="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>
          {mode !== "forgot" ? (
            <FormField
              id="auth-password"
              label="密码"
              description={
                mode === "register"
                  ? "使用 15–128 位密码。"
                  : "使用账户密码登录。"
              }
            >
              <Input
                id="auth-password"
                className="h-10"
                placeholder="请输入密码"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "register" ? 15 : 10}
                maxLength={128}
                aria-describedby="auth-password-description"
              />
            </FormField>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          {error ? <StatusMessage>{error}</StatusMessage> : null}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? (
              <LoaderCircle
                data-icon="inline-start"
                aria-hidden
                className="size-4 animate-spin"
              />
            ) : null}
            {busy
              ? "正在处理…"
              : mode === "login"
                ? "登录"
                : mode === "register"
                  ? "注册并开始"
                  : mode === "forgot"
                    ? "发送重置说明"
                    : "撤销注销"}
          </Button>
        </FieldGroup>
      </form>
      <Button
        variant="ghost"
        className="mt-4"
        disabled={busy}
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
          setPassword("");
        }}
      >
        {mode === "login" ? "还没有账户？注册" : "返回登录"}
      </Button>
      {mode === "login" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setNotice("");
              setError("");
              setMode("forgot");
            }}
          >
            忘记密码
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setNotice("");
              setError("");
              setMode("cancel");
            }}
          >
            撤销账户注销
          </Button>
        </div>
      ) : null}
    </Dialog>
  );
}
