"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BasicLayout, PageHeader } from "@/components/layout/basic-layout";
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
  const zoomTrigger = useRef<HTMLButtonElement>(null);

  return (
    <BasicLayout currentPage="/">
      <PageHeader
        title="简历模板"
        description="选一款免费模板，在线填写并预览你的简历。"
        action={
          latestDraft ? (
            <Button asChild variant="secondary" className="h-11 px-4">
              <Link href={`/resume/${latestDraft.id}`}>继续编辑</Link>
            </Button>
          ) : undefined
        }
      />
      <section
        aria-label="免费极简模板列表"
        className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:max-w-[1106px] lg:grid-cols-3 lg:gap-[22px]"
      >
        {RESUME_TEMPLATE_PRESETS.map((preset) => (
          <article
            key={preset.id}
            className="bg-background flex min-w-0 flex-col overflow-hidden rounded-md"
          >
            <div className="bg-muted px-5 py-4">
              <div
                className="mx-auto aspect-[210/297] max-w-[278px] overflow-hidden bg-white"
                aria-hidden="true"
              >
                <div className="pointer-events-none w-[172%] origin-top-left scale-[0.58] select-none">
                  <ResumePaper
                    snapshot={{ ...FICTIONAL_SAMPLE_RESUME, templateId: preset.id }}
                    className="shadow-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2 px-4 pt-3 pb-4">
              <h2 className="text-[17px] font-semibold">{preset.name}</h2>
              <p className="text-muted-foreground text-[13px] leading-5">{preset.tagline}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                <Button
                  type="button"
                  onClick={() => handleUseTemplate(preset.id)}
                  className="h-11 min-w-[126px] px-4"
                >
                  使用{preset.name}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  onClick={(event) => {
                    zoomTrigger.current = event.currentTarget;
                    setZoomedTemplate(preset);
                  }}
                  className="h-11 px-2"
                >
                  放大 · {preset.name}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <Dialog
        open={zoomedTemplate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setZoomedTemplate(null);
          }
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            if (zoomTrigger.current?.isConnected) {
              event.preventDefault();
              zoomTrigger.current.focus();
            }
          }}
        >
          {zoomedTemplate ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">
                  {zoomedTemplate.name} · 示例纸样
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  {zoomedTemplate.tagline}（示例文字仅供对比排版，选用后进入空稿）
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted my-2 overflow-hidden p-4">
                <div className="[container-type:inline-size] mx-auto max-w-[556px]">
                  <ResumePaper
                    snapshot={{ ...FICTIONAL_SAMPLE_RESUME, templateId: zoomedTemplate.id }}
                    className="min-h-[141.4286cqw]"
                  />
                </div>
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
                  className="h-10 px-5 text-[13px]"
                >
                  使用「{zoomedTemplate.name}」开始填写
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </BasicLayout>
  );
}
