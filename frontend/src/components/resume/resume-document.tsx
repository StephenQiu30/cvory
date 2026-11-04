import NextImage from "next/image";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  GitFork,
  MessageCircle,
  BriefcaseBusiness,
} from "lucide-react";
import type { ResumeData } from "@/lib/api/types";
import {
  ACCENTS,
  MODULES,
  dateLabel,
  safeLink,
  textContent,
  visibleSections,
} from "@/lib/resume/model";
import { RichTextRenderer } from "@/components/ui/rich-text-renderer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CSSProperties } from "react";

export function ResumeDocument({
  document,
  web = false,
  onSection,
  className,
  paginated = false,
}: {
  document: ResumeData;
  web?: boolean;
  onSection?: (id: string) => void;
  className?: string;
  paginated?: boolean;
}) {
  const { profile: p, styleSettings: s, sections } = document;
  const compact = s.templateId === "compact";
  const contacts = [
    ["email", p.email, Mail, `mailto:${p.email}`],
    ["phone", p.phone, Phone, `tel:${p.phone}`],
    ["location", p.location, MapPin, undefined],
    ["website", p.website, Globe, safeLink(p.website)],
    ["github", p.github, GitFork, safeLink(p.github)],
    ["wechat", p.wechat, MessageCircle, undefined],
  ] as const;
  const photo =
    p.avatarUrl && !p.photoHidden ? (
      <div className="relative h-24 w-[72px] shrink-0 overflow-hidden bg-neutral-100">
        <NextImage
          unoptimized
          width={72}
          height={96}
          src={p.avatarUrl}
          alt="简历证件照"
          className="h-full w-full object-cover"
          style={{
            objectPosition: `${p.photoX ?? 50}% ${p.photoY ?? 50}%`,
            transform: `scale(${p.photoScale ?? 1})`,
          }}
        />
      </div>
    ) : null;
  return (
    <article
      data-resume-document
      className={cn(
        "resume-document",
        web
          ? "w-full"
          : "relative w-[794px] min-h-[1123px] border border-[#ebebeb] shadow-[0_2px_12px_#00000008]",
        paginated ? "border-0" : undefined,
        className,
      )}
      style={
        {
          "--resume-accent": ACCENTS[s.accent ?? "ink"],
          padding: web ? undefined : `${s.margin ?? (compact ? 32 : 40)}pt`,
          fontSize: web ? 16 : (s.fontSize ?? 14),
          lineHeight: web ? 1.625 : (s.lineHeight ?? 1.52),
        } as CSSProperties
      }
    >
      {!web && !paginated ? (
        <style media="print">{`@page { size:A4; margin:${s.margin ?? 40}pt; } @media print { .resume-document {width:auto!important;min-height:0!important;padding:0!important;} }`}</style>
      ) : null}
      <div
        data-resume-flow
        style={
          paginated
            ? {
                height: 1123 - (2 * (s.margin ?? 40) * 4) / 3,
                columnWidth: 794 - (2 * (s.margin ?? 40) * 4) / 3,
                columnGap: (2 * (s.margin ?? 40) * 4) / 3,
                columnFill: "auto",
              }
            : undefined
        }
      >
        <header
          className={cn(
            "mb-7 flex break-inside-avoid items-start gap-5",
            p.photoPosition === "left" && "flex-row-reverse",
          )}
        >
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "font-semibold text-[var(--resume-accent)]",
                web ? "text-[28px] leading-9" : "text-[24px] leading-8",
              )}
            >
              {p.fullName}
            </h1>
            {p.headline ? <p className="mt-1!">{p.headline}</p> : null}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[.85em] text-[#666]">
              {contacts.map(([key, value, Icon, href]) =>
                value && !p.hiddenFields?.includes(key) ? (
                  <span
                    key={key}
                    className="inline-flex min-w-0 max-w-full items-start gap-1.5"
                  >
                    <Icon
                      aria-hidden
                      className="mt-[.25em] size-[1em] shrink-0"
                    />
                    {href ? (
                      <a
                        className="max-w-[216px] break-all"
                        href={safeLink(href)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {value}
                      </a>
                    ) : (
                      <span className="max-w-[216px]">{value}</span>
                    )}
                  </span>
                ) : null,
              )}
            </div>
            {[
              p.jobStatus,
              p.expectedLocation,
              p.experienceYears,
              p.expectedSalary,
            ].some(Boolean) ? (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[.85em] text-[#666]">
                {(
                  [
                    "jobStatus",
                    "expectedLocation",
                    "experienceYears",
                    "expectedSalary",
                  ] as const
                ).map((k) =>
                  p[k] && !p.hiddenFields?.includes(k) ? (
                    <span className="inline-flex items-center gap-1" key={k}>
                      <BriefcaseBusiness aria-hidden className="size-[1em]" />
                      {p[k]}
                    </span>
                  ) : null,
                )}
              </div>
            ) : null}
          </div>
          {photo}
        </header>
        <div className={compact ? "space-y-4" : "space-y-6"}>
          {visibleSections(sections).map((section) => {
            const Icon =
              MODULES.find((m) => m.type === section.type)?.icon ??
              BriefcaseBusiness;
            return (
              <section key={section.id} data-section-id={section.id}>
                <h2
                  className="mb-2 flex items-center gap-2 font-medium text-[var(--resume-accent)]"
                  style={{ fontSize: web ? 16 : "1.12em" }}
                >
                  {onSection ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-0! justify-start gap-2 p-0 text-left text-inherit"
                      onClick={() => onSection(section.id)}
                    >
                      <Icon aria-hidden className="size-[1em]" />
                      {section.title}
                    </Button>
                  ) : (
                    <>
                      <Icon aria-hidden className="size-[1em]" />
                      {section.title}
                    </>
                  )}
                </h2>
                {textContent(section.content).trim() ? (
                  <RichTextRenderer content={section.content} />
                ) : null}
                <div className={compact ? "space-y-3" : "space-y-4"}>
                  {section.items
                    ?.filter((i) =>
                      [i.title, i.subtitle, textContent(i.description)].some(
                        (v) => v?.trim(),
                      ),
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "resume-entry",
                          s.templateId === "timeline" &&
                            section.type !== "skill"
                            ? "grid grid-cols-[90px_minmax(0,1fr)] gap-4"
                            : "",
                        )}
                      >
                        {s.templateId === "timeline" &&
                        section.type !== "skill" ? (
                          <div className="pt-0.5 text-[.8em] tabular-nums text-[#666]">
                            {dateLabel(item, section.type)}
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <h3 className="font-medium">{item.title}</h3>
                            {s.templateId !== "timeline" &&
                            section.type !== "skill" ? (
                              <span className="text-[.8em] tabular-nums text-[#666]">
                                {dateLabel(item, section.type)}
                              </span>
                            ) : null}
                          </header>
                          {[
                            item.subtitle,
                            item.degree,
                            item.educationType,
                            item.department,
                            item.location,
                          ].some(Boolean) ? (
                            <p className="mt-1! text-[.9em] text-[#666]">
                              {[
                                item.subtitle,
                                item.degree,
                                item.educationType,
                                item.department,
                                item.location,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          {item.link ? (
                            <p className="text-[.9em]">
                              <a
                                href={safeLink(item.link)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {item.link}
                              </a>
                            </p>
                          ) : null}
                          <RichTextRenderer content={item.description} />
                          {item.tags?.length ? (
                            <p className="text-[.9em] text-[#666]">
                              {item.tags.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </article>
  );
}
