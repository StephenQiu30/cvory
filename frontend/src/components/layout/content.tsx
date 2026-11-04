import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function Content({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-shell-container py-8 sm:py-10", className)}>
      {children}
    </div>
  );
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[30px] font-medium leading-tight">{title}</h1>
        {description ? (
          <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
