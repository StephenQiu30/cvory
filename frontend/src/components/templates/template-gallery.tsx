"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Expand, FileText } from "lucide-react";
import { ResumePaper } from "@/components/preview/resume-paper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SupportedTemplateId } from "@/lib/contract/contract";
import {
  FICTIONAL_SAMPLE_RESUME,
  RESUME_TEMPLATE_PRESETS,
  type ResumeTemplatePreset,
} from "@/lib/templates/presets";
import {
  createLocalDraft,
  getLocalDraftsServerSnapshot,
  getLocalDraftsSnapshot,
  subscribeLocalDrafts,
} from "@/lib/yjs/local-store";

export function TemplateGallery() {
  const router = useRouter();
  const recentDrafts = useSyncExternalStore(
    subscribeLocalDrafts,
    () => getLocalDraftsSnapshot(),
    getLocalDraftsServerSnapshot
  );
  const [zoomedTemplate, setZoomedTemplate] = useState<ResumeTemplatePreset | null>(null);

  const handleUseTemplate = (templateId: SupportedTemplateId) => {
    const created = createLocalDraft(templateId);
    router.push(`/resume/${created.id}`);
  };

  const latestDraft = recentDrafts[0];

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight text-neutral-950">简序</span>
          <span className="hidden text-xs text-neutral-500 sm:inline">
            免费极简中文简历 · 在线填写 · 无水印 A4 PDF
          </span>
        </div>

        <div className="flex items-center gap-2">
          {latestDraft ? (
            <Button asChild variant="outline" size="sm" className="h-9 text-[13px]">
              <Link href={`/resume/${latestDraft.id}`}>
                继续编辑
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm" className="h-9 text-[13px]">
            <Link href="/resumes">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              我的简历{recentDrafts.length > 0 ? ` (${recentDrafts.length})` : ""}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6">
        <section className="mb-10 max-w-2xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            选一款极简纸样，直接写你的简历
          </h1>
          <p className="text-sm leading-6 text-neutral-600">
            以下三款均免费使用，用同一份虚构中文履历对照排版密度与留白。选用后将打开空白稿，示例文字不会写入你的正文，填完即可导出免费、无水印、文字可复制的
            A4 PDF。
          </p>
        </section>

        <section
          aria-label="免费极简模板列表"
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {RESUME_TEMPLATE_PRESETS.map((preset) => (
            <div key={preset.id} className="group flex flex-col gap-3">
              <div className="relative overflow-hidden bg-neutral-100/80 p-3 transition-colors group-hover:bg-neutral-100">
                <div className="aspect-[210/297] overflow-hidden bg-white">
                  <div className="pointer-events-none w-[172%] origin-top-left scale-[0.58] select-none">
                    <ResumePaper snapshot={{ ...FICTIONAL_SAMPLE_RESUME, templateId: preset.id }} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setZoomedTemplate(preset)}
                    className="h-10 px-2.5 text-[13px] text-neutral-700 hover:bg-white hover:text-neutral-950"
                  >
                    <Expand className="mr-1.5 h-3.5 w-3.5" />
                    放大查看
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleUseTemplate(preset.id)}
                    className="h-10 bg-neutral-950 px-4 text-[13px] text-white hover:bg-neutral-800"
                  >
                    使用模板
                  </Button>
                </div>
              </div>

              <div className="space-y-0.5 px-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-medium text-neutral-950">{preset.name}</h2>
                  <span className="text-xs text-neutral-500">{preset.scenario}</span>
                </div>
                <p className="text-xs leading-5 text-neutral-500">{preset.tagline}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <Dialog
        open={zoomedTemplate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setZoomedTemplate(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-[#fafafa] p-6">
          {zoomedTemplate ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">
                  {zoomedTemplate.name} · 示例纸样
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-500">
                  {zoomedTemplate.tagline}（示例文字仅供对比排版，选用后进入空稿）
                </DialogDescription>
              </DialogHeader>
              <div className="my-2 overflow-hidden bg-neutral-100 p-4">
                <ResumePaper
                  snapshot={{ ...FICTIONAL_SAMPLE_RESUME, templateId: zoomedTemplate.id }}
                />
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setZoomedTemplate(null)}
                  className="h-10 text-[13px]"
                >
                  返回比较
                </Button>
                <Button
                  type="button"
                  onClick={() => handleUseTemplate(zoomedTemplate.id)}
                  className="h-10 bg-neutral-950 px-5 text-[13px] text-white hover:bg-neutral-800"
                >
                  使用「{zoomedTemplate.name}」开始填写
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
