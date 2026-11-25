import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const routes = [
  { href: "/", label: "模板库" },
  { href: "/resumes", label: "我的简历" },
] as const;

type BrowseRoute = (typeof routes)[number]["href"];

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="bg-background text-link focus-visible:outline-ring sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus-visible:outline-2"
    >
      跳到主要内容
    </a>
  );
}

export function BasicLayout({
  currentPage,
  children,
}: {
  readonly currentPage: BrowseRoute;
  readonly children: ReactNode;
}) {
  return (
    <div className="bg-canvas text-foreground flex min-h-dvh flex-col">
      <SkipToContent />
      <header id="page-top" tabIndex={-1} className="bg-background border-border border-b">
        <nav
          aria-label="主导航"
          className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-4 px-4 md:h-16 md:gap-8 md:px-6"
        >
          <Link
            href="/"
            aria-label="简序，返回模板库"
            className="focus-visible:outline-ring inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm text-base font-bold focus-visible:outline-2"
          >
            <span className="grid size-[22px] place-items-center">
              <Image src="/brand/cvory-mark.svg" alt="" width={19} height={19} unoptimized />
            </span>
            简序
          </Link>
          <ul className="flex min-w-0 items-center gap-1 sm:gap-2">
            {routes.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={currentPage === href ? "page" : undefined}
                  className={cn(
                    "hover:text-foreground focus-visible:outline-ring inline-flex h-11 items-center border-b-2 px-2 text-[13px] leading-5 font-medium whitespace-nowrap focus-visible:outline-2 md:px-3",
                    currentPage === href
                      ? "border-foreground text-foreground"
                      : "text-muted-foreground border-transparent"
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-6 outline-none md:gap-8 md:px-6 md:py-10"
      >
        {children}
      </main>

      <footer className="bg-background border-border border-t">
        <div className="text-muted-foreground mx-auto flex min-h-[52px] w-full max-w-[1200px] items-center justify-between gap-3 px-4 text-xs md:min-h-14 md:px-6">
          <span>简序 CVory</span>
          <Button asChild variant="ghost" className="min-h-11">
            <a href="#page-top">
              <ChevronUp data-icon="inline-start" />
              返回顶部
            </a>
          </Button>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between md:gap-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-xl leading-[30px] font-bold md:text-2xl md:leading-[34px]">{title}</h1>
        <p className="text-muted-foreground text-sm leading-[23px]">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
