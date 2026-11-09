"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <StatusPage
      title="暂时无法显示页面"
      description="请检查连接后重试，或返回我的简历。"
    >
      <Button onClick={reset}>重新加载</Button>
      <Button variant="ghost" asChild>
        <Link href="/">返回我的简历</Link>
      </Button>
    </StatusPage>
  );
}
