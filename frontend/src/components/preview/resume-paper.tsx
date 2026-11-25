"use client";

import type { CSSProperties } from "react";
import {
  stripHtmlToText,
  type ResumeSectionId,
  type ResumeSnapshot,
} from "@/lib/contract/contract";
import { resolveEffectiveStyle, SECTION_LABELS } from "@/lib/templates/presets";
import { cn } from "@/lib/utils";

interface ResumePaperProps {
  readonly snapshot: ResumeSnapshot;
  readonly interactive?: boolean;
  readonly compactScale?: boolean;
  readonly className?: string;
  readonly onLocateItem?: (section: ResumeSectionId, itemId?: string) => void;
}

function formatDateRange(start: string, end: string, isCurrent: boolean): string {
  const s = start.trim();
  const e = isCurrent ? "至今" : end.trim();
  if (!s && !e) {
    return "";
  }
  if (s && e) {
    return `${s} – ${e}`;
  }
  return s || e;
}

export function ResumePaper({
  snapshot,
  interactive = false,
  compactScale = false,
  className,
  onLocateItem,
}: ResumePaperProps) {
  const style = resolveEffectiveStyle(snapshot.templateId, snapshot.styleOverrides);
  const hidden = new Set(snapshot.hiddenSections);

  const paddingClass =
    style.spacing === "compact"
      ? "px-7 py-6"
      : style.spacing === "relaxed"
        ? "px-11 py-10"
        : "px-9 py-8";

  const sectionGapClass =
    style.spacing === "compact"
      ? "space-y-3"
      : style.spacing === "relaxed"
        ? "space-y-6"
        : "space-y-4";

  const itemGapClass =
    style.spacing === "compact"
      ? "space-y-2"
      : style.spacing === "relaxed"
        ? "space-y-4"
        : "space-y-3";

  const fontStyle: CSSProperties = {
    fontFamily:
      style.fontFamily === "serif"
        ? '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif'
        : '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", -apple-system, sans-serif',
    fontSize: compactScale ? `${Math.max(style.fontSizePt - 2, 7.5)}pt` : `${style.fontSizePt}pt`,
    lineHeight: style.lineHeight,
  };

  const headingFontStyle: CSSProperties = {
    color: style.accentColor,
    fontFamily: '"Noto Sans SC", "PingFang SC", -apple-system, sans-serif',
  };

  const clickableClass = interactive
    ? "cursor-pointer rounded-sm transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-ring"
    : "";

  const isCompactTemplate = snapshot.templateId === "compact-single";
  const isLetterTemplate = snapshot.templateId === "chinese-letter";

  const renderSection = (sectionId: ResumeSectionId) => {
    if (hidden.has(sectionId)) {
      return null;
    }

    if (sectionId === "basics") {
      const b = snapshot.basics;
      const metaParts = [
        b.phone.trim(),
        b.email.trim(),
        b.location.trim(),
        ...b.visibleOptionalFields.map((f) => b[f].trim()).filter(Boolean),
      ].filter(Boolean);

      if (!b.fullName.trim() && !b.targetRole.trim() && metaParts.length === 0) {
        return null;
      }

      return (
        <header
          key="basics"
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={() => onLocateItem?.("basics")}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onLocateItem?.("basics");
            }
          }}
          className={cn(
            "pb-3",
            isCompactTemplate && "border-b border-neutral-200 pb-2.5",
            isLetterTemplate && "pb-4",
            clickableClass
          )}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className={cn(
                "font-semibold tracking-tight",
                compactScale ? "text-base" : "text-[1.65em]"
              )}
              style={headingFontStyle}
            >
              {b.fullName.trim() || "未填写姓名"}
            </h2>
            {b.targetRole.trim() ? (
              <span className="text-[1em] font-medium text-neutral-600">{b.targetRole.trim()}</span>
            ) : null}
          </div>
          {metaParts.length > 0 ? (
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.9em] text-neutral-600">
              {metaParts.map((part, idx) => (
                <span key={`${part}-${idx}`}>{part}</span>
              ))}
            </p>
          ) : null}
        </header>
      );
    }

    if (sectionId === "education") {
      const visibleItems = snapshot.education.filter(
        (item) => item.school.trim() || item.majorOrDegree.trim() || item.notes.trim()
      );
      if (visibleItems.length === 0) {
        return null;
      }
      return (
        <section key="education" className="space-y-2">
          <SectionHeading
            title={SECTION_LABELS.education}
            accentColor={style.accentColor}
            compact={isCompactTemplate}
            letter={isLetterTemplate}
          />
          <div className={itemGapClass}>
            {visibleItems.map((item) => {
              const dateRange = formatDateRange(item.startMonth, item.endMonth, item.isCurrent);
              return (
                <div
                  key={item.id}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => onLocateItem?.("education", item.id)}
                  onKeyDown={(e) => {
                    if (interactive && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onLocateItem?.("education", item.id);
                    }
                  }}
                  className={cn("py-0.5", clickableClass)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-medium text-neutral-900">
                      <span>{item.school.trim()}</span>
                      {item.majorOrDegree.trim() ? (
                        <span className="ml-2 font-normal text-neutral-600">
                          {item.majorOrDegree.trim()}
                        </span>
                      ) : null}
                    </div>
                    {dateRange ? (
                      <span className="text-[0.88em] text-neutral-500 tabular-nums">
                        {dateRange}
                      </span>
                    ) : null}
                  </div>
                  {item.notes.trim() ? (
                    <p className="mt-1 whitespace-pre-wrap text-neutral-700">{item.notes.trim()}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    if (sectionId === "work" || sectionId === "projects") {
      const list = sectionId === "work" ? snapshot.work : snapshot.projects;
      const visibleItems = list.filter(
        (item) =>
          item.organization.trim() || item.role.trim() || stripHtmlToText(item.descriptionHtml)
      );
      if (visibleItems.length === 0) {
        return null;
      }
      return (
        <section key={sectionId} className="space-y-2">
          <SectionHeading
            title={SECTION_LABELS[sectionId]}
            accentColor={style.accentColor}
            compact={isCompactTemplate}
            letter={isLetterTemplate}
          />
          <div className={itemGapClass}>
            {visibleItems.map((item) => {
              const dateRange = formatDateRange(item.startMonth, item.endMonth, item.isCurrent);
              return (
                <div
                  key={item.id}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => onLocateItem?.(sectionId, item.id)}
                  onKeyDown={(e) => {
                    if (interactive && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onLocateItem?.(sectionId, item.id);
                    }
                  }}
                  className={cn("py-0.5", clickableClass)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-medium text-neutral-900">
                      <span>{item.organization.trim()}</span>
                      {item.role.trim() ? (
                        <span className="ml-2 font-normal text-neutral-600">
                          {item.role.trim()}
                        </span>
                      ) : null}
                    </div>
                    {dateRange ? (
                      <span className="text-[0.88em] text-neutral-500 tabular-nums">
                        {dateRange}
                      </span>
                    ) : null}
                  </div>
                  {stripHtmlToText(item.descriptionHtml) ? (
                    <div
                      className="resume-richtext mt-1 text-neutral-700 [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4"
                      dangerouslySetInnerHTML={{ __html: item.descriptionHtml }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    if (sectionId === "skills") {
      if (!stripHtmlToText(snapshot.skillsHtml)) {
        return null;
      }
      return (
        <section
          key="skills"
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={() => onLocateItem?.("skills")}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onLocateItem?.("skills");
            }
          }}
          className={cn("space-y-2 py-0.5", clickableClass)}
        >
          <SectionHeading
            title={SECTION_LABELS.skills}
            accentColor={style.accentColor}
            compact={isCompactTemplate}
            letter={isLetterTemplate}
          />
          <div
            className="resume-richtext text-neutral-700 [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4"
            dangerouslySetInnerHTML={{ __html: snapshot.skillsHtml }}
          />
        </section>
      );
    }

    return null;
  };

  return (
    <article
      style={fontStyle}
      className={cn(
        "w-full bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        paddingClass,
        sectionGapClass,
        className
      )}
    >
      {snapshot.sectionOrder.map((sectionId) => renderSection(sectionId))}
    </article>
  );
}

function SectionHeading({
  title,
  accentColor,
  compact,
  letter,
}: {
  readonly title: string;
  readonly accentColor: string;
  readonly compact: boolean;
  readonly letter: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", compact && "border-b border-neutral-200 pb-1")}>
      <h3
        className={cn(
          "font-semibold tracking-wide",
          compact ? "text-[0.95em]" : letter ? "text-[1.08em]" : "text-[1.02em]"
        )}
        style={{
          color: accentColor,
          fontFamily: '"Noto Sans SC", "PingFang SC", -apple-system, sans-serif',
        }}
      >
        {title}
      </h3>
      {letter ? (
        <span
          className="h-px flex-1 opacity-25"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
