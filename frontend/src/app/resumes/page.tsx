import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ResumesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 bg-[#fafafa] px-6 py-12 text-neutral-950">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">我的简历</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">返回模板页</Link>
        </Button>
      </header>
      <p className="text-sm text-neutral-600">
        本机草稿列表与账号岗位多稿管理将在 T-CV-03 / T-CV-08 接入。
      </p>
    </main>
  );
}
