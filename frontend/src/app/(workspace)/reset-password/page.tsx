"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { resetPassword } from "@/lib/api/generated/api/account";
import { useAccount } from "@/components/account/account-provider";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { openAuth, setAccount } = useAccount();
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (value) void Promise.resolve().then(() => setToken(value));
  }, []);
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-medium">重置密码</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        新密码使用 15–128 位。重置后所有设备需要重新登录。
      </p>
      <form
        className="mt-6 grid gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== confirmation) {
            setMessage("两次输入的密码不一致。");
            return;
          }
          setBusy(true);
          try {
            await resetPassword({ token, password });
            setAccount(null);
            setToken("");
            setPassword("");
            setConfirmation("");
            setMessage("密码已重置，请重新登录。");
          } catch {
            setMessage("链接无效或已过期，请重新申请。");
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormField id="new-password" label="新密码">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <FormField id="confirm-password" label="确认新密码">
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </FormField>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
        <Button type="submit" disabled={!token || busy}>
          重置密码
        </Button>
      </form>
      <Button variant="ghost" className="mt-4" onClick={() => openAuth()}>
        返回登录
      </Button>
    </main>
  );
}
