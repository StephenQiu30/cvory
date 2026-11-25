"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { ResumeSnapshot } from "@/lib/contract/contract";
import type { PdfAnchor, PdfFailure, PdfWorkerReply } from "./pdf-worker";

export interface ResumePdf {
  readonly data: ArrayBuffer;
  readonly document: PDFDocumentProxy;
  readonly anchors: readonly PdfAnchor[];
}

const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url);

export function useResumePdf(snapshot: ResumeSnapshot | null) {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const [retryCount, setRetryCount] = useState(0);
  const [settled, setSettled] = useState<{
    snapshot: ResumeSnapshot;
    retryCount: number;
    result: ResumePdf | PdfFailure;
  } | null>(null);
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  useEffect(() => {
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    const id = ++sequence.current;
    const complete = (result: ResumePdf | PdfFailure) => {
      if (!cancelled) setSettled({ snapshot, retryCount, result });
    };
    const onMessage = async ({ data: result }: MessageEvent<PdfWorkerReply>) => {
      if (result.id !== id || cancelled) return;
      if ("error" in result) {
        complete(result.error);
        return;
      }
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.href;
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(result.data.slice(0)) });
        const document = await loadingTask.promise;
        complete({ data: result.data, document, anchors: result.anchors });
      } catch {
        complete("render");
      }
    };
    const onWorkerError = () => {
      worker.current?.terminate();
      worker.current = null;
      complete("render");
    };
    let instance: Worker;
    try {
      instance =
        worker.current ??
        new Worker(new URL("./pdf-worker.ts", import.meta.url), { type: "module" });
      worker.current = instance;
    } catch {
      queueMicrotask(() => complete("render"));
      return () => {
        cancelled = true;
      };
    }
    instance.addEventListener("message", onMessage);
    instance.addEventListener("error", onWorkerError);
    const timer = window.setTimeout(() => instance.postMessage({ id, snapshot }), 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      instance.removeEventListener("message", onMessage);
      instance.removeEventListener("error", onWorkerError);
      void loadingTask?.destroy().catch(() => undefined);
    };
  }, [snapshot, retryCount]);

  const result =
    settled?.snapshot === snapshot && settled.retryCount === retryCount ? settled : null;
  return {
    pdf: result && typeof result.result !== "string" ? result.result : null,
    pending: Boolean(snapshot && !result),
    failure: result && typeof result.result === "string" ? result.result : null,
    retry,
  };
}

export function resumePdfFilename(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  const printable = [...cleaned]
    .filter((char) => char >= " ")
    .slice(0, 80)
    .join("");
  return `${printable || "未命名简历"}.pdf`;
}

export function downloadResumePdf(pdf: ResumePdf, filename: string): void {
  const url = URL.createObjectURL(new Blob([pdf.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
