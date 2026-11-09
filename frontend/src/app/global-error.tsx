"use client";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground">
        <StatusPage
          title="暂时无法显示页面"
          description="请重新加载页面后重试。"
        >
          <Button onClick={reset}>重新加载</Button>
        </StatusPage>
      </body>
    </html>
  );
}
