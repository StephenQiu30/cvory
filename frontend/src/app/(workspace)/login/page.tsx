"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, LoaderCircle } from "lucide-react";
import { loginAccount, registerAccount } from "@/lib/api/generated/api/account";
import { useAccount } from "@/components/account/account-provider";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FieldGroup } from "@/components/ui/field";
import { StatusMessage } from "@/components/ui/status-message";
export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { setAccount } = useAccount();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[400px] px-6 py-16">
      <LockKeyhole aria-hidden className="mb-6 size-6" />
      <h1 className="text-[30px] font-medium leading-tight">
        {mode === "login" ? "欢迎回来" : "创建你的账户"}
      </h1>
      <p className="mb-8 mt-2 text-[13px] text-muted-foreground">
        整理经历，从一份清晰的简历开始。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            setAccount(
              await (mode === "login" ? loginAccount : registerAccount)({
                email,
                password,
                displayName: name,
              }),
            );
            const target = new URLSearchParams(location.search).get("returnTo");
            const destination = target
              ? new URL(target, location.origin)
              : null;
            router.push(
              destination?.origin === location.origin
                ? destination.pathname + destination.search
                : "/",
            );
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
            <FormField
              id="display-name"
              label="显示名称"
              value={name}
              onChange={setName}
            />
          ) : null}
          <FormField
            id="email"
            label="邮箱"
            value={email}
            onChange={setEmail}
            type="email"
            required
          />
          <FormField
            id="password"
            label="密码"
            description="使用 10–128 位密码。"
          >
            <input
              id="password"
              className="h-11 rounded-md border-0 bg-control px-4 text-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={10}
              maxLength={128}
            />
          </FormField>
          {error ? <StatusMessage>{error}</StatusMessage> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : null}
            {mode === "login" ? "登录" : "注册并开始"}
          </Button>
        </FieldGroup>
      </form>
      <Button
        variant="ghost"
        className="mt-4 w-full"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "还没有账户？注册" : "已有账户？登录"}
      </Button>
      <p className="mt-8 text-xs leading-5 text-muted-foreground">
        邮箱用于登录，当前不提供邮件验证或密码找回。
      </p>
      <Link href="/" className="mt-4 inline-block text-xs text-link">
        返回简历库
      </Link>
    </div>
  );
}
