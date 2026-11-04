"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { loginAccount, registerAccount } from "@/lib/api/generated/api/account";
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={mode === "login" ? "欢迎回来" : "创建你的账户"}
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
            const account = await (
              mode === "login" ? loginAccount : registerAccount
            )({ email, password, displayName: name });
            onSuccess(account);
          } catch {
            setError(
              mode === "login"
                ? "邮箱或密码不正确，或当前无法连接，请检查后重试。"
                : "注册失败，邮箱可能已被使用，请尝试登录。",
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
          <FormField
            id="auth-password"
            label="密码"
            description="使用 10–128 位密码。"
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
              minLength={10}
              maxLength={128}
              aria-describedby="auth-password-description"
            />
          </FormField>
          {error ? <StatusMessage>{error}</StatusMessage> : null}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? (
              <LoaderCircle
                data-icon="inline-start"
                aria-hidden
                className="size-4 animate-spin"
              />
            ) : null}
            {busy ? "正在验证…" : mode === "login" ? "登录" : "注册并开始"}
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
        {mode === "login" ? "还没有账户？注册" : "已有账户？登录"}
      </Button>
    </Dialog>
  );
}
