import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "secondary";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-muted text-foreground border-transparent",
    outline: "border border-border text-foreground",
    secondary: "bg-surface-subtle text-muted-foreground border border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-normal border transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
