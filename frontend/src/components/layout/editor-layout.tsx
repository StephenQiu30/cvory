import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SkipToContent } from "@/components/layout/basic-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type EditorTab = "edit" | "preview";
export type EditorSettings = "template" | "style" | "all";

interface EditorLayoutProps {
  readonly title: string;
  readonly onTitleChange: (title: string) => void;
  readonly saveStatus: string;
  readonly saveFailed: boolean;
  readonly onSettings: (mode: EditorSettings, trigger: HTMLButtonElement) => void;
  readonly onDownload: (trigger: HTMLButtonElement) => void;
  readonly notice: ReactNode;
  readonly tab: EditorTab;
  readonly onTabChange: (tab: EditorTab) => void;
  readonly sectionNavigation: ReactNode;
  readonly form: ReactNode;
  readonly preview: ReactNode;
  readonly templateName: string;
  readonly previewStatus: string;
}

export function EditorLayout({
  title,
  onTitleChange,
  saveStatus,
  saveFailed,
  onSettings,
  onDownload,
  notice,
  tab,
  onTabChange,
  sectionNavigation,
  form,
  preview,
  templateName,
  previewStatus,
}: EditorLayoutProps) {
  const status = (
    <span
      role="status"
      className={cn(
        "text-xs leading-[19px]",
        saveFailed ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {saveStatus}
    </span>
  );

  return (
    <div className="bg-background text-foreground flex h-dvh min-h-0 flex-col overflow-hidden">
      <SkipToContent />
      <header className="border-border bg-background shrink-0 border-b">
        <nav
          aria-label="文档操作"
          className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-2 px-4 min-[1200px]:h-16 min-[1200px]:gap-3 min-[1200px]:px-6"
        >
          <Button asChild variant="ghost" className="h-11 shrink-0 px-2.5">
            <Link href="/resumes" aria-label="返回我的简历">
              <ArrowLeft data-icon="inline-start" />
              <span className="hidden min-[1200px]:inline">我的简历</span>
            </Link>
          </Button>
          <h1 className="sr-only">编辑简历</h1>
          <Input
            aria-label="简历名称"
            value={title}
            onChange={(event) => onTitleChange(event.currentTarget.value)}
            className="hover:bg-muted h-11 min-w-0 flex-1 rounded-md border-0 px-2 text-[16px] font-medium shadow-none min-[1200px]:w-64 min-[1200px]:flex-none min-[1200px]:text-[15px]"
          />
          <div className="hidden min-[1200px]:flex min-[1200px]:flex-1">{status}</div>
          <div className="hidden shrink-0 items-center gap-2 min-[1200px]:flex">
            <Button
              type="button"
              variant="secondary"
              className="h-11"
              onClick={(event) => onSettings("template", event.currentTarget)}
            >
              换模板
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11"
              onClick={(event) => onSettings("style", event.currentTarget)}
            >
              排版
            </Button>
          </div>
          <Button
            type="button"
            className="h-11 shrink-0 px-3"
            onClick={(event) => onDownload(event.currentTarget)}
          >
            下载 PDF
          </Button>
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col outline-none"
      >
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === "edit" || value === "preview") onTabChange(value);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="flex shrink-0 flex-col gap-1 px-4 pt-2 pb-2 min-[1200px]:hidden">
            <div className="flex items-center justify-between gap-2">
              {status}
              <Button
                type="button"
                variant="link"
                className="h-11 shrink-0 px-0"
                onClick={(event) => onSettings("all", event.currentTarget)}
              >
                模板与排版
              </Button>
            </div>
            <TabsList aria-label="简历视图" className="!h-[50px] w-full rounded-md">
              <TabsTrigger value="edit" className="h-11">
                填写
              </TabsTrigger>
              <TabsTrigger value="preview" className="h-11">
                预览
              </TabsTrigger>
            </TabsList>
          </div>
          {notice}
          <div className="flex min-h-0 flex-1 flex-col min-[1200px]:grid min-[1200px]:grid-cols-[184px_minmax(420px,0.702fr)_minmax(420px,1fr)]">
            <aside
              aria-label="章节导航与排序"
              className="hidden min-h-0 overflow-y-auto px-4 py-6 min-[1200px]:block"
            >
              {sectionNavigation}
            </aside>
            <TabsContent
              forceMount
              value="edit"
              aria-label="简历填写区"
              className="min-h-0 min-w-0 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-8 data-[state=inactive]:hidden min-[1200px]:!block min-[1200px]:px-6 min-[1200px]:pt-6"
            >
              {form}
            </TabsContent>
            <TabsContent
              forceMount
              value="preview"
              aria-label="实时纸面预览"
              className="min-[1200px]:bg-muted min-h-0 min-w-0 overflow-y-auto overscroll-y-contain data-[state=inactive]:hidden min-[1200px]:!block"
            >
              <div className="bg-muted flex flex-col gap-3 px-4 pt-3 pb-3 min-[1200px]:px-7 min-[1200px]:pt-[18px]">
                <h2 className="hidden text-sm font-medium min-[1200px]:block">纸面预览</h2>
                <div className="[container-type:inline-size] mx-auto w-full max-w-[556px]">
                  {preview}
                </div>
                <footer className="border-border text-muted-foreground flex min-h-10 items-center justify-between gap-3 border-t text-xs">
                  <span>{templateName} · A4</span>
                  <span>{previewStatus}</span>
                </footer>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
