"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
export default function Unavailable() {
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-6 py-16">
      <h1 className="text-2xl font-medium">邮箱验证</h1>
      <StatusMessage tone="info">
        此功能暂未开放。请使用 GitHub 或已有的邮箱密码登录。
      </StatusMessage>
      <Button asChild variant="secondary">
        <Link href="/">返回首页</Link>
      </Button>
    </main>
  );
}
