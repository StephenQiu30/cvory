import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 text-xs font-normal transition-colors focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        outline: "bg-control text-foreground",
        secondary: "bg-surface-subtle text-muted-foreground",
        destructive: "bg-destructive text-white",
        ghost: "hover:bg-muted",
        link: "text-foreground underline-offset-4 hover:underline",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
export { Badge, badgeVariants };
