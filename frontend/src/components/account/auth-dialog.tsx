"use client";

import { errorMessage } from "@/lib/api/error-message";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  loginAccount,
  registerAccount,
  requestPasswordReset,
  cancelAccountDeletion,
} from "@/lib/api/generated/api/account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
    >
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-[400px] gap-6 p-6 sm:p-8"
        onCloseAutoFocus={(event) => {
          const trigger = returnFocusRef.current;
          if (trigger?.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl font-medium">
            {mode === "login"
              ? "欢迎回来"
              : mode === "register"
                ? "创建你的账户"
                : mode === "forgot"
                  ? "找回密码"
                  : "撤销注销"}
          </DialogTitle>
          <DialogDescription
            className={
              mode === "login" || mode === "register" ? "sr-only" : undefined
            }
          >
            {mode === "forgot"
              ? "输入邮箱，我们会发送后续说明。"
              : mode === "cancel"
                ? "在等待期内使用账户邮箱和密码撤销注销。"
                : "使用邮箱和密码登录。"}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            setNotice("");
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
            } catch (cause) {
              const fallback =
                mode === "login"
                  ? "邮箱或密码不正确，请检查后重试。"
                  : mode === "register"
                    ? "注册失败，邮箱可能已被使用，请尝试登录。"
                    : "操作未完成，请稍后重试。";
              setError(errorMessage(cause, fallback, fallback));
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
              <Field>
                <div className="flex items-center justify-between gap-4">
                  <FieldLabel
                    htmlFor="auth-password"
                    className="text-xs font-normal"
                  >
                    密码
                  </FieldLabel>
                  {mode === "login" ? (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs text-muted-foreground"
                      disabled={busy}
                      onClick={() => {
                        setNotice("");
                        setError("");
                        setMode("forgot");
                      }}
                    >
                      忘记密码
                    </Button>
                  ) : null}
                </div>
                <Input
                  id="auth-password"
                  className="h-10"
                  placeholder={mode === "register" ? "至少 8 位" : "请输入密码"}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={8}
                  maxLength={128}
                />
              </Field>
            ) : null}
            {notice ? (
              <StatusMessage tone="success">{notice}</StatusMessage>
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
        <div className="flex flex-col items-start gap-2 text-sm">
          <Button
            variant="link"
            className="h-auto p-0"
            disabled={busy}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setNotice("");
              setError("");
              setPassword("");
            }}
          >
            {mode === "login" ? "还没有账户？注册" : "返回登录"}
          </Button>
          {mode === "login" ? (
            <Button
              variant="link"
              className="h-auto p-0 text-xs text-muted-foreground"
              disabled={busy}
              onClick={() => {
                setNotice("");
                setError("");
                setMode("cancel");
              }}
            >
              撤销账户注销
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
