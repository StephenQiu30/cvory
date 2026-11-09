"use client";

import { errorMessage } from "@/lib/api/error-message";
import { useEffect, useState } from "react";
import { GitFork, LoaderCircle } from "lucide-react";
import { getAuthOptions } from "@/lib/api/generated/api/account";
import {
  loginAccount,
  getAccount,
  registerAccount,
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<API.AuthOptions | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [oauthPending, setOauthPending] = useState(false);
  useEffect(() => {
    let active = true;
    getAuthOptions()
      .then((value) => {
        if (active) {
          setOptions(value);
          setOptionsError(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setOptionsError(true);
      });
    return () => {
      active = false;
    };
  }, [optionsRevision]);
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
            {mode === "login" ? "欢迎回来" : "创建你的账户"}
          </DialogTitle>
          <DialogDescription className={"sr-only"}>
            使用 GitHub 或存量邮箱账户登录。
          </DialogDescription>
        </DialogHeader>
        {mode === "login" && options?.githubEnabled ? (
          <Button asChild size="lg">
            <a
              href="/api/account/github/authorize"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOauthPending(true)}
            >
              <GitFork data-icon="inline-start" aria-hidden />
              使用 GitHub 登录
            </a>
          </Button>
        ) : null}
        {mode === "login" && options && !options.githubEnabled ? (
          <StatusMessage tone="info">
            GitHub 登录尚未配置，请联系此站部署者。已有账户可使用邮箱登录。
          </StatusMessage>
        ) : null}
        {oauthPending ? (
          <StatusMessage
            tone="info"
            action={
              <Button
                disabled={busy}
                variant="secondary"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    onSuccess(await getAccount());
                  } catch {
                    setError(
                      "尚未完成 GitHub 登录，请在新标签页完成授权后重试。",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                已完成授权，继续
              </Button>
            }
          >
            请在新标签页完成 GitHub 授权，然后返回这里。当前输入会保留。
          </StatusMessage>
        ) : null}
        {optionsError ? (
          <StatusMessage
            action={
              <Button
                variant="secondary"
                onClick={() => setOptionsRevision((value) => value + 1)}
              >
                重试
              </Button>
            }
          >
            暂时无法读取登录方式，已有账户仍可尝试邮箱登录。
          </StatusMessage>
        ) : null}
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
            {
              <Field>
                <div className="flex items-center justify-between gap-4">
                  <FieldLabel
                    htmlFor="auth-password"
                    className="text-xs font-normal"
                  >
                    密码
                  </FieldLabel>
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
            }
            {error ? <StatusMessage>{error}</StatusMessage> : null}
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? (
                <LoaderCircle
                  data-icon="inline-start"
                  aria-hidden
                  className="size-4 animate-spin"
                />
              ) : null}
              {busy ? "正在处理…" : mode === "login" ? "登录" : "注册并开始"}
            </Button>
          </FieldGroup>
        </form>
        <div className="flex flex-col items-start gap-2 text-sm">
          {mode !== "login" || options?.legacyRegistrationEnabled ? (
            <Button
              variant="link"
              className="h-auto p-0"
              disabled={busy}
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");

                setError("");
                setPassword("");
              }}
            >
              {mode === "login" ? "还没有账户？注册" : "返回登录"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
