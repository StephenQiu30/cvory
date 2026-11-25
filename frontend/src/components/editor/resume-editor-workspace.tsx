"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, EyeOff, Plus, Trash2 } from "lucide-react";
import { StyleSettingsSheet } from "@/components/editor/style-settings-sheet";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { ResumePaper } from "@/components/preview/resume-paper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  EditorLayout,
  type EditorSettings,
  type EditorTab,
} from "@/components/layout/editor-layout";
import { Textarea } from "@/components/ui/textarea";
import {
  OPTIONAL_BASICS_FIELDS,
  hasVisibleResumeContent,
  isDateRangeInverted,
  stripHtmlToText,
  type EducationItem,
  type ExperienceItem,
  type OptionalBasicsField,
  type ResumeSectionId,
  type ResumeSnapshot,
} from "@/lib/contract/contract";
import { getTemplatePreset, SECTION_LABELS } from "@/lib/templates/presets";
import { cn } from "@/lib/utils";
import {
  generateStableId,
  listLocalDrafts,
  openResumeYDoc,
  type ResumeYDocHandle,
} from "@/lib/yjs/local-store";

interface ResumeEditorWorkspaceProps {
  readonly docId: string;
}

interface PendingDelete {
  readonly kind: "education" | "work" | "projects";
  readonly id: string;
  readonly label: string;
}

const OPTIONAL_FIELD_LABELS: Record<OptionalBasicsField, string> = {
  wechat: "微信号",
  github: "GitHub",
  website: "个人网站",
  portfolio: "作品集链接",
};

const FIELD_INPUT_CLASS =
  "h-11 rounded-md border-0 bg-muted px-3 text-[16px] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring min-[1200px]:h-9 min-[1200px]:text-[14px]";

export function ResumeEditorWorkspace({ docId }: ResumeEditorWorkspaceProps) {
  const handleRef = useRef<ResumeYDocHandle | null>(null);
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "error">("saved");
  const [mobileTab, setMobileTab] = useState<EditorTab>("edit");
  const [activeSection, setActiveSection] = useState<ResumeSectionId>("basics");
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [settingsMode, setSettingsMode] = useState<EditorSettings>("all");
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const [manageSectionsOpen, setManageSectionsOpen] = useState(false);
  const manageSectionsTrigger = useRef<HTMLButtonElement>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    const existingEntry = listLocalDrafts().find((item) => item.id === docId);
    const handle = openResumeYDoc(
      docId,
      existingEntry?.templateId ?? "classic-single",
      existingEntry?.title ?? "未命名简历"
    );
    handleRef.current = handle;

    const refresh = () => {
      try {
        setSnapshot(handle.getSnapshot());
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    };

    refresh();
    handle.doc.on("update", refresh);
    if (handle.persistence) {
      void handle.persistence.whenSynced.then(refresh).catch(() => setSaveState("error"));
    }

    return () => {
      handle.doc.off("update", refresh);
      void handle.destroy();
      handleRef.current = null;
    };
  }, [docId]);

  const scrollToDomId = (domId: string) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(domId);
      if (target) {
        const focusableSelector = "input:not([disabled]), textarea, [contenteditable='true']";
        const focusable = target.matches(focusableSelector)
          ? target
          : (target.querySelector<HTMLElement>(focusableSelector) ??
            target.querySelector<HTMLButtonElement>("button:not([disabled])"));
        target.scrollIntoView({ block: "center" });
        focusable?.focus({ preventScroll: true });
      }
    });
  };

  const handleLocateFromPaper = (section: ResumeSectionId, itemId?: string) => {
    setActiveSection(section);
    setMobileTab("edit");
    const domId = itemId ? `item-${itemId}` : `section-${section}`;
    scrollToDomId(domId);
  };

  const findFirstInvertedDateDomId = (current: ResumeSnapshot): string | null => {
    const hidden = new Set(current.hiddenSections);
    if (!hidden.has("education")) {
      for (const item of current.education) {
        if (isDateRangeInverted(item.startMonth, item.endMonth, item.isCurrent)) {
          return `date-end-${item.id}`;
        }
      }
    }
    if (!hidden.has("work")) {
      for (const item of current.work) {
        if (isDateRangeInverted(item.startMonth, item.endMonth, item.isCurrent)) {
          return `date-end-${item.id}`;
        }
      }
    }
    if (!hidden.has("projects")) {
      for (const item of current.projects) {
        if (isDateRangeInverted(item.startMonth, item.endMonth, item.isCurrent)) {
          return `date-end-${item.id}`;
        }
      }
    }
    return null;
  };

  const handleDownloadClick = () => {
    if (!snapshot) {
      return;
    }
    if (!hasVisibleResumeContent(snapshot)) {
      setExportNotice("请至少填写一项可见简历内容后再下载 PDF。");
      setMobileTab("edit");
      scrollToDomId("section-basics");
      return;
    }
    const invertedId = findFirstInvertedDateDomId(snapshot);
    if (invertedId) {
      setExportNotice("检测到起止月份倒序，已定位到需要修正的日期字段。");
      setMobileTab("edit");
      scrollToDomId(invertedId);
      return;
    }
    setExportNotice("PDF 下载暂不可用。你可以继续填写并预览。");
  };

  const handleRequestDeleteEducation = (item: EducationItem) => {
    const hasContent = Boolean(
      item.school.trim() || item.majorOrDegree.trim() || item.notes.trim()
    );
    if (!hasContent) {
      handleRef.current?.removeEducation(item.id);
      return;
    }
    setPendingDelete({
      kind: "education",
      id: item.id,
      label: item.school.trim() || "该条教育经历",
    });
  };

  const handleRequestDeleteExperience = (kind: "work" | "projects", item: ExperienceItem) => {
    const hasContent = Boolean(
      item.organization.trim() || item.role.trim() || stripHtmlToText(item.descriptionHtml)
    );
    if (!hasContent) {
      handleRef.current?.removeExperience(kind, item.id);
      return;
    }
    setPendingDelete({
      kind,
      id: item.id,
      label: item.organization.trim() || (kind === "work" ? "该条工作经历" : "该条项目经历"),
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete || !handleRef.current) {
      return;
    }
    if (pendingDelete.kind === "education") {
      handleRef.current.removeEducation(pendingDelete.id);
    } else {
      handleRef.current.removeExperience(pendingDelete.kind, pendingDelete.id);
    }
    setPendingDelete(null);
  };

  const openSectionManagement = (trigger: HTMLButtonElement) => {
    manageSectionsTrigger.current = trigger;
    setManageSectionsOpen(true);
  };

  if (!snapshot) {
    return (
      <div className="bg-canvas text-muted-foreground flex min-h-screen items-center justify-center text-sm">
        正在加载简历草稿...
      </div>
    );
  }

  const hiddenSet = new Set(snapshot.hiddenSections);

  const form = (
    <div className="space-y-6 pb-4">
      <div className="flex justify-end min-[1200px]:hidden">
        <Button
          type="button"
          variant="link"
          className="h-11 px-0"
          onClick={(event) => openSectionManagement(event.currentTarget)}
        >
          管理章节
        </Button>
      </div>
      {snapshot.sectionOrder.map((sectionId) => {
        const isHidden = hiddenSet.has(sectionId);
        return (
          <section
            key={sectionId}
            id={`section-${sectionId}`}
            className={cn("scroll-mt-20 space-y-4", isHidden && "opacity-55")}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-foreground text-[17px] font-semibold tracking-tight">
                {SECTION_LABELS[sectionId]}
                {isHidden ? (
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    （已在纸面隐藏）
                  </span>
                ) : null}
              </h2>
              {sectionId === "education" && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() =>
                    handleRef.current?.upsertEducation({
                      id: generateStableId("edu"),
                      school: "",
                      majorOrDegree: "",
                      startMonth: "",
                      endMonth: "",
                      isCurrent: false,
                      notes: "",
                    })
                  }
                  className="h-11 shrink-0 px-0 text-[13px] min-[1200px]:h-8"
                >
                  添加教育经历
                </Button>
              )}
              {(sectionId === "work" || sectionId === "projects") && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() =>
                    handleRef.current?.upsertExperience(sectionId, {
                      id: generateStableId(sectionId === "work" ? "work" : "proj"),
                      organization: "",
                      role: "",
                      startMonth: "",
                      endMonth: "",
                      isCurrent: false,
                      descriptionHtml: "",
                    })
                  }
                  className="h-11 shrink-0 px-0 text-[13px] min-[1200px]:h-8"
                >
                  添加{SECTION_LABELS[sectionId]}
                </Button>
              )}
            </div>

            {sectionId === "basics" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="basics-fullName" className="text-muted-foreground text-xs">
                      姓名
                    </Label>
                    <Input
                      id="basics-fullName"
                      value={snapshot.basics.fullName}
                      onChange={(e) =>
                        handleRef.current?.updateBasics({ fullName: e.target.value })
                      }
                      placeholder="输入你的姓名"
                      className={FIELD_INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="basics-targetRole" className="text-muted-foreground text-xs">
                      意向岗位
                    </Label>
                    <Input
                      id="basics-targetRole"
                      value={snapshot.basics.targetRole}
                      onChange={(e) =>
                        handleRef.current?.updateBasics({ targetRole: e.target.value })
                      }
                      placeholder="例如：前端工程师"
                      className={FIELD_INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="basics-email" className="text-muted-foreground text-xs">
                      邮箱
                    </Label>
                    <Input
                      id="basics-email"
                      type="email"
                      value={snapshot.basics.email}
                      onChange={(e) => handleRef.current?.updateBasics({ email: e.target.value })}
                      placeholder="name@example.com"
                      className={FIELD_INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="basics-location" className="text-muted-foreground text-xs">
                      所在地
                    </Label>
                    <Input
                      id="basics-location"
                      value={snapshot.basics.location}
                      onChange={(e) =>
                        handleRef.current?.updateBasics({ location: e.target.value })
                      }
                      placeholder="例如：杭州"
                      className={FIELD_INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5 min-[360px]:col-span-2">
                    <Label htmlFor="basics-phone" className="text-muted-foreground text-xs">
                      电话
                    </Label>
                    <Input
                      id="basics-phone"
                      value={snapshot.basics.phone}
                      onChange={(e) => handleRef.current?.updateBasics({ phone: e.target.value })}
                      placeholder="138-0000-0000"
                      className={FIELD_INPUT_CLASS}
                    />
                  </div>
                </div>

                {snapshot.basics.visibleOptionalFields.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {snapshot.basics.visibleOptionalFields.map((field) => (
                      <div key={field} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor={`basics-${field}`}
                            className="text-muted-foreground text-xs"
                          >
                            {OPTIONAL_FIELD_LABELS[field]}
                          </Label>
                          <button
                            type="button"
                            onClick={() =>
                              handleRef.current?.toggleOptionalBasicsField(field, false)
                            }
                            className="text-muted-foreground hover:text-muted-foreground text-[11px]"
                          >
                            移出
                          </button>
                        </div>
                        <Input
                          id={`basics-${field}`}
                          value={snapshot.basics[field]}
                          onChange={(e) =>
                            handleRef.current?.updateBasics({ [field]: e.target.value })
                          }
                          placeholder={`输入${OPTIONAL_FIELD_LABELS[field]}`}
                          className={FIELD_INPUT_CLASS}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-muted-foreground text-xs">可选字段：</span>
                  {OPTIONAL_BASICS_FIELDS.filter(
                    (f) => !snapshot.basics.visibleOptionalFields.includes(f)
                  ).map((field) => (
                    <Button
                      key={field}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRef.current?.toggleOptionalBasicsField(field, true)}
                      className="text-muted-foreground hover:bg-muted h-7 px-2 text-xs"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {OPTIONAL_FIELD_LABELS[field]}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {sectionId === "education" ? (
              <div className="space-y-5">
                {snapshot.education.map((item, index) => {
                  const inverted = isDateRangeInverted(
                    item.startMonth,
                    item.endMonth,
                    item.isCurrent
                  );
                  return (
                    <div
                      key={item.id}
                      id={`item-${item.id}`}
                      className="bg-background space-y-3 rounded-md p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs font-medium">
                          教育经历 #{index + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="上移教育经历"
                            disabled={index === 0}
                            onClick={() => handleRef.current?.reorderEducation(index, index - 1)}
                            className="h-7 w-7"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="下移教育经历"
                            disabled={index === snapshot.education.length - 1}
                            onClick={() => handleRef.current?.reorderEducation(index, index + 1)}
                            className="h-7 w-7"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="删除教育经历"
                            onClick={() => handleRequestDeleteEducation(item)}
                            className="text-muted-foreground hover:text-destructive h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`edu-school-${item.id}`}
                            className="text-muted-foreground text-xs"
                          >
                            学校
                          </Label>
                          <Input
                            id={`edu-school-${item.id}`}
                            value={item.school}
                            onChange={(e) =>
                              handleRef.current?.upsertEducation({
                                ...item,
                                school: e.target.value,
                              })
                            }
                            placeholder="学校名称"
                            className={FIELD_INPUT_CLASS}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`edu-major-${item.id}`}
                            className="text-muted-foreground text-xs"
                          >
                            专业或学位
                          </Label>
                          <Input
                            id={`edu-major-${item.id}`}
                            value={item.majorOrDegree}
                            onChange={(e) =>
                              handleRef.current?.upsertEducation({
                                ...item,
                                majorOrDegree: e.target.value,
                              })
                            }
                            placeholder="例如：软件工程 · 本科"
                            className={FIELD_INPUT_CLASS}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`date-start-${item.id}`}
                            className="text-muted-foreground text-xs"
                          >
                            开始月份
                          </Label>
                          <Input
                            id={`date-start-${item.id}`}
                            type="month"
                            value={item.startMonth}
                            onChange={(e) =>
                              handleRef.current?.upsertEducation({
                                ...item,
                                startMonth: e.target.value,
                              })
                            }
                            className={FIELD_INPUT_CLASS}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor={`date-end-${item.id}`}
                              className="text-muted-foreground text-xs"
                            >
                              结束月份
                            </Label>
                            <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              <Switch
                                checked={item.isCurrent}
                                onCheckedChange={(checked) =>
                                  handleRef.current?.upsertEducation({
                                    ...item,
                                    isCurrent: checked,
                                    endMonth: checked ? "" : item.endMonth,
                                  })
                                }
                              />
                              至今
                            </label>
                          </div>
                          <Input
                            id={`date-end-${item.id}`}
                            type="month"
                            disabled={item.isCurrent}
                            aria-invalid={inverted}
                            value={item.endMonth}
                            onChange={(e) =>
                              handleRef.current?.upsertEducation({
                                ...item,
                                endMonth: e.target.value,
                              })
                            }
                            className={cn(
                              FIELD_INPUT_CLASS,
                              inverted && "ring-destructive focus-visible:ring-destructive ring-2"
                            )}
                          />
                          {inverted ? (
                            <p role="alert" className="text-destructive text-xs">
                              结束月份不能早于开始月份
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label
                          htmlFor={`edu-notes-${item.id}`}
                          className="text-muted-foreground text-xs"
                        >
                          补充说明（可选）
                        </Label>
                        <Textarea
                          id={`edu-notes-${item.id}`}
                          value={item.notes}
                          onChange={(e) =>
                            handleRef.current?.upsertEducation({ ...item, notes: e.target.value })
                          }
                          placeholder="主修课程、荣誉或成绩"
                          className="bg-muted focus-visible:ring-ring min-h-[72px] rounded-md border-0 text-[16px] shadow-none focus-visible:ring-2 min-[1200px]:text-[14px]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {sectionId === "work" || sectionId === "projects" ? (
              <div className="space-y-5">
                {(sectionId === "work" ? snapshot.work : snapshot.projects).map(
                  (item, index, arr) => {
                    const inverted = isDateRangeInverted(
                      item.startMonth,
                      item.endMonth,
                      item.isCurrent
                    );
                    const isWork = sectionId === "work";
                    return (
                      <div
                        key={item.id}
                        id={`item-${item.id}`}
                        className="bg-background space-y-3 rounded-md p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs font-medium">
                            {isWork ? "工作经历" : "项目经历"} #{index + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="上移条目"
                              disabled={index === 0}
                              onClick={() =>
                                handleRef.current?.reorderExperience(sectionId, index, index - 1)
                              }
                              className="h-7 w-7"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="下移条目"
                              disabled={index === arr.length - 1}
                              onClick={() =>
                                handleRef.current?.reorderExperience(sectionId, index, index + 1)
                              }
                              className="h-7 w-7"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="删除条目"
                              onClick={() => handleRequestDeleteExperience(sectionId, item)}
                              className="text-muted-foreground hover:text-destructive h-7 w-7"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label
                              htmlFor={`exp-org-${item.id}`}
                              className="text-muted-foreground text-xs"
                            >
                              {isWork ? "公司名称" : "项目名称"}
                            </Label>
                            <Input
                              id={`exp-org-${item.id}`}
                              value={item.organization}
                              onChange={(e) =>
                                handleRef.current?.upsertExperience(sectionId, {
                                  ...item,
                                  organization: e.target.value,
                                })
                              }
                              placeholder={isWork ? "公司名称" : "项目名称"}
                              className={FIELD_INPUT_CLASS}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor={`exp-role-${item.id}`}
                              className="text-muted-foreground text-xs"
                            >
                              {isWork ? "岗位" : "担任角色"}
                            </Label>
                            <Input
                              id={`exp-role-${item.id}`}
                              value={item.role}
                              onChange={(e) =>
                                handleRef.current?.upsertExperience(sectionId, {
                                  ...item,
                                  role: e.target.value,
                                })
                              }
                              placeholder={isWork ? "例如：高级前端工程师" : "例如：核心负责人"}
                              className={FIELD_INPUT_CLASS}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor={`date-start-${item.id}`}
                              className="text-muted-foreground text-xs"
                            >
                              开始月份
                            </Label>
                            <Input
                              id={`date-start-${item.id}`}
                              type="month"
                              value={item.startMonth}
                              onChange={(e) =>
                                handleRef.current?.upsertExperience(sectionId, {
                                  ...item,
                                  startMonth: e.target.value,
                                })
                              }
                              className={FIELD_INPUT_CLASS}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label
                                htmlFor={`date-end-${item.id}`}
                                className="text-muted-foreground text-xs"
                              >
                                结束月份
                              </Label>
                              <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                <Switch
                                  checked={item.isCurrent}
                                  onCheckedChange={(checked) =>
                                    handleRef.current?.upsertExperience(sectionId, {
                                      ...item,
                                      isCurrent: checked,
                                      endMonth: checked ? "" : item.endMonth,
                                    })
                                  }
                                />
                                至今
                              </label>
                            </div>
                            <Input
                              id={`date-end-${item.id}`}
                              type="month"
                              disabled={item.isCurrent}
                              aria-invalid={inverted}
                              value={item.endMonth}
                              onChange={(e) =>
                                handleRef.current?.upsertExperience(sectionId, {
                                  ...item,
                                  endMonth: e.target.value,
                                })
                              }
                              className={cn(
                                FIELD_INPUT_CLASS,
                                inverted && "ring-destructive focus-visible:ring-destructive ring-2"
                              )}
                            />
                            {inverted ? (
                              <p role="alert" className="text-destructive text-xs">
                                结束月份不能早于开始月份
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-muted-foreground text-xs">
                            经历内容（支持富文本格式）
                          </span>
                          <TiptapEditor
                            ariaLabel={`${isWork ? "工作" : "项目"}经历内容`}
                            value={item.descriptionHtml}
                            onChange={(html) =>
                              handleRef.current?.upsertExperience(sectionId, {
                                ...item,
                                descriptionHtml: html,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : null}

            {sectionId === "skills" ? (
              <div className="rounded-md">
                <TiptapEditor
                  ariaLabel="专业技能"
                  value={snapshot.skillsHtml}
                  onChange={(html) => handleRef.current?.updateSkillsHtml(html)}
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );

  return (
    <>
      <EditorLayout
        title={snapshot.title}
        onTitleChange={(title) => handleRef.current?.updateTitle(title)}
        saveStatus={saveState === "saved" ? "已保存到此设备" : "本机保存失败"}
        saveFailed={saveState === "error"}
        onSettings={(mode, trigger) => {
          settingsTrigger.current = trigger;
          setSettingsMode(mode);
          setStyleSheetOpen(true);
        }}
        onDownload={handleDownloadClick}
        tab={mobileTab}
        onTabChange={setMobileTab}
        templateName={getTemplatePreset(snapshot.templateId).name}
        notice={
          exportNotice ? (
            <div
              role="status"
              className="bg-muted text-muted-foreground flex shrink-0 items-center justify-between gap-2 px-4 text-xs min-[1200px]:px-6"
            >
              <span>{exportNotice}</span>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => setExportNotice(null)}
              >
                关闭
              </Button>
            </div>
          ) : null
        }
        sectionNavigation={
          <div className="flex flex-col gap-1">
            <h2 className="text-muted-foreground px-2 pb-2 text-xs font-medium">简历内容</h2>
            {snapshot.sectionOrder.map((sec) => {
              const isHidden = hiddenSet.has(sec);
              return (
                <Button
                  key={sec}
                  type="button"
                  variant="ghost"
                  aria-current={activeSection === sec ? "location" : undefined}
                  onClick={() => {
                    setActiveSection(sec);
                    scrollToDomId(`section-${sec}`);
                  }}
                  className={cn(
                    "h-9 justify-start px-3 text-[13px]",
                    activeSection === sec && "bg-accent text-foreground",
                    isHidden && "text-muted-foreground"
                  )}
                >
                  {isHidden && <EyeOff data-icon="inline-start" />}
                  {SECTION_LABELS[sec]}
                </Button>
              );
            })}
            <Button
              type="button"
              variant="link"
              className="mt-1 h-9 justify-start px-2"
              onClick={(event) => openSectionManagement(event.currentTarget)}
            >
              管理章节
            </Button>
          </div>
        }
        form={form}
        preview={
          <ResumePaper
            snapshot={snapshot}
            interactive
            className="min-h-[141.4286cqw]"
            onLocateItem={handleLocateFromPaper}
          />
        }
      />

      <Dialog open={manageSectionsOpen} onOpenChange={setManageSectionsOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            if (manageSectionsTrigger.current?.getClientRects().length) {
              event.preventDefault();
              manageSectionsTrigger.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>管理章节</DialogTitle>
            <DialogDescription>调整章节顺序和纸面显示。</DialogDescription>
          </DialogHeader>
          <ul className="divide-border divide-y">
            {snapshot.sectionOrder.map((sectionId, index) => {
              const label = SECTION_LABELS[sectionId];
              return (
                <li key={sectionId} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm">{label}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      aria-label={`在纸面显示${label}`}
                      checked={!hiddenSet.has(sectionId)}
                      onCheckedChange={(checked) =>
                        handleRef.current?.toggleSectionHidden(sectionId, !checked)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`上移${label}`}
                      className="size-11"
                      disabled={index === 0}
                      onClick={() => handleRef.current?.reorderSections(index, index - 1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`下移${label}`}
                      className="size-11"
                      disabled={index === snapshot.sectionOrder.length - 1}
                      onClick={() => handleRef.current?.reorderSections(index, index + 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <StyleSettingsSheet
        open={styleSheetOpen}
        onOpenChange={setStyleSheetOpen}
        mode={settingsMode}
        restoreFocus={(event) => {
          if (
            settingsTrigger.current?.isConnected &&
            settingsTrigger.current.getClientRects().length > 0
          ) {
            event.preventDefault();
            settingsTrigger.current.focus();
          }
        }}
        templateId={snapshot.templateId}
        overrides={snapshot.styleOverrides}
        onChangeTemplate={(nextTemplate) => handleRef.current?.setTemplateId(nextTemplate)}
        onUpdateOverride={(key, value) => handleRef.current?.updateStyleOverride(key, value)}
        onResetDefaults={() => handleRef.current?.resetStyleOverrides()}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除「{pendingDelete?.label}」？</AlertDialogTitle>
            <AlertDialogDescription>
              该条目包含已填写内容，删除后将从当前简历中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
