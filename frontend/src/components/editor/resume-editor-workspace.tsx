"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Cloud,
  Code2,
  Download,
  FileJson,
  ImagePlus,
  Plus,
  Share2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { EmailAuthDialog } from "@/components/auth/email-auth-dialog";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  claimDraftToCloud,
  downloadSnapshotPdf,
  getStoredAuthSession,
  saveCloudResume,
  toggleCloudShare,
  uploadAvatarToS3,
  type AuthSession,
} from "@/lib/api/http";
import {
  CVORY_CONTRACT_VERSION,
  createEmptyResumeContent,
  hasVisibleResumeContent,
  isDateRangeInverted,
  isRichTextOnlySection,
  stripHtmlToText,
  type AvatarAlignment,
  type BasicsSection,
  type LocalResumeDocument,
  type ResumeSection,
  type ResumeSectionItem,
} from "@/lib/contract/contract";
import {
  applyMarkdownToResume,
  exportDraftToJson,
  generateStableId,
  getLocalDraftsServerSnapshot,
  getLocalDraftsSnapshot,
  resumeToMarkdown,
  saveLocalDraft,
  subscribeLocalDrafts,
} from "@/lib/storage/local-drafts";
import { cn } from "@/lib/utils";

interface ResumeEditorWorkspaceProps {
  readonly docId: string;
}

interface PendingDelete {
  readonly sectionId: string;
  readonly itemId?: string;
  readonly label: string;
}

const FIELD_INPUT_CLASS =
  "h-10 rounded-md border-0 bg-neutral-100/80 px-3 text-[15px] text-neutral-950 shadow-none placeholder:text-neutral-400 focus-visible:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-blue-600 md:h-9 md:text-[13.5px]";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ResumeEditorWorkspace({ docId }: ResumeEditorWorkspaceProps) {
  const allDrafts = useSyncExternalStore(
    subscribeLocalDrafts,
    getLocalDraftsSnapshot,
    getLocalDraftsServerSnapshot
  );
  const storedDoc = allDrafts.find((item) => item.id === docId) ?? null;
  const [fallbackDoc] = useState<LocalResumeDocument>(() => ({
    id: docId,
    contract_version: CVORY_CONTRACT_VERSION,
    title: "未命名简历",
    template_id: "classic-single",
    version: 1,
    content: createEmptyResumeContent(),
    updated_at: "2026-11-26T00:00:00.000Z",
  }));
  const doc = storedDoc ?? fallbackDoc;

  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [addModuleDialogOpen, setAddModuleDialogOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [editorMode, setEditorMode] = useState<"form" | "markdown">("form");
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [activeSectionId, setActiveSectionId] = useState<string>("basics");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState<"local" | "saving" | "synced" | "conflict">(
    () => (storedDoc?.remote_id ? "synced" : "local")
  );

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistUpdate = (updater: (prev: LocalResumeDocument) => LocalResumeDocument) => {
    const next: LocalResumeDocument = {
      ...updater(doc),
      updated_at: new Date().toISOString(),
    };
    saveLocalDraft(next);

    if (next.remote_id && authSession) {
      setCloudSyncState("saving");
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      const remoteId = next.remote_id;
      saveTimerRef.current = setTimeout(() => {
        void saveCloudResume(remoteId, next)
          .then((saved) => {
            saveLocalDraft({
              ...next,
              version: saved.version,
              updated_at: saved.updated_at,
            });
            setCloudSyncState("synced");
          })
          .catch(() => {
            setCloudSyncState("conflict");
            setNotice("云端保存冲突或网络异常（已保留本机最新内容），请检查后重试。");
          });
      }, 800);
    }
  };

  const updateBasics = (patch: Partial<BasicsSection>) => {
    persistUpdate((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        basics: { ...prev.content.basics, ...patch },
      },
    }));
  };

  const updateSection = (sectionId: string, updater: (sec: ResumeSection) => ResumeSection) => {
    persistUpdate((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        sections: prev.content.sections.map((sec) => (sec.id === sectionId ? updater(sec) : sec)),
      },
    }));
  };

  const reorderSections = (fromIdx: number, toIdx: number) => {
    persistUpdate((prev) => {
      const list = [...prev.content.sections];
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) {
        return prev;
      }
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return {
        ...prev,
        content: { ...prev.content, sections: list },
      };
    });
  };

  const handleAddCustomSection = () => {
    const title = newModuleTitle.trim();
    if (!title) {
      return;
    }
    const newSec: ResumeSection = {
      id: generateStableId("sec-custom"),
      type: "custom",
      title,
      visible: true,
      items: [],
      rich_text_html: "",
    };
    persistUpdate((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        sections: [...prev.content.sections, newSec],
      },
    }));
    setNewModuleTitle("");
    setAddModuleDialogOpen(false);
    setActiveSectionId(newSec.id);
    scrollToDomId(`section-${newSec.id}`);
  };

  const scrollToDomId = (domId: string) => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById(domId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.querySelector<HTMLElement>(
          "input, textarea, [contenteditable='true'], button"
        );
        focusable?.focus();
      }
    });
  };

  const handleLocateFromPaper = (sectionId: string, itemId?: string) => {
    setEditorMode("form");
    setActiveSectionId(sectionId);
    setMobileTab("edit");
    scrollToDomId(itemId ? `item-${itemId}` : `section-${sectionId}`);
  };

  const handleToggleMarkdownMode = () => {
    if (!doc) {
      return;
    }
    if (editorMode === "form") {
      setMarkdownDraft(resumeToMarkdown(doc));
      setEditorMode("markdown");
    } else {
      persistUpdate((prev) => applyMarkdownToResume(prev, markdownDraft));
      setEditorMode("form");
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!authSession) {
      setAuthDialogOpen(true);
      setNotice("上传头像至对象存储需要先完成邮箱验证登录。");
      return;
    }
    setIsUploadingAvatar(true);
    setNotice(null);
    try {
      const res = await uploadAvatarToS3(file);
      updateBasics({ avatar_url: res.url });
      setNotice("头像已压缩并上传成功。");
    } catch {
      setNotice("头像上传失败：请确保文件为 5MB 以内的 PNG/JPEG/WebP 且后端 S3 已配置。");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleClaimOrSyncCloud = async (sessionOverride?: AuthSession) => {
    const activeSession = sessionOverride ?? authSession;
    if (!doc || !activeSession) {
      setAuthDialogOpen(true);
      return;
    }
    setCloudSyncState("saving");
    try {
      const claimed = await claimDraftToCloud(doc);
      const updated: LocalResumeDocument = {
        ...doc,
        remote_id: claimed.resume.id,
        version: claimed.resume.version,
        share_enabled: claimed.resume.share_enabled,
        share_token: claimed.resume.share_token,
        updated_at: claimed.resume.updated_at,
      };
      saveLocalDraft(updated);
      setCloudSyncState("synced");
      setNotice("已开启云端保存，后续编辑将自动防抖同步。");
    } catch {
      setCloudSyncState("conflict");
      setNotice("云端认领失败，请确认 FastAPI 服务可达后重试（本机内容已安全保留）。");
    }
  };

  const handleToggleShare = async (enabled: boolean) => {
    if (!doc) {
      return;
    }
    if (!authSession) {
      setShareDialogOpen(false);
      setAuthDialogOpen(true);
      return;
    }
    try {
      let remoteId = doc.remote_id;
      if (!remoteId) {
        const claimed = await claimDraftToCloud(doc);
        remoteId = claimed.resume.id;
      }
      const res = await toggleCloudShare(remoteId, enabled);
      const updated: LocalResumeDocument = {
        ...doc,
        remote_id: remoteId,
        share_enabled: res.share_enabled,
        share_token: res.share_token,
      };
      saveLocalDraft(updated);
    } catch {
      setNotice("更新分享状态失败，请确认后端服务已启动。");
    }
  };

  const handleExportPdf = async () => {
    if (!doc) {
      return;
    }
    if (!hasVisibleResumeContent(doc.content)) {
      setNotice("请至少填写一项可见内容后再导出 PDF。");
      setMobileTab("edit");
      scrollToDomId("section-basics");
      return;
    }
    for (const sec of doc.content.sections) {
      if (!sec.visible) {
        continue;
      }
      for (const item of sec.items) {
        if (isDateRangeInverted(item.start_month, item.end_month, item.is_current)) {
          setNotice("检测到起止月份倒序，已定位到对应日期字段。");
          setEditorMode("form");
          setMobileTab("edit");
          scrollToDomId(`date-end-${item.id}`);
          return;
        }
      }
    }

    setIsExportingPdf(true);
    setNotice(null);
    try {
      const pdfBlob = await downloadSnapshotPdf(doc);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.title || "cvory-resume"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice("PDF 导出失败：请确认 FastAPI 后端（Playwright 引擎）正在运行。");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportJson = () => {
    if (!doc) {
      return;
    }
    const blob = new Blob([exportDraftToJson(doc)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title || "cvory-resume"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    if (pendingDelete.itemId) {
      const targetItemId = pendingDelete.itemId;
      updateSection(pendingDelete.sectionId, (sec) => ({
        ...sec,
        items: sec.items.filter((it) => it.id !== targetItemId),
      }));
    } else {
      const targetSectionId = pendingDelete.sectionId;
      persistUpdate((prev) => ({
        ...prev,
        content: {
          ...prev.content,
          sections: prev.content.sections.filter((sec) => sec.id !== targetSectionId),
        },
      }));
    }
    setPendingDelete(null);
  };

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] text-sm text-neutral-500">
        正在加载简历工作台...
      </div>
    );
  }

  const shareUrl =
    doc.share_enabled && doc.share_token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${doc.share_token}`
      : null;

  const renderFormColumn = () => {
    if (editorMode === "markdown") {
      return (
        <div className="space-y-3 pb-20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Markdown 编辑模式（`# 姓名`、`## 模块名`、`### 标题 | 副标题 | 起止时间`）
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleMarkdownMode}
              className="h-8 text-xs"
            >
              返回表单模式
            </Button>
          </div>
          <Textarea
            aria-label="Markdown 简历内容"
            value={markdownDraft}
            onChange={(e) => {
              const nextMd = e.target.value;
              setMarkdownDraft(nextMd);
              persistUpdate((prev) => applyMarkdownToResume(prev, nextMd));
            }}
            className="min-h-[640px] rounded-md border-0 bg-white p-4 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </div>
      );
    }

    const b = doc.content.basics;

    return (
      <div className="space-y-8 pb-20">
        {/* 基本信息（对标老鱼简历：头像+对齐、核心信息、求职意向、动态自定义字段） */}
        <section id="section-basics" className="scroll-mt-20 space-y-4 rounded-md bg-white p-5">
          <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950">基本信息</h2>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-16 items-center justify-center overflow-hidden rounded bg-neutral-100 text-xs text-neutral-400">
              {b.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.avatar_url} alt="头像预览" className="h-full w-full object-cover" />
              ) : (
                "头像"
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleAvatarUpload(file);
                    e.target.value = "";
                  }
                }}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="h-8 text-xs"
                >
                  <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                  {isUploadingAvatar ? "上传中..." : "上传头像"}
                </Button>
                {(["left", "right", "hidden"] as const).map((align: AvatarAlignment) => (
                  <Button
                    key={align}
                    type="button"
                    variant={b.avatar_alignment === align ? "default" : "ghost"}
                    size="sm"
                    onClick={() => updateBasics({ avatar_alignment: align })}
                    className="h-8 px-2.5 text-xs"
                  >
                    {align === "left" ? "左对齐" : align === "right" ? "右对齐" : "隐藏"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="basics-name" className="text-xs text-neutral-600">
                姓名
              </Label>
              <Input
                id="basics-name"
                value={b.full_name}
                onChange={(e) => updateBasics({ full_name: e.target.value })}
                placeholder="你的姓名"
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="basics-phone" className="text-xs text-neutral-600">
                电话
              </Label>
              <Input
                id="basics-phone"
                value={b.phone}
                onChange={(e) => updateBasics({ phone: e.target.value })}
                placeholder="手机号码"
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="basics-email" className="text-xs text-neutral-600">
                邮箱
              </Label>
              <Input
                id="basics-email"
                type="email"
                value={b.email}
                onChange={(e) => updateBasics({ email: e.target.value })}
                placeholder="name@example.com"
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="basics-gender" className="text-xs text-neutral-600">
                性别
              </Label>
              <Input
                id="basics-gender"
                value={b.gender}
                onChange={(e) => updateBasics({ gender: e.target.value })}
                placeholder="男 / 女"
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="basics-age" className="text-xs text-neutral-600">
                年龄
              </Label>
              <Input
                id="basics-age"
                value={b.age}
                onChange={(e) => updateBasics({ age: e.target.value })}
                placeholder="例如：24"
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="basics-wechat" className="text-xs text-neutral-600">
                微信号
              </Label>
              <Input
                id="basics-wechat"
                value={b.wechat}
                onChange={(e) => updateBasics({ wechat: e.target.value })}
                placeholder="微信号"
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="basics-github" className="text-xs text-neutral-600">
                GitHub / 个人主页
              </Label>
              <Input
                id="basics-github"
                value={b.github}
                onChange={(e) => updateBasics({ github: e.target.value })}
                placeholder="https://github.com/..."
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="basics-degree" className="text-xs text-neutral-600">
                学历
              </Label>
              <Input
                id="basics-degree"
                value={b.degree}
                onChange={(e) => updateBasics({ degree: e.target.value })}
                placeholder="本科 / 硕士"
                className={FIELD_INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-neutral-700">求职意向</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                aria-label="当前状态"
                value={b.job_status}
                onChange={(e) => updateBasics({ job_status: e.target.value })}
                placeholder="当前状态（如：在职-月内到岗）"
                className={FIELD_INPUT_CLASS}
              />
              <Input
                aria-label="职位名称"
                value={b.target_role}
                onChange={(e) => updateBasics({ target_role: e.target.value })}
                placeholder="意向岗位（如：AI 应用开发）"
                className={FIELD_INPUT_CLASS}
              />
              <Input
                aria-label="期望工作地"
                value={b.expected_city}
                onChange={(e) => updateBasics({ expected_city: e.target.value })}
                placeholder="期望工作地（如：上海）"
                className={FIELD_INPUT_CLASS}
              />
            </div>
          </div>

          {/* 动态自定义字段 */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-700">自定义扩展字段</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateBasics({
                    custom_fields: [
                      ...b.custom_fields,
                      {
                        id: generateStableId("cf"),
                        label: "自定义项",
                        value: "",
                        visible: true,
                      },
                    ],
                  })
                }
                className="h-7 px-2 text-xs text-neutral-600"
              >
                <Plus className="mr-1 h-3 w-3" />
                添加字段
              </Button>
            </div>
            {b.custom_fields.map((field) => (
              <div key={field.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-2">
                <Input
                  aria-label="字段名"
                  value={field.label}
                  onChange={(e) =>
                    updateBasics({
                      custom_fields: b.custom_fields.map((f) =>
                        f.id === field.id ? { ...f, label: e.target.value } : f
                      ),
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                />
                <Input
                  aria-label="字段值"
                  value={field.value}
                  onChange={(e) =>
                    updateBasics({
                      custom_fields: b.custom_fields.map((f) =>
                        f.id === field.id ? { ...f, value: e.target.value } : f
                      ),
                    })
                  }
                  placeholder="输入内容"
                  className={FIELD_INPUT_CLASS}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="删除自定义字段"
                  onClick={() =>
                    updateBasics({
                      custom_fields: b.custom_fields.filter((f) => f.id !== field.id),
                    })
                  }
                  className="h-8 w-8 text-neutral-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* 全部启用中的预设与自定义模块 */}
        {doc.content.sections
          .filter((sec) => sec.visible)
          .map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className="scroll-mt-20 space-y-4 rounded-md bg-white p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <Input
                  aria-label="模块标题"
                  value={section.title}
                  onChange={(e) =>
                    updateSection(section.id, (s) => ({ ...s, title: e.target.value }))
                  }
                  className="h-8 max-w-[220px] border-0 bg-transparent px-1 text-[16px] font-semibold shadow-none hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-blue-600"
                />
                {section.type === "custom" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPendingDelete({ sectionId: section.id, label: `模块「${section.title}」` })
                    }
                    className="h-8 text-xs text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    删除模块
                  </Button>
                ) : null}
              </div>

              {isRichTextOnlySection(section.type) ? (
                <TiptapEditor
                  ariaLabel={section.title}
                  value={section.rich_text_html}
                  onChange={(html) =>
                    updateSection(section.id, (s) => ({ ...s, rich_text_html: html }))
                  }
                />
              ) : (
                <div className="space-y-4">
                  {section.items.map((item, idx) => {
                    const inverted = isDateRangeInverted(
                      item.start_month,
                      item.end_month,
                      item.is_current
                    );
                    const patchItem = (patch: Partial<ResumeSectionItem>) =>
                      updateSection(section.id, (s) => ({
                        ...s,
                        items: s.items.map((it) => (it.id === item.id ? { ...it, ...patch } : it)),
                      }));

                    return (
                      <div
                        key={item.id}
                        id={`item-${item.id}`}
                        className="space-y-3 rounded-md bg-neutral-50/70 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-500">
                            {section.title} #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="上移条目"
                              disabled={idx === 0}
                              onClick={() =>
                                updateSection(section.id, (s) => {
                                  const next = [...s.items];
                                  const [m] = next.splice(idx, 1);
                                  next.splice(idx - 1, 0, m);
                                  return { ...s, items: next };
                                })
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
                              disabled={idx === section.items.length - 1}
                              onClick={() =>
                                updateSection(section.id, (s) => {
                                  const next = [...s.items];
                                  const [m] = next.splice(idx, 1);
                                  next.splice(idx + 1, 0, m);
                                  return { ...s, items: next };
                                })
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
                              onClick={() => {
                                const hasData = Boolean(
                                  item.title.trim() ||
                                  item.subtitle.trim() ||
                                  stripHtmlToText(item.content_html)
                                );
                                if (!hasData) {
                                  updateSection(section.id, (s) => ({
                                    ...s,
                                    items: s.items.filter((it) => it.id !== item.id),
                                  }));
                                } else {
                                  setPendingDelete({
                                    sectionId: section.id,
                                    itemId: item.id,
                                    label: item.title.trim() || `${section.title}条目`,
                                  });
                                }
                              }}
                              className="h-7 w-7 text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Input
                            aria-label="主标题"
                            value={item.title}
                            onChange={(e) => patchItem({ title: e.target.value })}
                            placeholder={
                              section.type === "education"
                                ? "学校名称"
                                : section.type === "work"
                                  ? "公司名称"
                                  : "标题 / 名称"
                            }
                            className={FIELD_INPUT_CLASS}
                          />
                          <Input
                            aria-label="副标题"
                            value={item.subtitle}
                            onChange={(e) => patchItem({ subtitle: e.target.value })}
                            placeholder={
                              section.type === "education"
                                ? "专业与学历"
                                : section.type === "work"
                                  ? "岗位名称"
                                  : "角色 / 补充说明"
                            }
                            className={FIELD_INPUT_CLASS}
                          />
                          <Input
                            id={`date-start-${item.id}`}
                            aria-label="开始月份"
                            type="month"
                            value={item.start_month}
                            onChange={(e) => patchItem({ start_month: e.target.value })}
                            className={FIELD_INPUT_CLASS}
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Input
                                id={`date-end-${item.id}`}
                                aria-label="结束月份"
                                type="month"
                                disabled={item.is_current}
                                aria-invalid={inverted}
                                value={item.end_month}
                                onChange={(e) => patchItem({ end_month: e.target.value })}
                                className={cn(FIELD_INPUT_CLASS, inverted && "ring-2 ring-red-500")}
                              />
                              <label className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
                                <Switch
                                  checked={item.is_current}
                                  onCheckedChange={(checked) =>
                                    patchItem({
                                      is_current: checked,
                                      end_month: checked ? "" : item.end_month,
                                    })
                                  }
                                />
                                至今
                              </label>
                            </div>
                            {inverted ? (
                              <p role="alert" className="text-xs text-red-600">
                                结束月份不能早于开始月份
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <TiptapEditor
                          ariaLabel={`${section.title}详情`}
                          value={item.content_html}
                          onChange={(html) => patchItem({ content_html: html })}
                        />
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateSection(section.id, (s) => ({
                        ...s,
                        items: [
                          ...s.items,
                          {
                            id: generateStableId("item"),
                            title: "",
                            subtitle: "",
                            start_month: "",
                            end_month: "",
                            is_current: false,
                            location: "",
                            link: "",
                            content_html: "",
                          },
                        ],
                      }))
                    }
                    className="h-9 text-[13px] text-neutral-700 hover:bg-neutral-100"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    添加{section.title}
                  </Button>
                </div>
              )}
            </section>
          ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-950">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 bg-[#fafafa]/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="返回我的简历" className="h-9 w-9">
            <Link href="/resumes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            aria-label="简历名称"
            value={doc.title}
            onChange={(e) => persistUpdate((prev) => ({ ...prev, title: e.target.value }))}
            className="h-8 max-w-[160px] border-0 bg-transparent px-1.5 text-sm font-medium shadow-none hover:bg-neutral-100 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-600 sm:max-w-[240px]"
          />
          <span className="hidden text-xs text-neutral-500 md:inline">
            {cloudSyncState === "saving"
              ? "云端保存中..."
              : cloudSyncState === "synced"
                ? `已同步 v${doc.version} · ${formatTime(doc.updated_at)}`
                : `已保存 ${formatTime(doc.updated_at)}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleClaimOrSyncCloud()}
            className="hidden h-9 text-xs text-neutral-600 sm:inline-flex"
          >
            <Cloud className="mr-1.5 h-3.5 w-3.5" />
            {authSession ? (doc.remote_id ? "已连云端" : "同步云端") : "登录同步"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleMarkdownMode}
            className="hidden h-9 text-xs text-neutral-600 lg:inline-flex"
          >
            <Code2 className="mr-1.5 h-3.5 w-3.5" />
            {editorMode === "form" ? "切 Markdown" : "切表单"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExportJson}
            className="hidden h-9 text-xs text-neutral-600 lg:inline-flex"
          >
            <FileJson className="mr-1.5 h-3.5 w-3.5" />
            备份 JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShareDialogOpen(true)}
            className="h-9 text-xs text-neutral-700"
          >
            <Share2 className="mr-1 h-3.5 w-3.5" />
            分享
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStyleSheetOpen(true)}
            className="h-9 text-xs text-neutral-700"
          >
            <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
            排版
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isExportingPdf}
            onClick={() => void handleExportPdf()}
            className="h-9 bg-neutral-950 px-3.5 text-xs text-white hover:bg-neutral-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {isExportingPdf ? "导出中..." : "导出 PDF"}
          </Button>
        </div>
      </header>

      {notice ? (
        <div
          role="status"
          className="mx-auto flex max-w-[1480px] items-center justify-between bg-neutral-100 px-4 py-2 text-xs text-neutral-700 sm:px-6"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-4 text-neutral-500 hover:text-neutral-950"
          >
            关闭
          </button>
        </div>
      ) : null}

      {/* Desktop three-column layout (老鱼式左栏模块选择 + 中栏表单 + 右栏实时预览) */}
      <div className="mx-auto hidden max-w-[1480px] grid-cols-[204px_minmax(440px,1fr)_minmax(440px,1fr)] gap-6 px-6 pt-5 xl:grid">
        <aside aria-label="模块选择" className="sticky top-20 space-y-1.5 self-start">
          <p className="px-2 pb-1 text-xs font-medium text-neutral-400">模块选择</p>
          <button
            type="button"
            onClick={() => {
              setActiveSectionId("basics");
              scrollToDomId("section-basics");
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[13px] transition-colors",
              activeSectionId === "basics"
                ? "bg-neutral-200/70 font-medium text-neutral-950"
                : "text-neutral-600 hover:bg-neutral-100"
            )}
          >
            <span>基本信息</span>
          </button>

          {doc.content.sections.map((sec, idx) => (
            <div
              key={sec.id}
              className={cn(
                "group flex items-center justify-between gap-1 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                activeSectionId === sec.id
                  ? "bg-neutral-200/70 font-medium text-neutral-950"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveSectionId(sec.id);
                  if (sec.visible) {
                    scrollToDomId(`section-${sec.id}`);
                  }
                }}
                className={cn("min-w-0 flex-1 truncate text-left", !sec.visible && "opacity-55")}
              >
                {sec.title}
              </button>
              <div className="flex items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  aria-label={`上移${sec.title}`}
                  disabled={idx === 0}
                  onClick={() => reorderSections(idx, idx - 1)}
                  className="rounded p-0.5 hover:bg-neutral-200 disabled:opacity-30"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`下移${sec.title}`}
                  disabled={idx === doc.content.sections.length - 1}
                  onClick={() => reorderSections(idx, idx + 1)}
                  className="rounded p-0.5 hover:bg-neutral-200 disabled:opacity-30"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <Switch
                aria-label={`开关${sec.title}`}
                checked={sec.visible}
                onCheckedChange={(checked) =>
                  updateSection(sec.id, (s) => ({ ...s, visible: checked }))
                }
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddModuleDialogOpen(true)}
            className="mt-3 h-9 w-full text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加自定义模块
          </Button>
        </aside>

        <main aria-label="简历填写区">{renderFormColumn()}</main>

        <aside aria-label="实时纸面预览" className="sticky top-20 self-start pb-12">
          <p className="mb-2 text-xs text-neutral-400">
            实时纸面预览（与 Playwright 导出 A4 PDF 100% 同源，点击条目可定位表单）
          </p>
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto bg-neutral-100/80 p-4">
            <ResumePaper
              templateId={doc.template_id}
              content={doc.content}
              interactive
              onLocateSection={handleLocateFromPaper}
            />
          </div>
        </aside>
      </div>

      {/* Mobile / Narrow viewport (< 1200px) */}
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
            <div className="bg-neutral-100/80 p-2">
              <ResumePaper
                templateId={doc.template_id}
                content={doc.content}
                interactive
                onLocateSection={handleLocateFromPaper}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <StyleSettingsSheet
        open={styleSheetOpen}
        onOpenChange={setStyleSheetOpen}
        templateId={doc.template_id}
        overrides={doc.content.style_overrides}
        onChangeTemplate={(templateId) =>
          persistUpdate((prev) => ({ ...prev, template_id: templateId }))
        }
        onUpdateOverride={(key, value) =>
          persistUpdate((prev) => ({
            ...prev,
            content: {
              ...prev.content,
              style_overrides: { ...prev.content.style_overrides, [key]: value },
            },
          }))
        }
        onResetDefaults={() =>
          persistUpdate((prev) => ({
            ...prev,
            content: { ...prev.content, style_overrides: {} },
          }))
        }
      />

      <EmailAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onAuthenticated={(session) => {
          setAuthSession(session);
          void handleClaimOrSyncCloud(session);
        }}
      />

      {/* 添加自定义模块 Dialog */}
      <Dialog open={addModuleDialogOpen} onOpenChange={setAddModuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">添加自定义模块</DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              可新增如「开源贡献」「发表论文」「专利软著」「志愿者经历」等任意模块。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddCustomSection();
              }
            }}
            placeholder="输入模块名称"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddModuleDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleAddCustomSection}>
              确认添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 在线只读分享 Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">在线只读分享</DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              开启后任何拥有链接的人均可只读查看本简历，可随时关闭链接使其立即失效。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">启用只读分享链接</span>
              <Switch
                checked={Boolean(doc.share_enabled)}
                onCheckedChange={(checked) => void handleToggleShare(checked)}
              />
            </div>
            {shareUrl ? (
              <div className="flex items-center gap-2">
                <Input readOnly value={shareUrl} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl);
                    setNotice("分享链接已复制到剪贴板。");
                  }}
                >
                  复制
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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
            <AlertDialogDescription>删除后该内容将从当前简历移除。</AlertDialogDescription>
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
