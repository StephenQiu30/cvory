"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { BasicLayout, PageHeader } from "@/components/layout/basic-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { LocalDraftIndexEntry } from "@/lib/contract/contract";
import { getTemplatePreset } from "@/lib/templates/presets";
import {
  deleteLocalDraft,
  duplicateLocalDraft,
  getLocalDraftsServerSnapshot,
  getLocalDraftsSnapshot,
  renameLocalDraft,
  subscribeLocalDrafts,
} from "@/lib/yjs/local-store";

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
  const drafts = useSyncExternalStore(
    subscribeLocalDrafts,
    () => getLocalDraftsSnapshot(),
    getLocalDraftsServerSnapshot
  );
  const [renameTarget, setRenameTarget] = useState<LocalDraftIndexEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LocalDraftIndexEntry | null>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const createDraftLink = useRef<HTMLAnchorElement>(null);

  const restoreActionFocus = (event: Event) => {
    const target = dialogTrigger.current?.isConnected
      ? dialogTrigger.current
      : createDraftLink.current;
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  const handleRenameSubmit = () => {
    if (!renameTarget) {
      return;
    }
    renameLocalDraft(renameTarget.id, renameValue);
    setRenameTarget(null);
  };

  const handleDuplicate = async (draft: LocalDraftIndexEntry) => {
    const copied = await duplicateLocalDraft(draft.id);
    if (copied) {
      router.push(`/resume/${copied.id}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    await deleteLocalDraft(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <BasicLayout currentPage="/resumes">
      <PageHeader
        title="我的简历"
        description="在此设备上继续填写、复制或管理不同岗位的草稿。"
        action={
          <Button asChild className="h-11 px-4">
            <Link href="/" ref={createDraftLink}>
              新建简历
            </Link>
          </Button>
        }
      />
      <section
        aria-labelledby="local-drafts-title"
        className="bg-background flex flex-col gap-3 rounded-md p-4"
      >
        <h2 id="local-drafts-title" className="text-[17px] font-semibold">
          本机草稿
        </h2>
        {drafts.length === 0 ? (
          <div className="flex flex-col items-start gap-1 py-3">
            <p className="text-sm font-medium">当前设备还没有简历草稿</p>
            <p className="text-muted-foreground text-[13px]">选一款免费模板即可开始。</p>
          </div>
        ) : (
          <ul className="divide-border bg-background divide-y rounded-md">
            {drafts.map((draft) => {
              const preset = getTemplatePreset(draft.templateId);
              return (
                <li
                  key={draft.id}
                  className="hover:bg-canvas flex items-center justify-between gap-2 px-2 py-2.5 transition-colors sm:gap-4 sm:px-3"
                >
                  <Link
                    href={`/resume/${draft.id}`}
                    className="focus-visible:outline-ring min-w-0 flex-1 space-y-1 focus-visible:outline-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground truncate text-sm font-medium">
                        {draft.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground h-5 rounded px-1.5 text-[11px] font-normal"
                      >
                        {preset.name}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-border text-muted-foreground h-5 rounded px-1.5 text-[11px] font-normal"
                      >
                        本机草稿
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      最近编辑：{formatUpdatedAt(draft.updatedAt)}
                    </p>
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <Button asChild variant="ghost" size="sm" className="h-11 text-[13px]">
                      <Link href={`/resume/${draft.id}`}>打开</Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          id={`resume-actions-${draft.id}`}
                          aria-label={`更多操作：${draft.title}`}
                          className="size-11"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => {
                            dialogTrigger.current = document.getElementById(
                              `resume-actions-${draft.id}`
                            );
                            setRenameTarget(draft);
                            setRenameValue(draft.title);
                          }}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleDuplicate(draft)}>
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          复制为新岗位稿
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            dialogTrigger.current = document.getElementById(
                              `resume-actions-${draft.id}`
                            );
                            setDeleteTarget(draft);
                          }}
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
        )}
      </section>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={restoreActionFocus}>
          <DialogHeader>
            <DialogTitle className="text-base">重命名简历</DialogTitle>
            <DialogDescription>按投递岗位命名，方便区分多份简历。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="resume-rename-input" className="text-muted-foreground text-xs">
              简历名称
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
              placeholder="例如：前端工程师 · 2026 社招"
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
        <AlertDialogContent onCloseAutoFocus={restoreActionFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除「{deleteTarget?.title}」？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该本机草稿将从当前设备移除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BasicLayout>
  );
}
