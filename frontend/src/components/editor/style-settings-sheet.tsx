"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ResumeFontFamily,
  ResumeSpacingPreset,
  ResumeStyleOverrides,
  SupportedTemplateId,
} from "@/lib/contract/contract";
import {
  ACCENT_COLOR_PRESETS,
  RESUME_TEMPLATE_PRESETS,
  resolveEffectiveStyle,
} from "@/lib/templates/presets";
import { cn } from "@/lib/utils";

interface StyleSettingsSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly templateId: SupportedTemplateId;
  readonly overrides: ResumeStyleOverrides;
  readonly onChangeTemplate: (templateId: SupportedTemplateId) => void;
  readonly onUpdateOverride: <K extends keyof ResumeStyleOverrides>(
    key: K,
    value: ResumeStyleOverrides[K]
  ) => void;
  readonly onResetDefaults: () => void;
}

export function StyleSettingsSheet({
  open,
  onOpenChange,
  templateId,
  overrides,
  onChangeTemplate,
  onUpdateOverride,
  onResetDefaults,
}: StyleSettingsSheetProps) {
  const effective = resolveEffectiveStyle(templateId, overrides);
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-white sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">模板与排版设置</SheetTitle>
          <SheetDescription className="text-xs text-neutral-500">
            只影响当前简历。切换模板时保留你主动改过的项，其余自动跟随新模板默认值。
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-neutral-700">当前纸样模板</Label>
            <div className="grid grid-cols-1 gap-2">
              {RESUME_TEMPLATE_PRESETS.map((preset) => {
                const active = preset.id === templateId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChangeTemplate(preset.id)}
                    className={cn(
                      "flex flex-col items-start rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600",
                      active
                        ? "bg-neutral-950 text-white"
                        : "bg-neutral-100/80 text-neutral-900 hover:bg-neutral-100"
                    )}
                  >
                    <span className="text-[13px] font-medium">{preset.name}</span>
                    <span
                      className={cn(
                        "mt-0.5 text-[11px]",
                        active ? "text-neutral-300" : "text-neutral-500"
                      )}
                    >
                      {preset.tagline}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="style-font" className="text-xs font-medium text-neutral-700">
                正文字体 {overrides.fontFamily ? "· 已自定义" : "· 跟随模板"}
              </Label>
              <Select
                value={effective.fontFamily}
                onValueChange={(v) => onUpdateOverride("fontFamily", v as ResumeFontFamily)}
              >
                <SelectTrigger id="style-font" className="h-9 border-0 bg-neutral-100/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans">思源黑体（现代无衬线）</SelectItem>
                  <SelectItem value="serif">思源宋体（中文书简衬线）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="style-size" className="text-xs font-medium text-neutral-700">
                正文字号 {overrides.fontSizePt ? "· 已自定义" : "· 跟随模板"}
              </Label>
              <Select
                value={String(effective.fontSizePt)}
                onValueChange={(v) => onUpdateOverride("fontSizePt", Number(v) as 9 | 10 | 11 | 12)}
              >
                <SelectTrigger id="style-size" className="h-9 border-0 bg-neutral-100/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9">9 pt（高密度）</SelectItem>
                  <SelectItem value="10">10 pt（标准）</SelectItem>
                  <SelectItem value="11">11 pt（舒适）</SelectItem>
                  <SelectItem value="12">12 pt（大号）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="style-line-height" className="text-xs font-medium text-neutral-700">
                行距 {overrides.lineHeight ? "· 已自定义" : "· 跟随模板"}
              </Label>
              <Select
                value={String(effective.lineHeight)}
                onValueChange={(v) =>
                  onUpdateOverride("lineHeight", Number(v) as 1.25 | 1.4 | 1.5 | 1.65)
                }
              >
                <SelectTrigger id="style-line-height" className="h-9 border-0 bg-neutral-100/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.25">1.25 倍（紧凑）</SelectItem>
                  <SelectItem value="1.4">1.40 倍（标准）</SelectItem>
                  <SelectItem value="1.5">1.50 倍（舒适）</SelectItem>
                  <SelectItem value="1.65">1.65 倍（宽松）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="style-spacing" className="text-xs font-medium text-neutral-700">
                页边距与段落间距 {overrides.spacing ? "· 已自定义" : "· 跟随模板"}
              </Label>
              <Select
                value={effective.spacing}
                onValueChange={(v) => onUpdateOverride("spacing", v as ResumeSpacingPreset)}
              >
                <SelectTrigger id="style-spacing" className="h-9 border-0 bg-neutral-100/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">紧凑</SelectItem>
                  <SelectItem value="standard">标准</SelectItem>
                  <SelectItem value="relaxed">宽松</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-neutral-700">
                主题色 {overrides.accentColor ? "· 已自定义" : "· 跟随模板"}
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_COLOR_PRESETS.map((swatch) => {
                  const selected = effective.accentColor === swatch.value;
                  return (
                    <button
                      key={swatch.value}
                      type="button"
                      title={swatch.name}
                      aria-label={`主题色：${swatch.name}`}
                      aria-pressed={selected}
                      onClick={() => onUpdateOverride("accentColor", swatch.value)}
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-md bg-neutral-100/80 px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-600",
                        selected && "ring-2 ring-blue-600"
                      )}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: swatch.value }}
                      />
                      <span>{swatch.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Separator />

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasOverrides}
            onClick={onResetDefaults}
            className="h-9 w-full text-[13px]"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            恢复模板默认排版
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
