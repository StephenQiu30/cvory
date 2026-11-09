"use client";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/account/account-provider";
import { StatusMessage, type StatusTone } from "@/components/ui/status-message";
import { errorMessage } from "@/lib/api/error-message";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api/generated/api/account";

export default function VerifyEmail() {
  const { account, loading, openAuth, setAccount } = useAccount();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<StatusTone>("info");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    window.history.replaceState(null, "", window.location.pathname);
    if (value) void Promise.resolve().then(() => setToken(value));
  }, []);
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-medium">验证邮箱</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        请登录接收邮件的账户，再确认验证。链接只能使用一次。
      </p>
      {loading ? (
        <StatusMessage loading className="mt-4">
          正在读取账户…
        </StatusMessage>
      ) : null}
      {busy ? (
        <StatusMessage loading className="mt-4">
          正在验证邮箱…
        </StatusMessage>
      ) : null}
      {message ? (
        <StatusMessage tone={tone} className="mt-4">
          {message}
        </StatusMessage>
      ) : null}
      {!loading && !account ? (
        <Button className="mt-6" onClick={() => openAuth()}>
          登录
        </Button>
      ) : null}
      {account ? (
        <>
          <p className="mt-4 text-sm">当前账户：{account.email}</p>
          <Button
            className="mt-6"
            disabled={!token || busy || account.emailVerified}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                setAccount(await verifyEmail({ token }));
                setTone("success");
                setMessage("邮箱验证成功。");
                setToken("");
              } catch (cause) {
                setTone("error");
                setMessage(
                  errorMessage(
                    cause,
                    "链接无效、已过期，或与当前账户不匹配。请重新申请。",
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            确认验证
          </Button>
        </>
      ) : null}
    </main>
  );
}
