"use client";

import React from "react";
import { Mail, Phone, MapPin, Globe } from "lucide-react";
import { CVResource } from "@/lib/api/types";
import { RichTextRenderer } from "./rich-text-renderer";
import { Badge } from "./badge";

interface PaperPreviewProps {
  cv: CVResource;
  className?: string;
}

export function PaperPreview({ cv, className = "" }: PaperPreviewProps) {
  const { profile, sections, styleSettings } = cv;

  // Filter only visible sections
  const visibleSections = (sections || []).filter((s) => s.visible !== false);

  const isCompact = styleSettings?.templateId === "compact";
  const paddingClass = isCompact ? "p-8" : "p-10";
  const sectionSpacingClass = isCompact ? "space-y-4" : "space-y-6";
  const itemSpacingClass = isCompact ? "space-y-2.5" : "space-y-4";

  return (
    <div
      className={`w-full max-w-[800px] bg-white text-foreground shadow-sm border border-border min-h-[1050px] transition-all font-sans ${paddingClass} ${className}`}
      style={{
        fontSize: `${styleSettings?.fontSize || 15}px`,
        lineHeight: styleSettings?.lineHeight || 1.5,
      }}
    >
      {/* Header Profile Section */}
      <div className="border-b border-border pb-6 flex items-start justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {profile.fullName || "未填写姓名"}
          </h1>
          {profile.headline && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {profile.headline}
            </p>
          )}

          {/* Contact Details */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {profile.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <a href={`mailto:${profile.email}`} className="hover:underline">
                  {profile.email}
                </a>
              </span>
            )}
            {profile.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                <span>{profile.phone}</span>
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{profile.location}</span>
              </span>
            )}
            {profile.website && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <a
                  href={
                    profile.website.startsWith("http")
                      ? profile.website
                      : `https://${profile.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              </span>
            )}
          </div>
        </div>

        {/* Optional Avatar */}
        {profile.avatarUrl && (
          <div className="shrink-0">
            <img
              src={profile.avatarUrl}
              alt={profile.fullName || "Avatar"}
              className="h-20 w-20 rounded-md border border-border object-cover"
            />
          </div>
        )}
      </div>

      {/* Sections List */}
      <div className={`mt-6 ${sectionSpacingClass}`}>
        {visibleSections.map((sec) => (
          <div key={sec.id} className="break-inside-avoid">
            {/* Section Title */}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground border-b border-border/80 pb-1 mb-3">
              {sec.title}
            </h2>

            {/* Direct RichText Content (e.g. for summary) */}
            {sec.content && (
              <div className="mb-3 text-muted-foreground">
                <RichTextRenderer content={sec.content} />
              </div>
            )}

            {/* Structured Section Items */}
            {sec.items && sec.items.length > 0 && (
              <div className={itemSpacingClass}>
                {sec.items.map((item) => (
                  <div key={item.id} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold text-foreground text-sm">
                        {item.title}
                        {item.subtitle && (
                          <span className="ml-2 font-normal text-muted-foreground text-xs">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-muted-foreground text-xs font-mono">
                        {item.dateRange}
                        {item.location && <span className="ml-2">{item.location}</span>}
                      </div>
                    </div>

                    {/* Item Description */}
                    {item.description && (
                      <div className="mt-1 text-muted-foreground">
                        <RichTextRenderer content={item.description} />
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] py-0 px-1.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
