"use client";
import { useDeferredValue, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Save,
  Download,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  UserRound,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { cvApi } from "@/lib/api/client";
import type { CVResource, SectionItem, Section } from "@/lib/api/types";
import { MODULES, editable, textContent, dateLabel } from "@/lib/resume/model";
import { EditorLayout } from "@/components/layout/editor-layout";
import { PaperPreview } from "@/components/ui/paper-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { StatusMessage } from "@/components/ui/status-message";
import { ProfileForm } from "./profile-form";
import { EntryForm } from "./entry-form";
import { ModuleManager } from "./module-manager";
import { StylePanel } from "./style-panel";
import { ExportDialog } from "@/components/resume/export-dialog";
import { useAccount } from "@/components/account/account-provider";
import { useCvDocument } from "./use-cv-document";
const RichEditor = dynamic(
  () => import("@/components/ui/tiptap-editor").then((m) => m.TiptapEditor),
  { ssr: false },
);
export default function CvEditor({ id }: { id: string }) {
  const router = useRouter();
  const { openAuth } = useAccount();
  const [active, setActive] = useState("profile");
  const [collapsed, setCollapsed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [fullSize, setFullSize] = useState(false);
  const [modal, setModal] = useState<
    "manage" | "entry" | "remove" | "conflict" | "leave" | "export" | null
  >(null);
  const [entry, setEntry] = useState<SectionItem | undefined>();
  const [style, setStyle] = useState<CVResource["styleSettings"] | null>(null);
  const [folded, setFolded] = useState<string[]>([]);
  const formRef = useRef<HTMLElement>(null);
  const { draft, busy, error, setError, loadError, dirty, patch, load, save } =
    useCvDocument(id, () => setModal("conflict"));
  const deferred = useDeferredValue(draft);
  const section = draft?.sections.find((s) => s.id === active);
  const updateSection = (next: Section) =>
    patch({
      sections: draft!.sections.map((s) => (s.id === next.id ? next : s)),
    });
  const choose = (id: string) => {
    setStyle(null);
    setActive(id);
    setPreview(false);
    formRef.current?.focus();
  };
  if (!draft)
    return (
      <div className="app-shell-container py-16">
        {loadError ? (
          <>
            <StatusMessage>{loadError}</StatusMessage>
            <div className="mt-5 flex gap-3">
              <Button onClick={() => void load()}>重试</Button>
              <Button variant="ghost" onClick={() => openAuth(() => void load())}>登录</Button>
              <Button variant="ghost" onClick={() => router.push("/")}>
                返回简历库
              </Button>
            </div>
          </>
        ) : (
          <p role="status">正在读取简历…</p>
        )}
      </div>
    );
  const moveItem = (index: number, delta: number) => {
    if (!section) return;
    const items = [...(section.items ?? [])];
    const item = items.splice(index, 1)[0];
    items.splice(index + delta, 0, item);
    updateSection({ ...section, items });
  };
  return (
    <>
      <EditorLayout
        collapsed={collapsed}
        showPreview={preview}
        header={
          <header className="flex min-h-16 flex-wrap items-center gap-2 px-5 py-2 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              aria-label="返回我的简历"
              onClick={() => (dirty ? setModal("leave") : router.push("/"))}
            >
              <ArrowLeft aria-hidden className="size-4" />
            </Button>
            <Input
              aria-label="简历名称"
              className="max-w-44 font-medium sm:max-w-60"
              value={draft.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
            />
            <span
              role="status"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              {busy ? (
                "保存中"
              ) : dirty ? (
                "未保存"
              ) : (
                <>
                  <Check aria-hidden className="size-3" />
                  已保存
                </>
              )}
            </span>
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                aria-label="调整样式"
                onClick={() =>
                  setStyle((current) => current ?? { ...draft.styleSettings })
                }
              >
                <Palette aria-hidden className="size-4" />
                <span className="hidden sm:inline">样式</span>
              </Button>
              <Button
                variant="secondary"
                aria-label="导出简历"
                onClick={() => {
                  if (style) {
                    setError("请先应用或取消当前样式。");
                    return;
                  }
                  setModal("export");
                }}
              >
                <Download aria-hidden className="size-4" />
                <span className="hidden sm:inline">导出</span>
              </Button>
              <Button
                disabled={busy || !!style}
                title={style ? "请先应用或取消样式" : undefined}
                onClick={() => void save()}
              >
                <Save aria-hidden className="size-4" />
                保存
              </Button>
            </div>
          </header>
        }
        navbar={
          <nav
            aria-label="简历模块"
            className="flex flex-wrap gap-1 lg:flex-col"
          >
            <div className="mb-3 hidden items-center justify-between lg:flex">
              {!collapsed ? (
                <h2 className="text-sm font-medium">简历内容</h2>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                aria-label={collapsed ? "展开模块栏" : "收起模块栏"}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden className="size-4" />
                ) : (
                  <PanelLeftClose aria-hidden className="size-4" />
                )}
              </Button>
            </div>
            {[
              { id: "profile", type: "profile", title: "基本信息" },
              ...draft.sections,
            ].map((s) => {
              const Icon =
                MODULES.find((m) => m.type === s.type)?.icon ?? UserRound;
              return (
                <Button
                  key={s.id}
                  variant={active === s.id ? "secondary" : "ghost"}
                  aria-current={active === s.id ? "page" : undefined}
                  aria-label={s.title}
                  className={`justify-start px-3 ${collapsed ? "lg:px-2" : ""}`}
                  onClick={() => choose(s.id)}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className={collapsed ? "lg:hidden" : "truncate"}>
                    {s.title}
                  </span>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              onClick={() => setModal("manage")}
              aria-label="管理模块"
              className="justify-start px-3"
            >
              <Settings2 aria-hidden className="size-4" />
              <span className={collapsed ? "lg:hidden" : ""}>管理模块</span>
            </Button>
          </nav>
        }
        form={
          <section
            ref={formRef}
            tabIndex={-1}
            className="min-w-0 focus:outline-none"
          >
            <h1 className="text-xl font-medium">
              {style
                ? "简历样式"
                : active === "profile"
                  ? "基本信息"
                  : section?.title}
            </h1>
            <p className="mb-7 mt-2 text-xs leading-5 text-muted-foreground">
              {style
                ? "调整后应用样式，再保存到当前简历。取消会恢复原有样式。"
                : active === "profile"
                  ? "填写你希望出现在简历上的信息。"
                  : "经历按当前顺序展示。新增内容确认后进入简历。"}
            </p>
            {error ? (
              <div className="mb-5">
                <StatusMessage>{error}</StatusMessage>
                {error.includes("登录") ? (
                  <Button variant="ghost" className="mt-2" onClick={() => openAuth(() => setError(""))}>重新登录</Button>
                ) : null}
              </div>
            ) : null}
            {style ? (
              <StylePanel
                value={style}
                onChange={setStyle}
                onCancel={() => setStyle(null)}
                onApply={() => {
                  patch({ styleSettings: style });
                  setStyle(null);
                  setError("");
                }}
              />
            ) : active === "profile" ? (
              <ProfileForm
                profile={draft.profile}
                onChange={(profile) => patch({ profile })}
              />
            ) : section ? (
              <>
                {section.visible === false ? (
                  <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <EyeOff aria-hidden className="size-4" />
                    此模块已隐藏，填写内容仍会保存。
                  </p>
                ) : null}
                {section.type === "summary" ? (
                  <RichEditor
                    value={section.content}
                    onChange={(content) =>
                      updateSection({ ...section, content })
                    }
                  />
                ) : (
                  <>
                    {section.content != null ? (
                      <div className="mb-5">
                        <RichEditor
                          value={section.content}
                          onChange={(content) =>
                            updateSection({ ...section, content })
                          }
                        />
                      </div>
                    ) : null}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEntry(undefined);
                        setModal("entry");
                      }}
                    >
                      <Plus aria-hidden className="size-4" />
                      添加{section.title}
                    </Button>
                    <div className="mt-5 space-y-7">
                      {section.items?.length ? (
                        section.items.map((item, index) => (
                          <div key={item.id}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h2 className="text-sm font-medium">
                                  {item.title || "未命名条目"}
                                </h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {[
                                    item.subtitle,
                                    dateLabel(item, section.type),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`上移${item.title}`}
                                  disabled={index === 0}
                                  onClick={() => moveItem(index, -1)}
                                >
                                  <ChevronUp aria-hidden className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`下移${item.title}`}
                                  disabled={
                                    index === (section.items?.length ?? 0) - 1
                                  }
                                  onClick={() => moveItem(index, 1)}
                                >
                                  <ChevronDown aria-hidden className="size-4" />
                                </Button>
                              </div>
                            </div>
                            {!folded.includes(item.id) ? (
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary-foreground">
                                {textContent(item.description)}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setEntry(item);
                                  setModal("entry");
                                }}
                              >
                                编辑此段
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setFolded(
                                    folded.includes(item.id)
                                      ? folded.filter((v) => v !== item.id)
                                      : [...folded, item.id],
                                  )
                                }
                              >
                                {folded.includes(item.id)
                                  ? "展开此段"
                                  : "收起此段"}
                              </Button>
                              <Button
                                variant="ghost"
                                aria-label={`移除${item.title}`}
                                onClick={() => {
                                  setEntry(item);
                                  setModal("remove");
                                }}
                              >
                                <Trash2 aria-hidden className="size-3.5" />
                                移除
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="py-8 text-sm text-muted-foreground">
                          还没有内容，添加一段真实的经历。
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : null}
          </section>
        }
        preview={
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium">简历预览</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFullSize(!fullSize)}
              >
                {fullSize ? "适合页面" : "100%"}
              </Button>
            </div>
            <div className="overflow-auto pb-4">
              <PaperPreview
                cv={{
                  ...(deferred ?? draft),
                  styleSettings: style ?? (deferred ?? draft).styleSettings,
                }}
                onSection={choose}
                fullSize={fullSize}
                onPageCount={setPageCount}
              />
            </div>
            <p className="flex justify-between text-xs text-muted-foreground">
              <span>A4 · 210 × 297 mm</span>
              <span>共 {pageCount} 页</span>
            </p>
            {!draft.profile.fullName &&
            !draft.sections.some(
              (s) => textContent(s.content) || s.items?.length,
            ) ? (
              <p className="mt-4 text-xs text-muted-foreground">
                从填写基本信息开始，空字段不会进入导出。
              </p>
            ) : null}
          </>
        }
      />
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center gap-3 bg-background px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <Button
          variant={!preview ? "primary" : "secondary"}
          className="flex-1"
          onClick={() => setPreview(false)}
        >
          填写信息
        </Button>
        <Button
          variant={preview ? "primary" : "secondary"}
          className="flex-1"
          onClick={() => setPreview(true)}
        >
          <Eye aria-hidden className="size-4" />
          预览简历
        </Button>
      </div>
      <Dialog
        open={modal === "manage"}
        onOpenChange={(v) => !v && setModal(null)}
        title="管理简历模块"
        description="控制显示与顺序，隐藏不会删除内容。"
      >
        <ModuleManager
          sections={draft.sections}
          onChange={(sections) => patch({ sections })}
        />
      </Dialog>
      <Dialog
        open={modal === "entry"}
        onOpenChange={(v) => !v && setModal(null)}
        title={section?.title ?? "编辑经历"}
        description="填写具体信息，应用后同步到预览。"
      >
        {modal === "entry" && section ? (
          <EntryForm
            key={entry?.id ?? "new"}
            type={section.type}
            initial={entry}
            onCancel={() => setModal(null)}
            onApply={(item) => {
              updateSection({
                ...section,
                items: entry
                  ? (section.items ?? []).map((i) =>
                      i.id === entry.id ? item : i,
                    )
                  : [...(section.items ?? []), item],
              });
              setModal(null);
            }}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={modal === "remove"}
        onOpenChange={(v) => !v && setModal(null)}
        title={`移除「${entry?.title || "此段经历"}」？`}
        description="移除后不会出现在当前简历，保存前可重新载入服务器版本。"
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(null)}>
            保留
          </Button>
          <Button
            onClick={() => {
              if (section)
                updateSection({
                  ...section,
                  items: section.items?.filter((i) => i.id !== entry?.id),
                });
              setModal(null);
            }}
          >
            移除经历
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={modal === "conflict"}
        onOpenChange={(v) => !v && setModal(null)}
        title="简历有新的服务器版本"
        description="本地输入会保留。加载服务器版本会替换本地未保存内容。"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(null)}>
            继续编辑
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const created = await cvApi.createCv({
                  ...editable(draft),
                  displayName: `${draft.displayName} · 副本`,
                });
                router.push(`/cvs/${created.id}`);
              } catch {
                setError("另存失败，本地内容仍保留。");
              }
            }}
          >
            另存副本
          </Button>
          <Button
            onClick={() => {
              void Promise.resolve().then(load);
              setModal(null);
            }}
          >
            加载服务器版本
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={modal === "leave"}
        onOpenChange={(v) => !v && setModal(null)}
        title="还有未保存的内容"
        description="可以先保存再返回，或留在这里继续编辑。"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(null)}>
            继续编辑
          </Button>
          <Button variant="secondary" onClick={() => router.push("/")}>
            放弃修改并离开
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (await save()) router.push("/");
            }}
          >
            保存并返回
          </Button>
        </div>
      </Dialog>
      <ExportDialog
        open={modal === "export"}
        onOpenChange={(v) => !v && setModal(null)}
        cv={draft}
        dirty={dirty}
        save={save}
      />
    </>
  );
}
