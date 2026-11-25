"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import { SECTION_LABELS } from "@/lib/templates/presets";
import type { ResumeSectionId } from "@/lib/contract/contract";
import type { PdfAnchor } from "@/lib/pdf/pdf-worker";
import type { ResumePdf } from "@/lib/pdf/use-resume-pdf";
import { cn } from "@/lib/utils";
import styles from "./pdf-paper.module.css";

const A4_HEIGHT_PT = (297 * 72) / 25.4;

interface PdfPaperProps {
  readonly pdf: ResumePdf;
  readonly onLocate?: (section: ResumeSectionId, itemId?: string) => void;
  readonly className?: string;
}

export function PdfPaper({ pdf, onLocate, className }: PdfPaperProps) {
  return (
    <div className={cn("grid min-w-0 gap-3", className)}>
      {Array.from({ length: pdf.document.numPages }, (_, index) => {
        const page = index + 1;
        const anchors = onLocate ? pdf.anchors.filter((anchor) => anchor.page === page) : [];
        const previous = onLocate
          ? pdf.anchors.findLast((anchor) => anchor.page < page)
          : undefined;
        const start = previous && { ...previous, page, y: 0 };
        return (
          <PdfPage
            key={page}
            document={pdf.document}
            pageNumber={page}
            anchors={start ? [start, ...anchors] : anchors}
            onLocate={onLocate}
          />
        );
      })}
    </div>
  );
}

function PdfPage({
  document,
  pageNumber,
  anchors,
  onLocate,
}: {
  readonly document: PDFDocumentProxy;
  readonly pageNumber: number;
  readonly anchors: readonly PdfAnchor[];
  readonly onLocate?: PdfPaperProps["onLocate"];
}) {
  const container = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const resize = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    const intersection = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          intersection.disconnect();
        }
      },
      { rootMargin: "240px" }
    );
    resize.observe(root);
    intersection.observe(root);
    return () => {
      resize.disconnect();
      intersection.disconnect();
    };
  }, []);

  useEffect(() => {
    const surface = canvas.current;
    const textContainer = text.current;
    if (!surface || !textContainer || !visible || width < 1) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let textLayer: TextLayer | undefined;
    void (async () => {
      try {
        const [page, { TextLayer }] = await Promise.all([
          document.getPage(pageNumber),
          import("pdfjs-dist"),
        ]);
        if (cancelled) return;
        const scale = width / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        surface.width = Math.round(viewport.width * pixelRatio);
        surface.height = Math.round(viewport.height * pixelRatio);
        renderTask = page.render({
          canvas: surface,
          viewport,
          transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        textContainer.style.setProperty("--total-scale-factor", String(scale));
        textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textContainer,
          viewport,
        });
        await Promise.all([renderTask.promise, textLayer.render()]);
        if (!cancelled) setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      textContainer.replaceChildren();
    };
  }, [document, pageNumber, visible, width]);

  const locate = (key: string) => {
    const [section, itemId] = key.split(":");
    if (Object.hasOwn(SECTION_LABELS, section)) onLocate?.(section as ResumeSectionId, itemId);
  };

  const handlePaperClick = (event: MouseEvent<HTMLElement>) => {
    if (
      window.getSelection()?.isCollapsed === false ||
      !(event.target instanceof HTMLElement) ||
      !event.target.closest("span")
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const y = ((event.clientY - bounds.top) / bounds.height) * A4_HEIGHT_PT;
    const anchor = anchors.findLast((candidate) => candidate.y <= y + 2);
    if (anchor) locate(anchor.key);
  };

  return (
    <article
      ref={container}
      aria-label={`第 ${pageNumber} 页`}
      className={cn(
        "relative aspect-[210/297] w-full overflow-hidden bg-white",
        onLocate && "cursor-pointer"
      )}
      onClick={onLocate ? handlePaperClick : undefined}
    >
      <canvas ref={canvas} className="block size-full" aria-hidden="true" />
      <div ref={text} className={styles.textLayer} />
      {failed && (
        <p className="text-destructive absolute inset-x-3 top-3 text-sm">此页预览加载失败。</p>
      )}
      {anchors.map((anchor) => (
        <button
          key={`${anchor.key}:${anchor.y}`}
          type="button"
          onClick={() => locate(anchor.key)}
          style={{ top: `${(anchor.y / A4_HEIGHT_PT) * 100}%` }}
          className="bg-background text-link focus-visible:outline-ring absolute left-2 z-10 px-2 py-1 text-xs opacity-0 focus-visible:opacity-100 focus-visible:outline-2"
        >
          定位到{SECTION_LABELS[anchor.key.split(":")[0] as ResumeSectionId]}
        </button>
      ))}
    </article>
  );
}
