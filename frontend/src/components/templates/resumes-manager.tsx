"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, MoreHorizontal, Pencil, Plus, Trash2, Upload } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocalResumeDocument } from "@/lib/contract/contract";
import {
  deleteLocalDraft,
  duplicateLocalDraft,
  exportDraftToJson,
  getLocalDraftsServerSnapshot,
  getLocalDraftsSnapshot,
  importDraftFromJson,
  renameLocalDraft,
  subscribeLocalDrafts,
} from "@/lib/storage/local-drafts";
import { getTemplatePreset } from "@/lib/templates/presets";

function formatUpdatedAt(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ResumesManager() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drafts = useSyncExternalStore(
    subscribeLocalDrafts,
    getLocalDraftsSnapshot,
    getLocalDraftsServerSnapshot
  );
  const [renameTarget, setRenameTarget] = useState<LocalResumeDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LocalResumeDocument | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleRenameSubmit = () => {
    if (!renameTarget) {
      return;
    }
    renameLocalDraft(renameTarget.id, renameValue);
    setRenameTarget(null);
  };

  const handleDuplicate = (draft: LocalResumeDocument) => {
    const copied = duplicateLocalDraft(draft.id);
    if (copied) {
      router.push(`/resume/${copied.id}`);
    }
  };

  const handleExportJson = (draft: LocalResumeDocument) => {
    const blob = new Blob([exportDraftToJson(draft)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title || "cvory-resume"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const imported = importDraftFromJson(text);
      router.push(`/resume/${imported.id}`);
    } catch {
      setImportError("导入失败：仅支持简序现行版本（v1）的结构化 JSON 备份文件。");
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return;
    }
    deleteLocalDraft(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-950">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-base font-semibold tracking-tight text-neutral-950">
            简序
          </Link>
          <span className="text-xs text-neutral-400">/</span>
          <h1 className="text-sm font-medium text-neutral-700">我的简历</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleImportJsonFile(file);
                e.target.value = "";
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 text-[13px]"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            导入 JSON
          </Button>
          <Button asChild size="sm" className="h-9 bg-neutral-950 text-[13px] text-white">
            <Link href="/">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              选模板新建
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-4 pb-16 sm:px-6">
        {importError ? (
          <div role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {importError}
          </div>
        ) : null}

        {drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-neutral-900">当前设备还没有简历草稿</p>
            <p className="mt-1.5 text-xs text-neutral-500">
              先挑选一款免费极简纸样，或导入已有 JSON 备份继续编辑。
            </p>
            <Button asChild className="mt-6 h-10 bg-neutral-950 px-5 text-[13px] text-white">
              <Link href="/">挑选免费模板</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 pb-2 text-xs text-neutral-500">
              <span>简历列表（按最近编辑倒序）</span>
              <span>共 {drafts.length} 份</span>
            </div>
            <ul className="divide-y divide-neutral-100 rounded-md bg-white">
              {drafts.map((draft) => {
                const preset = getTemplatePreset(draft.template_id);
                return (
                  <li
                    key={draft.id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-neutral-50/80"
                  >
                    <Link
                      href={`/resume/${draft.id}`}
                      className="min-w-0 flex-1 space-y-1 focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-neutral-950">
                          {draft.title}
                        </span>
                        <Badge
                          variant="secondary"
                          className="h-5 rounded px-1.5 text-[11px] font-normal text-neutral-600"
                        >
                          {preset.name}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="h-5 rounded border-neutral-200 px-1.5 text-[11px] font-normal text-neutral-500"
                        >
                          {draft.remote_id ? `云端 v${draft.version}` : "本机草稿"}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-400">
                        最近编辑：{formatUpdatedAt(draft.updated_at)}
                      </p>
                    </Link>

                    <div className="flex items-center gap-1.5">
                      <Button asChild variant="ghost" size="sm" className="h-9 text-[13px]">
                        <Link href={`/resume/${draft.id}`}>打开</Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`更多操作：${draft.title}`}
                            className="h-9 w-9"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget(draft);
                              setRenameValue(draft.title);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(draft)}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            复制为新岗位稿
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportJson(draft)}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            导出 JSON 备份
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(draft)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            删除草稿
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">重命名简历</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="resume-rename-input" className="text-xs text-neutral-600">
              按投递岗位命名，方便切换多份简历
            </Label>
            <Input
              id="resume-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSubmit();
                }
              }}
              placeholder="例如：AI 应用开发工程师 · 上海"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button type="button" onClick={handleRenameSubmit}>
              保存名称
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除「{deleteTarget?.title}」？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该草稿将从当前设备移除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
