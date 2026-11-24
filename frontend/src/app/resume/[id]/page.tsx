import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ResumeEditorPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function ResumeEditorPage({ params }: ResumeEditorPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 bg-[#fafafa] px-6 py-8 text-neutral-950">
      <header className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">简历编辑 · {id}</p>
          <p className="text-xs text-neutral-500">桌面三栏无边框编辑器与离线 PDF 预览占位</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/resumes">我的简历</Link>
        </Button>
      </header>
      <section className="rounded-md bg-white p-6 text-sm text-neutral-600">
        五章表单、Tiptap 富文本、Yjs 本机/跨设备同步与 Typst WASM + PDF.js 管线将在 T-CV-02 /
        T-CV-04 / T-CV-05 依次接入。
      </section>
    </main>
  );
}
