import { ArrowUpRight } from "lucide-react";
export function Footer() {
  return (
    <footer className="mt-auto shrink-0 bg-background">
      <div className="app-shell-container flex min-h-16 flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted-foreground">
        <span>简序 · CVory</span>
        <a
          className="inline-flex items-center gap-1"
          href="https://github.com/StephenQiu30/cvory"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
          <ArrowUpRight aria-hidden className="size-3" />
        </a>
      </div>
    </footer>
  );
}
