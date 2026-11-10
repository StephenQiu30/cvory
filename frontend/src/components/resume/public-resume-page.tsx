import Link from "next/link";
import { Globe } from "lucide-react";
import { getPublicResume } from "@/lib/api/generated/api/publication";
import { ApiError } from "@/lib/api/request";
import { sectionAnchorId, visibleSections } from "@/lib/resume/model";
import { ResumeDocument } from "@/components/resume/resume-document";
import { StatusPage } from "@/components/shared/status-page";

export async function PublicResumePage({ publicId }: { publicId: string }) {
  let document: API.ResumeDocument | null = null;
  try {
    document = await getPublicResume(
      { publicId },
      { baseURL: process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:4321" },
    );
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 404) throw error;
  }

  if (!document) {
    return (
      <StatusPage
        title="这份简历暂未公开"
        description="内容尚未发布，或已由本人撤回。"
        icon={Globe}
      />
    );
  }

  const sections = visibleSections(document.sections);
  const projects = document.projects ?? [];

  return (
    <main className="min-h-dvh bg-background px-5 pb-16 text-foreground sm:px-8">
      <a
        href="#resume-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-background px-4 py-3 text-sm font-medium shadow focus:not-sr-only"
      >
        跳到简历内容
      </a>
      <div className="mx-auto max-w-6xl">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            简序{" "}
            <span className="font-normal text-muted-foreground">CVory</span>
          </Link>
          <Link
            href="/workspace"
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-secondary-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            进入工作台
          </Link>
        </header>

        <div className="grid gap-8 py-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-12 lg:py-12">
          <aside className="min-w-0 lg:sticky lg:top-8 lg:h-fit">
            <nav aria-label="简历目录" className="min-w-0">
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                简历目录
              </h2>
              <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
                <li className="shrink-0">
                  <a
                    href="#resume-profile"
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-secondary-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full"
                  >
                    个人简介
                  </a>
                </li>
                {sections.map((section) => (
                  <li key={section.id} className="shrink-0">
                    <a
                      href={`#${sectionAnchorId(section.id)}`}
                      className="inline-flex min-h-11 max-w-64 items-center rounded-md px-3 text-sm text-secondary-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full"
                    >
                      <span className="truncate">{section.title}</span>
                    </a>
                  </li>
                ))}
                {projects.length ? (
                  <li className="shrink-0">
                    <a
                      href="#resume-projects"
                      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-secondary-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full"
                    >
                      精选项目
                    </a>
                  </li>
                ) : null}
              </ul>
            </nav>
          </aside>

          <div
            id="resume-content"
            tabIndex={-1}
            className="min-w-0 rounded-md bg-surface px-5 py-7 sm:px-9 sm:py-10"
          >
            <ResumeDocument web document={document} />
          </div>
        </div>
        <footer className="border-t border-border py-5 text-xs text-muted-foreground">
          由简序 CVory 提供个人简历展示
        </footer>
      </div>
    </main>
  );
}
