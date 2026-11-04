"use client";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/account/account-provider";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api/generated/api/account";

export default function VerifyEmail() {
  const { account, loading, openAuth, setAccount } = useAccount();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (value) void Promise.resolve().then(() => setToken(value));
  }, []);
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-medium">验证邮箱</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        请登录接收邮件的账户，再确认验证。链接只能使用一次。
      </p>
      {message ? (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
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
              try {
                setAccount(await verifyEmail({ token }));
                setMessage("邮箱验证成功。");
                setToken("");
              } catch {
                setMessage(
                  "链接无效、已过期，或与当前账户不匹配。请重新申请。",
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
