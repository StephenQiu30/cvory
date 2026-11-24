import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TemplatesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-between bg-[#fafafa] px-6 py-12 text-neutral-950">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium tracking-tight text-neutral-950">简序 · CVory</p>
          <p className="text-xs text-neutral-500">免费极简模板 · 在线填写 · 无水印 A4 PDF</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/resumes">我的简历</Link>
        </Button>
      </header>

      <section className="my-16 space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
          挑选一款极简中文纸样，直接开始填写
        </h1>
        <p className="max-w-xl text-sm leading-6 text-neutral-600">
          首版工程骨架已就绪。模板对比卡片、放大预览与空稿创建将在 T-CV-03 接入。
        </p>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/resume/draft-preview">进入编辑器骨架</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/resumes">查看我的简历</Link>
          </Button>
        </div>
      </section>

      <footer className="text-xs text-neutral-400">
        简序 CVory · 单一现行契约 · 纯浏览器离线 PDF 管线
      </footer>
    </main>
  );
}
