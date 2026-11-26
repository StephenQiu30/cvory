"use client";

import { useSyncExternalStore } from "react";
import { ResumePaper } from "@/components/preview/resume-paper";
import type { ResumeContent, SupportedTemplateId } from "@/lib/contract/contract";

interface PrintPayload {
  readonly title: string;
  readonly template_id: SupportedTemplateId;
  readonly content: ResumeContent;
}

declare global {
  interface Window {
    __CVORY_PRINT_PAYLOAD__?: PrintPayload;
  }
}

const subscribeNoop = () => () => {};
const getPayloadSnapshot = (): PrintPayload | null =>
  typeof window !== "undefined" ? (window.__CVORY_PRINT_PAYLOAD__ ?? null) : null;
const getServerSnapshot = (): PrintPayload | null => null;

/**
 * Pure A4 print route opened by FastAPI Playwright to guarantee 100% pixel-identical PDF export.
 */
export default function PrintRenderPage() {
  const payload = useSyncExternalStore(subscribeNoop, getPayloadSnapshot, getServerSnapshot);

  if (!payload) {
    return <main className="p-8 text-sm text-neutral-400">Waiting for print payload...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-[210mm] bg-white">
      <style>{`@page { size: A4; margin: 0; } body { margin: 0; background: #ffffff; }`}</style>
      <ResumePaper templateId={payload.template_id} content={payload.content} printMode />
    </main>
  );
}
