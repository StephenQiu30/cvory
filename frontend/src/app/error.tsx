"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-xl font-medium">暂时无法显示页面</h1>
      <p className="my-4 text-sm text-muted-foreground">请检查连接后重试。</p>
      <Button onClick={reset}>重新加载</Button>
    </main>
  );
}
