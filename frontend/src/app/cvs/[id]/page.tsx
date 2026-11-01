"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Upload,
  Settings,
  RefreshCw,
} from "lucide-react";
import { cvApi, ApiError } from "@/lib/api/client";
import { CVResource, Section, SectionItem, StyleSettings } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { PaperPreview } from "@/components/ui/paper-preview";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export default function CVEditorPage() {
  const params = useParams();
  const router = useRouter();
  const cvId = params.id as string;

  const [cv, setCv] = React.useState<CVResource | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Editable local state
  const [displayName, setDisplayName] = React.useState<string>("");
  const [profile, setProfile] = React.useState<CVResource["profile"]>({
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    avatarUrl: null,
  });
  const [sections, setSections] = React.useState<Section[]>([]);
  const [styleSettings, setStyleSettings] = React.useState<StyleSettings>({
    templateId: "standard",
    fontSize: 15,
    lineHeight: 1.5,
    margin: 24,
  });
  const [currentEtag, setCurrentEtag] = React.useState<string>("");

  // Save state
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved");
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string>("");

  // Conflict dialog
  const [conflictDialogOpen, setConflictDialogOpen] = React.useState<boolean>(false);

  // Settings modal
  const [settingsModalOpen, setSettingsModalOpen] = React.useState<boolean>(false);

  // Track initial content snapshot to compute dirty state
  const lastSavedJsonRef = React.useRef<string>("");

  // Load CV
  const loadCv = React.useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await cvApi.getCv(cvId);
      setCv(data);
      setDisplayName(data.displayName);
      setProfile(data.profile);
      setSections(data.sections || []);
      setStyleSettings(data.styleSettings || {
        templateId: "standard",
        fontSize: 15,
        lineHeight: 1.5,
        margin: 24,
      });
      setCurrentEtag(data.etag);

      const snapshot = JSON.stringify({
        displayName: data.displayName,
        profile: data.profile,
        sections: data.sections,
        styleSettings: data.styleSettings,
      });
      lastSavedJsonRef.current = snapshot;
      setSaveStatus("saved");
    } catch (err: any) {
      setLoadError(err?.message || "无法加载简历信息");
    } finally {
      setLoading(false);
    }
  }, [cvId]);

  React.useEffect(() => {
    loadCv();
  }, [loadCv]);

  // Compute dirty changes
  React.useEffect(() => {
    if (!lastSavedJsonRef.current) return;
    const currentSnapshot = JSON.stringify({
      displayName,
      profile,
      sections,
      styleSettings,
    });
    if (currentSnapshot !== lastSavedJsonRef.current) {
      if (saveStatus === "saved") {
        setSaveStatus("unsaved");
      }
    }
  }, [displayName, profile, sections, styleSettings, saveStatus]);

  // Warn before leaving if unsaved changes exist
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved" || saveStatus === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  // Perform Save
  const handleSave = async (forceOverwriteWithLatestEtag = false) => {
    if (!cv) return;

    try {
      setSaveStatus("saving");
      setSaveErrorMessage("");

      let etagToUse = currentEtag;
      if (forceOverwriteWithLatestEtag) {
        // Fetch fresh etag from server first
        const fresh = await cvApi.getCv(cvId);
        etagToUse = fresh.etag;
      }

      const updated = await cvApi.updateCv(
        cvId,
        {
          displayName: displayName.trim() || cv.displayName,
          profile,
          sections,
          styleSettings,
          etag: etagToUse,
        },
        etagToUse
      );

      // Update state with confirmed persisted data
      setCv(updated);
      setCurrentEtag(updated.etag);
      const snapshot = JSON.stringify({
        displayName: updated.displayName,
        profile: updated.profile,
        sections: updated.sections,
        styleSettings: updated.styleSettings,
      });
      lastSavedJsonRef.current = snapshot;
      setSaveStatus("saved");
      setConflictDialogOpen(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.isConcurrencyConflict) {
        setSaveStatus("error");
        setSaveErrorMessage("版本冲突：其他标签页或客户端已提交新修改。");
        setConflictDialogOpen(true);
      } else {
        setSaveStatus("error");
        setSaveErrorMessage(err.message || "保存失败，请检查网络后重试。");
      }
    }
  };

  // Section Reordering
  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setSections(copy);
  };

  // Section Visibility
  const toggleSectionVisibility = (index: number) => {
    const copy = [...sections];
    copy[index] = {
      ...copy[index],
      visible: !copy[index].visible,
    };
    setSections(copy);
  };

  // Add Item to a repeatable section
  const addItemToSection = (sectionIndex: number) => {
    const copy = [...sections];
    const sec = copy[sectionIndex];
    const newItem: SectionItem = {
      id: `item-${Date.now()}`,
      title: "新项目/经历",
      subtitle: "职位或说明",
      dateRange: "2024 - 至今",
      location: "",
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "请填写具体职责与成果..." }] }],
      },
      tags: [],
    };
    copy[sectionIndex] = {
      ...sec,
      items: [...(sec.items || []), newItem],
    };
    setSections(copy);
  };

  // Delete Item from a repeatable section
  const deleteItemFromSection = (sectionIndex: number, itemIndex: number) => {
    const copy = [...sections];
    const sec = copy[sectionIndex];
    const newItems = [...(sec.items || [])];
    newItems.splice(itemIndex, 1);
    copy[sectionIndex] = {
      ...sec,
      items: newItems,
    };
    setSections(copy);
  };

  // Add Custom Section
  const handleAddCustomSection = () => {
    const title = window.prompt("请输入新模块名称（例如：奖项荣誉、开源贡献、语言能力）：");
    if (!title?.trim()) return;

    const newSec: Section = {
      id: `sec-${Date.now()}`,
      type: "custom",
      title: title.trim(),
      visible: true,
      content: null,
      items: [
        {
          id: `item-${Date.now()}`,
          title: "项目或成就名称",
          subtitle: "角色或详细说明",
          dateRange: "",
          location: "",
          description: null,
          tags: [],
        },
      ],
    };
    setSections([...sections, newSec]);
  };

  // Avatar Upload
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const updated = await cvApi.uploadAvatar(cvId, file);
      setCv(updated);
      setProfile((prev) => ({ ...prev, avatarUrl: updated.profile.avatarUrl }));
      setCurrentEtag(updated.etag);
      setSaveStatus("saved");
    } catch (err: any) {
      alert(`头像上传失败: ${err.message}`);
    }
  };

  // Render CV state for PaperPreview
  const previewData: CVResource | null = cv
    ? {
        ...cv,
        displayName,
        profile,
        sections,
        styleSettings,
      }
    : null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          <p className="text-xs">正在载入简历...</p>
        </div>
      </div>
    );
  }

  if (loadError || !cv) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-base font-semibold text-foreground">加载失败</h2>
        <p className="mt-1 text-xs text-muted-foreground">{loadError || "简历不存在或已被删除"}</p>
        <Link href="/" className="mt-4">
          <Button variant="outline" size="sm">
            返回简历列表
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col">
      {/* Top Workspace Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="font-semibold text-sm text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-foreground focus:outline-none px-1 py-0.5 transition-colors"
                title="点击修改简历名称"
              />
            </div>
          </div>

          {/* Right: Save Status & Actions */}
          <div className="flex items-center gap-3">
            {/* Status Indicator conforming to AC-CV-07 */}
            <div className="flex items-center text-xs">
              {saveStatus === "saving" && (
                <span className="flex items-center text-muted-foreground gap-1.5 font-mono">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  保存中...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center text-muted-foreground gap-1.5 font-mono">
                  <Check className="h-3.5 w-3.5 text-foreground" />
                  已保存
                </span>
              )}
              {saveStatus === "unsaved" && (
                <span className="flex items-center text-muted-foreground gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-neutral-400" />
                  未保存
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center text-red-600 gap-1.5" title={saveErrorMessage}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  保存失败
                </span>
              )}
            </div>

            {/* Style Settings Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsModalOpen(true)}
              className="h-8 text-xs gap-1"
            >
              <Settings className="h-3.5 w-3.5" />
              排版样式
            </Button>

            {/* Save Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={saveStatus === "saving"}
              className="h-8 text-xs"
            >
              {saveStatus === "saving" ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Two-Column Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Form & Content Editors */}
        <div className="w-full lg:w-1/2 xl:w-7/12 p-6 overflow-y-auto space-y-6">
          {/* Basic Profile Card */}
          <div className="rounded-lg border border-border bg-background p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-border/70 mb-4">
              <h2 className="font-semibold text-sm text-foreground">基本信息与联系方式</h2>
              {/* Avatar Uploader */}
              <div className="flex items-center gap-2">
                {profile.avatarUrl ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar"
                      className="h-8 w-8 rounded-full border border-border object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setProfile((p) => ({ ...p, avatarUrl: null }))}
                      className="h-7 text-xs text-muted-foreground hover:text-red-600 px-2"
                    >
                      移除头像
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors">
                    <Upload className="h-3 w-3" />
                    <span>上传照片</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  姓名 *
                </label>
                <Input
                  value={profile.fullName}
                  onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="如：张三"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  一句话头衔 / 定位
                </label>
                <Input
                  value={profile.headline}
                  onChange={(e) => setProfile((p) => ({ ...p, headline: e.target.value }))}
                  placeholder="如：资深前端开发工程师"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  电子邮箱
                </label>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  placeholder="如：contact@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  电话号码
                </label>
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="如：+86 138 0000 0000"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  所在城市
                </label>
                <Input
                  value={profile.location}
                  onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                  placeholder="如：北京 / 上海"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  个人主页 / GitHub
                </label>
                <Input
                  value={profile.website}
                  onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                  placeholder="如：https://github.com/yourname"
                />
              </div>
            </div>
          </div>

          {/* Sections List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">简历模块管理</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddCustomSection}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                添加自定义模块
              </Button>
            </div>

            {sections.map((sec, secIdx) => (
              <div
                key={sec.id}
                className={`rounded-lg border bg-background transition-all ${
                  sec.visible ? "border-border shadow-2xs" : "border-dashed border-border/80 opacity-60 bg-muted/30"
                }`}
              >
                {/* Section Header Controls */}
                <div className="flex items-center justify-between p-4 border-b border-border/60 bg-surface-subtle/50">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[secIdx] = { ...copy[secIdx], title: e.target.value };
                        setSections(copy);
                      }}
                      className="font-semibold text-xs text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-foreground focus:outline-none px-1 py-0.5"
                    />
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      {sec.type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Move Up */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveSection(secIdx, "up")}
                      disabled={secIdx === 0}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="上移模块"
                      aria-label="上移"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>

                    {/* Move Down */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveSection(secIdx, "down")}
                      disabled={secIdx === sections.length - 1}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="下移模块"
                      aria-label="下移"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>

                    {/* Visibility Toggle */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSectionVisibility(secIdx)}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground ml-1"
                      title={sec.visible ? "隐藏此模块（保留内容）" : "显示此模块"}
                      aria-label="切换显示"
                    >
                      {sec.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Section Content Area */}
                <div className="p-4 space-y-4">
                  {/* Summary Type: Direct Rich Text Content */}
                  {sec.type === "summary" && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        简介正文（支持富文本排版）
                      </label>
                      <TiptapEditor
                        value={sec.content}
                        onChange={(val) => {
                          const copy = [...sections];
                          copy[secIdx] = { ...copy[secIdx], content: val };
                          setSections(copy);
                        }}
                      />
                    </div>
                  )}

                  {/* Repeatable Items (Experience, Education, Projects, Skills, Custom) */}
                  {sec.type !== "summary" && (
                    <div className="space-y-4">
                      {sec.items?.map((item, itemIdx) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-border/80 bg-surface-subtle p-3 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">
                              #{itemIdx + 1} 项
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteItemFromSection(secIdx, itemIdx)}
                              className="h-6 w-6 text-muted-foreground hover:text-red-600"
                              title="删除此项"
                              aria-label="删除"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                主标题（公司/学校/项目名）
                              </label>
                              <Input
                                value={item.title}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  const items = [...copy[secIdx].items];
                                  items[itemIdx] = { ...items[itemIdx], title: e.target.value };
                                  copy[secIdx] = { ...copy[secIdx], items };
                                  setSections(copy);
                                }}
                                placeholder="如：阿里巴巴 / 清华大学"
                                className="h-8 text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                副标题（职位/专业/角色）
                              </label>
                              <Input
                                value={item.subtitle}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  const items = [...copy[secIdx].items];
                                  items[itemIdx] = { ...items[itemIdx], subtitle: e.target.value };
                                  copy[secIdx] = { ...copy[secIdx], items };
                                  setSections(copy);
                                }}
                                placeholder="如：高级前端工程师 / 计算机专业"
                                className="h-8 text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                时间跨度
                              </label>
                              <Input
                                value={item.dateRange}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  const items = [...copy[secIdx].items];
                                  items[itemIdx] = { ...items[itemIdx], dateRange: e.target.value };
                                  copy[secIdx] = { ...copy[secIdx], items };
                                  setSections(copy);
                                }}
                                placeholder="如：2022.06 - 至今"
                                className="h-8 text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-muted-foreground mb-1">
                                城市或标签（逗号分隔）
                              </label>
                              <Input
                                value={item.tags?.join(", ") || ""}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  const items = [...copy[secIdx].items];
                                  const raw = e.target.value;
                                  const tags = raw
                                    .split(/[,，]/)
                                    .map((t) => t.trim())
                                    .filter(Boolean);
                                  items[itemIdx] = { ...items[itemIdx], tags };
                                  copy[secIdx] = { ...copy[secIdx], items };
                                  setSections(copy);
                                }}
                                placeholder="如：React, Next.js, TypeScript"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          {/* Item Description (Tiptap) */}
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">
                              详细职责与主要产出
                            </label>
                            <TiptapEditor
                              value={item.description}
                              onChange={(val) => {
                                const copy = [...sections];
                                const items = [...copy[secIdx].items];
                                items[itemIdx] = { ...items[itemIdx], description: val };
                                copy[secIdx] = { ...copy[secIdx], items };
                                setSections(copy);
                              }}
                            />
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addItemToSection(secIdx)}
                        className="w-full text-xs h-8 border-dashed"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        添加新项
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Real-Time Paper Preview */}
        <div className="w-full lg:w-1/2 xl:w-5/12 bg-neutral-100/70 p-6 flex justify-center overflow-y-auto border-t lg:border-t-0 lg:border-l border-border">
          {previewData && <PaperPreview cv={previewData} />}
        </div>
      </div>

      {/* Concurrency Conflict Dialog conforming to AC-CV-08 & Google AIP-154 */}
      <Dialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        title="发现版本保存冲突"
        description="此简历在其他页面或客户端已发生修改。如果直接保存，可能覆盖其他地方的修改。"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            为了避免数据丢失，您可以选择重新拉取远程最新版本，或者使用当前编辑内容覆盖保存。
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await loadCv();
                setConflictDialogOpen(false);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              放弃本地修改，拉取远程最新
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => handleSave(true)}
            >
              强制保存并覆盖
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Style Settings Dialog */}
      <Dialog
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        title="排版与样式预设"
        description="调整纸张排版密度与文字参数，修改将实时反映在右侧预览中。"
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              排版模式
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={styleSettings.templateId === "standard" ? "primary" : "outline"}
                size="sm"
                onClick={() => setStyleSettings((s) => ({ ...s, templateId: "standard" }))}
                className="text-xs"
              >
                标准排版（留白宽松）
              </Button>
              <Button
                type="button"
                variant={styleSettings.templateId === "compact" ? "primary" : "outline"}
                size="sm"
                onClick={() => setStyleSettings((s) => ({ ...s, templateId: "compact" }))}
                className="text-xs"
              >
                紧凑排版（信息优先）
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              正文字号: {styleSettings.fontSize}px
            </label>
            <input
              type="range"
              min={13}
              max={17}
              step={1}
              value={styleSettings.fontSize}
              onChange={(e) =>
                setStyleSettings((s) => ({ ...s, fontSize: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              行高比例: {styleSettings.lineHeight}
            </label>
            <input
              type="range"
              min={1.3}
              max={1.8}
              step={0.1}
              value={styleSettings.lineHeight}
              onChange={(e) =>
                setStyleSettings((s) => ({ ...s, lineHeight: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setSettingsModalOpen(false)}
            >
              完成
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
