"use client";
import { useEffect, useRef, useState } from "react";
import type { ResumeData } from "@/lib/api/types";
import { ResumeDocument } from "@/components/resume/resume-document";
export function PaperPreview({
  cv,
  className = "",
  onSection,
  fullSize = false,
  firstPageOnly = false,
  onPageCount,
}: {
  cv: ResumeData;
  className?: string;
  onSection?: (id: string) => void;
  fullSize?: boolean;
  firstPageOnly?: boolean;
  onPageCount?: (pages: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, pages: 1 });
  useEffect(() => {
    const measure = () => {
      if (!host.current || !source.current) return;
      const flow =
        source.current.querySelector<HTMLElement>("[data-resume-flow]");
      const pages = flow
        ? Math.max(
            1,
            Math.round(
              (flow.scrollWidth +
                (2 * (cv.styleSettings.margin ?? 40) * 4) / 3) /
                794,
            ),
          )
        : 1;
      setSize((current) =>
        current.width === host.current!.clientWidth && current.pages === pages
          ? current
          : { width: host.current!.clientWidth, pages },
      );
      onPageCount?.(pages);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host.current!);
    observer.observe(source.current!);
    const id = requestAnimationFrame(measure);
    void document.fonts.ready.then(measure);
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [cv, onPageCount]);
  const scale = fullSize ? 1 : Math.min(1, (size.width || 794) / 794);
  const pages = firstPageOnly ? 1 : size.pages;
  return (
    <div ref={host} className={`w-full min-w-0 ${className}`}>
      <div
        className="mx-auto"
        style={{
          width: 794 * scale,
          height: (1123 * pages + 24 * (pages - 1)) * scale,
        }}
      >
        <div
          style={{
            width: 794,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {Array.from({ length: pages }, (_, index) => (
            <div
              key={index}
              className="relative mb-6 h-[1123px] w-[794px] overflow-hidden border border-[#ebebeb] bg-white shadow-[0_2px_12px_#00000008]"
              aria-hidden={index > 0 ? true : undefined}
            >
              <div
                ref={index === 0 ? source : undefined}
                style={{
                  width: 794,
                  transform: `translateX(-${index * 794}px)`,
                }}
              >
                <ResumeDocument document={cv} onSection={onSection} paginated />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
