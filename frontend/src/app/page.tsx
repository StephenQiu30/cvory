"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, FileText, Upload, Trash2, ArrowRight, Clock, AlertCircle } from "lucide-react";
import { cvApi } from "@/lib/api/client";
import { CVResource } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function HomePage() {
  const [cvs, setCvs] = React.useState<CVResource[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create CV dialog state
  const [createDialogOpen, setCreateDialogOpen] = React.useState<boolean>(false);
  const [newTitle, setNewTitle] = React.useState<string>("");
  const [creating, setCreating] = React.useState<boolean>(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<CVResource | null>(null);
  const [deleting, setDeleting] = React.useState<boolean>(false);

  // Fetch list
  const loadCvs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await cvApi.listCvs();
      setCvs(res.cvs || []);
    } catch (err: any) {
      setError(err?.message || "无法加载简历列表，请确认后端服务已启动。");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCvs();
  }, [loadCvs]);

  const handleCreateCv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreating(true);
      const created = await cvApi.createCv({
        displayName: newTitle.trim(),
      });
      setCreateDialogOpen(false);
      setNewTitle("");
      window.location.href = `/cvs/${created.id}`;
    } catch (err: any) {
      alert(`创建失败: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCv = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await cvApi.deleteCv(deleteTarget.id, deleteTarget.etag);
      setDeleteTarget(null);
      await loadCvs();
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-foreground flex items-center justify-center text-background font-bold text-sm tracking-tighter">
              C/V
            </div>
            <div>
              <span className="font-semibold text-foreground tracking-tight text-base">
                简序 · CVory
              </span>
              <span className="ml-2 text-xs text-muted-foreground font-mono">
                MVP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => alert("简历导入功能（PLAN-CV-04）待下个阶段支持。")}
              className="text-muted-foreground"
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              导入简历
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewTitle("我的个人简历");
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              新建 CV
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadCvs} className="ml-auto text-xs h-7">
              重试
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-6 w-6 border-2 border-foreground border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">正在加载简历列表...</p>
          </div>
        ) : cvs.length === 0 ? (
          /* Empty State conforming to AC-CV-01 */
          <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-12 text-center max-w-xl mx-auto my-12">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-foreground mb-4">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">暂无简历文档</h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
              简序采用纯粹、克制的黑白排版设计。无需收藏模板或付费，直接新建一份简历，开始整理您的专业经历与技能。
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  setNewTitle("我的个人简历");
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                新建第一份 CV
              </Button>
              <Button
                variant="outline"
                onClick={() => alert("简历导入功能（PLAN-CV-04）待下个阶段支持。")}
                className="text-muted-foreground"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                导入已有简历
              </Button>
            </div>
          </div>
        ) : (
          /* CV Grid */
          <div>
            <div className="mb-6 flex items-baseline justify-between">
              <h1 className="text-xl font-bold tracking-tight text-foreground">我的 CV</h1>
              <span className="text-xs text-muted-foreground">共 {cvs.length} 份简历</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cvs.map((cv) => (
                <Card
                  key={cv.id}
                  className="group hover:border-foreground/40 transition-all flex flex-col justify-between"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base truncate group-hover:text-primary">
                        {cv.displayName}
                      </CardTitle>
                      <Badge variant="outline" className="text-[11px] shrink-0 font-normal">
                        {cv.styleSettings?.templateId === "compact" ? "紧凑排版" : "标准排版"}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-1 text-[11px]">
                      <Clock className="h-3 w-3" />
                      更新于 {formatDate(cv.updateTime)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <div className="truncate">
                      {cv.profile.fullName ? (
                        <span>姓名：{cv.profile.fullName}</span>
                      ) : (
                        <span className="italic text-muted-foreground/60">未填写姓名</span>
                      )}
                    </div>
                    {cv.profile.headline && (
                      <div className="truncate text-foreground/80">{cv.profile.headline}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground/70">
                      包含 {cv.sections?.filter((s) => s.visible !== false).length || 0} 个可见模块
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-border/60 pt-4 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(cv)}
                      className="text-muted-foreground hover:text-red-600 h-8 px-2"
                      aria-label="删除简历"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    <Link href={`/cvs/${cv.id}`}>
                      <Button variant="secondary" size="sm" className="h-8">
                        <span>编辑内容</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="新建个人 CV"
        description="为这份简历设定一个容易辨识的名称（例如：前端工程简历、全栈海外版）。"
      >
        <form onSubmit={handleCreateCv} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              简历名称
            </label>
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：我的前端开发简历"
              disabled={creating}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={creating || !newTitle.trim()}
            >
              {creating ? "创建中..." : "确认创建"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除简历"
        description={`确定要删除「${deleteTarget?.displayName}」吗？此操作无法撤销。`}
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDeleteCv}
            disabled={deleting}
          >
            {deleting ? "删除中..." : "确认删除"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
