"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { SECTION_LABELS } from "@/lib/templates/presets";
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
  "h-11 rounded-md border-0 bg-neutral-100/80 px-3 text-[16px] text-neutral-950 shadow-none placeholder:text-neutral-400 focus-visible:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-blue-600 md:h-9 md:text-[14px]";

export function ResumeEditorWorkspace({ docId }: ResumeEditorWorkspaceProps) {
  const handleRef = useRef<ResumeYDocHandle | null>(null);
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "error">("saved");
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [activeSection, setActiveSection] = useState<ResumeSectionId>("basics");
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
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
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = target.querySelector<HTMLElement>(
          "input, textarea, [contenteditable='true'], button"
        );
        focusable?.focus();
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
    setExportNotice(
      "已通过空稿与日期校验；离线 Typst WASM PDF 导出引擎将在 T-CV-02 / T-CV-05 接入。"
    );
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

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] text-sm text-neutral-500">
        正在加载简历草稿...
      </div>
    );
  }

  const hiddenSet = new Set(snapshot.hiddenSections);

  const renderFormColumn = () => (
    <div className="space-y-10 pb-20">
      {snapshot.sectionOrder.map((sectionId) => {
        const isHidden = hiddenSet.has(sectionId);
        return (
          <section
            key={sectionId}
            id={`section-${sectionId}`}
            className={cn("scroll-mt-20 space-y-4", isHidden && "opacity-55")}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950">
                {SECTION_LABELS[sectionId]}
                {isHidden ? (
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    （已在纸面隐藏）
                  </span>
                ) : null}
              </h2>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`toggle-sec-${sectionId}`}
                  className="text-xs font-normal text-neutral-500"
                >
                  {isHidden ? "隐藏" : "显示"}
                </Label>
                <Switch
                  id={`toggle-sec-${sectionId}`}
                  checked={!isHidden}
                  onCheckedChange={(checked) =>
                    handleRef.current?.toggleSectionHidden(sectionId, !checked)
                  }
                />
              </div>
            </div>

            {sectionId === "basics" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="basics-fullName" className="text-xs text-neutral-600">
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
                    <Label htmlFor="basics-targetRole" className="text-xs text-neutral-600">
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
                    <Label htmlFor="basics-phone" className="text-xs text-neutral-600">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="basics-email" className="text-xs text-neutral-600">
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
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="basics-location" className="text-xs text-neutral-600">
                      所在地
                    </Label>
                    <Input
                      id="basics-location"
                      value={snapshot.basics.location}
                      onChange={(e) =>
                        handleRef.current?.updateBasics({ location: e.target.value })
                      }
                      placeholder="例如：上海 / 北京 / 远程"
                      className={FIELD_INPUT_CLASS}
                    />
                  </div>
                </div>

                {snapshot.basics.visibleOptionalFields.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {snapshot.basics.visibleOptionalFields.map((field) => (
                      <div key={field} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`basics-${field}`} className="text-xs text-neutral-600">
                            {OPTIONAL_FIELD_LABELS[field]}
                          </Label>
                          <button
                            type="button"
                            onClick={() =>
                              handleRef.current?.toggleOptionalBasicsField(field, false)
                            }
                            className="text-[11px] text-neutral-400 hover:text-neutral-700"
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
                  <span className="text-xs text-neutral-400">可选字段：</span>
                  {OPTIONAL_BASICS_FIELDS.filter(
                    (f) => !snapshot.basics.visibleOptionalFields.includes(f)
                  ).map((field) => (
                    <Button
                      key={field}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRef.current?.toggleOptionalBasicsField(field, true)}
                      className="h-7 px-2 text-xs text-neutral-600 hover:bg-neutral-100"
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
                      className="space-y-3 rounded-md bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-neutral-500">
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
                            className="h-7 w-7 text-neutral-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`edu-school-${item.id}`}
                            className="text-xs text-neutral-600"
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
                            className="text-xs text-neutral-600"
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
                            className="text-xs text-neutral-600"
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
                              className="text-xs text-neutral-600"
                            >
                              结束月份
                            </Label>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
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
                              inverted && "ring-2 ring-red-500 focus-visible:ring-red-600"
                            )}
                          />
                          {inverted ? (
                            <p role="alert" className="text-xs text-red-600">
                              结束月份不能早于开始月份
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label
                          htmlFor={`edu-notes-${item.id}`}
                          className="text-xs text-neutral-600"
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
                          className="min-h-[72px] rounded-md border-0 bg-neutral-100/80 text-[16px] shadow-none focus-visible:ring-2 focus-visible:ring-blue-600 md:text-[14px]"
                        />
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
                  className="h-9 text-[13px] text-neutral-700 hover:bg-neutral-100"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  添加教育经历
                </Button>
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
                        className="space-y-3 rounded-md bg-white p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-500">
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
                              className="h-7 w-7 text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label
                              htmlFor={`exp-org-${item.id}`}
                              className="text-xs text-neutral-600"
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
                              className="text-xs text-neutral-600"
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
                              className="text-xs text-neutral-600"
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
                                className="text-xs text-neutral-600"
                              >
                                结束月份
                              </Label>
                              <label className="flex items-center gap-1.5 text-xs text-neutral-500">
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
                                inverted && "ring-2 ring-red-500 focus-visible:ring-red-600"
                              )}
                            />
                            {inverted ? (
                              <p role="alert" className="text-xs text-red-600">
                                结束月份不能早于开始月份
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs text-neutral-600">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
                  className="h-9 text-[13px] text-neutral-700 hover:bg-neutral-100"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  添加{sectionId === "work" ? "工作经历" : "项目经历"}
                </Button>
              </div>
            ) : null}

            {sectionId === "skills" ? (
              <div className="rounded-md bg-white p-4">
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
    <div className="min-h-screen bg-[#fafafa] text-neutral-950">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 bg-[#fafafa]/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="返回我的简历"
            className="h-9 w-9 shrink-0"
          >
            <Link href="/resumes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            aria-label="简历名称"
            value={snapshot.title}
            onChange={(e) => handleRef.current?.updateTitle(e.target.value)}
            className="h-8 max-w-[200px] border-0 bg-transparent px-1.5 text-sm font-medium shadow-none hover:bg-neutral-100 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-600 sm:max-w-[280px]"
          />
          <span className="hidden text-xs text-neutral-500 sm:inline">
            {saveState === "saved" ? "已保存到此设备" : "本机保存失败，请重试"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStyleSheetOpen(true)}
            className="h-9 text-[13px] text-neutral-700"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            模板与排版
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDownloadClick}
            className="h-9 bg-neutral-950 px-3.5 text-[13px] text-white hover:bg-neutral-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            下载 PDF
          </Button>
        </div>
      </header>

      {exportNotice ? (
        <div
          role="status"
          className="mx-auto flex max-w-[1440px] items-center justify-between bg-neutral-100 px-4 py-2 text-xs text-neutral-700 sm:px-6"
        >
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="ml-4 text-neutral-500 hover:text-neutral-950"
          >
            关闭
          </button>
        </div>
      ) : null}

      {/* Desktop three-column layout (>= 1200px / xl) */}
      <div className="mx-auto hidden max-w-[1440px] grid-cols-[184px_minmax(420px,1fr)_minmax(420px,1fr)] gap-8 px-6 pt-6 xl:grid">
        <aside aria-label="章节导航与排序" className="sticky top-20 space-y-1 self-start">
          <p className="px-2 pb-2 text-xs font-medium text-neutral-400">章节导航与顺序</p>
          {snapshot.sectionOrder.map((sec, idx) => {
            const isHidden = hiddenSet.has(sec);
            return (
              <div
                key={sec}
                className={cn(
                  "group flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition-colors",
                  activeSection === sec
                    ? "bg-neutral-200/70 font-medium text-neutral-950"
                    : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection(sec);
                    scrollToDomId(`section-${sec}`);
                  }}
                  className={cn(
                    "flex flex-1 items-center gap-1.5 text-left focus-visible:outline-2 focus-visible:outline-blue-600",
                    isHidden && "line-through opacity-55"
                  )}
                >
                  {isHidden ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3 opacity-50" />
                  )}
                  {SECTION_LABELS[sec]}
                </button>
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={`上移${SECTION_LABELS[sec]}`}
                    disabled={idx === 0}
                    onClick={() => handleRef.current?.reorderSections(idx, idx - 1)}
                    className="rounded p-0.5 hover:bg-neutral-200 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`下移${SECTION_LABELS[sec]}`}
                    disabled={idx === snapshot.sectionOrder.length - 1}
                    onClick={() => handleRef.current?.reorderSections(idx, idx + 1)}
                    className="rounded p-0.5 hover:bg-neutral-200 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </aside>

        <main aria-label="简历填写区">{renderFormColumn()}</main>

        <aside aria-label="实时纸面预览" className="sticky top-20 self-start pb-12">
          <p className="mb-2 text-xs text-neutral-400">
            实时纸面预览（点击纸面条目可定位回左侧表单）
          </p>
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto bg-neutral-100/80 p-4">
            <ResumePaper snapshot={snapshot} interactive onLocateItem={handleLocateFromPaper} />
          </div>
        </aside>
      </div>

      {/* Narrow / Mobile two-view tabs (< 1200px) */}
      <div className="px-4 pt-3 xl:hidden">
        <Tabs
          value={mobileTab}
          onValueChange={(v) => setMobileTab(v as "edit" | "preview")}
          className="w-full"
        >
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="edit" className="h-10 text-sm">
              填写
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-10 text-sm">
              预览
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit">{renderFormColumn()}</TabsContent>
          <TabsContent value="preview" className="pb-16">
            <p className="mb-2 text-xs text-neutral-500">点击纸面某段可直接回到对应表单条目</p>
            <div className="bg-neutral-100/80 p-2">
              <ResumePaper snapshot={snapshot} interactive onLocateItem={handleLocateFromPaper} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <StyleSettingsSheet
        open={styleSheetOpen}
        onOpenChange={setStyleSheetOpen}
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
              className="bg-red-600 text-white hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
