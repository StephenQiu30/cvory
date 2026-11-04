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
    default: "bg-muted text-foreground",
    outline: "bg-control text-foreground",
    secondary: "bg-surface-subtle text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-normal transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
