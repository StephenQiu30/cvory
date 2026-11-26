"use client";

import type { CSSProperties } from "react";
import {
  isRichTextOnlySection,
  stripHtmlToText,
  type ResumeContent,
  type SupportedTemplateId,
} from "@/lib/contract/contract";
import { resolveEffectiveStyle } from "@/lib/templates/presets";
import { cn } from "@/lib/utils";

interface ResumePaperProps {
  readonly templateId: SupportedTemplateId;
  readonly content: ResumeContent;
  readonly interactive?: boolean;
  readonly printMode?: boolean;
  readonly onLocateSection?: (sectionId: string, itemId?: string) => void;
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
  templateId,
  content,
  interactive = false,
  printMode = false,
  onLocateSection,
}: ResumePaperProps) {
  const style = resolveEffectiveStyle(templateId, content.style_overrides);
  const b = content.basics;

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
      style.font_family === "serif"
        ? '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif'
        : '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", -apple-system, sans-serif',
    fontSize: `${style.font_size_pt}pt`,
    lineHeight: style.line_height,
  };

  const headingFontStyle: CSSProperties = {
    color: style.accent_color,
    fontFamily: '"Noto Sans SC", "PingFang SC", -apple-system, sans-serif',
  };

  const clickableClass = interactive
    ? "cursor-pointer rounded-sm transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-blue-600"
    : "";

  const isCompactTemplate = templateId === "compact-single";
  const isLetterTemplate = templateId === "chinese-letter";

  const primaryMeta = [
    b.phone.trim(),
    b.email.trim(),
    b.gender.trim(),
    b.age.trim() ? `${b.age.trim()}岁` : "",
    b.degree.trim(),
    b.work_years.trim(),
  ].filter(Boolean);

  const secondaryMeta = [
    b.github.trim(),
    b.wechat.trim() ? `微信：${b.wechat.trim()}` : "",
    b.website.trim(),
    b.location.trim(),
    ...b.custom_fields
      .filter((f) => f.visible && f.value.trim())
      .map((f) => `${f.label}：${f.value.trim()}`),
  ].filter(Boolean);

  const intentionMeta = [
    b.job_status.trim(),
    b.target_role.trim(),
    b.expected_city.trim(),
    b.expected_salary.trim(),
  ].filter(Boolean);

  const hasBasics =
    Boolean(b.full_name.trim()) ||
    primaryMeta.length > 0 ||
    secondaryMeta.length > 0 ||
    intentionMeta.length > 0 ||
    Boolean(b.avatar_url.trim());

  const showAvatar = Boolean(b.avatar_url.trim()) && b.avatar_alignment !== "hidden";

  return (
    <article
      style={fontStyle}
      className={cn(
        "w-full bg-white text-neutral-900",
        !printMode && "shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        paddingClass,
        sectionGapClass
      )}
    >
      {hasBasics ? (
        <header
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={() => onLocateSection?.("basics")}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onLocateSection?.("basics");
            }
          }}
          className={cn(
            "flex items-start justify-between gap-4 pb-3",
            b.avatar_alignment === "left" && "flex-row-reverse",
            isCompactTemplate && "border-b border-neutral-200 pb-2.5",
            isLetterTemplate && "pb-4",
            clickableClass
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-[1.65em] font-semibold tracking-tight" style={headingFontStyle}>
              {b.full_name.trim() || "未填写姓名"}
            </h2>
            {primaryMeta.length > 0 ? (
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.9em] text-neutral-700">
                {primaryMeta.map((part, idx) => (
                  <span key={`p-${idx}`}>{part}</span>
                ))}
              </p>
            ) : null}
            {secondaryMeta.length > 0 ? (
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.88em] text-neutral-600">
                {secondaryMeta.map((part, idx) => (
                  <span key={`s-${idx}`}>{part}</span>
                ))}
              </p>
            ) : null}
            {intentionMeta.length > 0 ? (
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.88em] text-neutral-600">
                {intentionMeta.map((part, idx) => (
                  <span key={`i-${idx}`}>{part}</span>
                ))}
              </p>
            ) : null}
          </div>

          {showAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.avatar_url}
              alt="个人头像"
              className="h-24 w-20 shrink-0 rounded object-cover"
            />
          ) : null}
        </header>
      ) : null}

      {content.sections.map((section) => {
        if (!section.visible) {
          return null;
        }

        if (isRichTextOnlySection(section.type)) {
          if (!stripHtmlToText(section.rich_text_html)) {
            return null;
          }
          return (
            <section
              key={section.id}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={() => onLocateSection?.(section.id)}
              onKeyDown={(e) => {
                if (interactive && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onLocateSection?.(section.id);
                }
              }}
              className={cn("break-inside-avoid space-y-2 py-0.5", clickableClass)}
            >
              <SectionHeading
                title={section.title}
                accentColor={style.accent_color}
                compact={isCompactTemplate}
                letter={isLetterTemplate}
              />
              <div
                className="resume-richtext text-neutral-700 [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4"
                dangerouslySetInnerHTML={{ __html: section.rich_text_html }}
              />
            </section>
          );
        }

        const visibleItems = section.items.filter(
          (item) => item.title.trim() || item.subtitle.trim() || stripHtmlToText(item.content_html)
        );
        if (visibleItems.length === 0) {
          return null;
        }

        return (
          <section key={section.id} className="space-y-2">
            <SectionHeading
              title={section.title}
              accentColor={style.accent_color}
              compact={isCompactTemplate}
              letter={isLetterTemplate}
            />
            <div className={itemGapClass}>
              {visibleItems.map((item) => {
                const dateRange = formatDateRange(
                  item.start_month,
                  item.end_month,
                  item.is_current
                );
                return (
                  <div
                    key={item.id}
                    role={interactive ? "button" : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onClick={() => onLocateSection?.(section.id, item.id)}
                    onKeyDown={(e) => {
                      if (interactive && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onLocateSection?.(section.id, item.id);
                      }
                    }}
                    className={cn("py-0.5", clickableClass)}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-medium text-neutral-900">
                        <span>{item.title.trim()}</span>
                        {item.subtitle.trim() ? (
                          <span className="ml-2 font-normal text-neutral-600">
                            {item.subtitle.trim()}
                          </span>
                        ) : null}
                        {item.location.trim() ? (
                          <span className="ml-2 text-[0.88em] font-normal text-neutral-500">
                            {item.location.trim()}
                          </span>
                        ) : null}
                      </div>
                      {dateRange ? (
                        <span className="text-[0.88em] text-neutral-500 tabular-nums">
                          {dateRange}
                        </span>
                      ) : null}
                    </div>
                    {item.link.trim() ? (
                      <p className="text-[0.86em] text-neutral-500 underline">{item.link.trim()}</p>
                    ) : null}
                    {stripHtmlToText(item.content_html) ? (
                      <div
                        className="resume-richtext mt-1 text-neutral-700 [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4"
                        dangerouslySetInnerHTML={{ __html: item.content_html }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
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
    <div
      className={cn(
        "flex break-after-avoid items-center gap-2",
        compact && "border-b border-neutral-200 pb-1"
      )}
    >
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
