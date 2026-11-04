"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  titleClassName?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  returnFocusRef,
  className,
  titleClassName,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={description ? undefined : undefined}
          onCloseAutoFocus={(event) => {
            const trigger = returnFocusRef?.current;
            if (trigger?.isConnected) {
              event.preventDefault();
              trigger.focus();
            }
          }}
          className={cn("fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-md border-0 bg-popover p-7 text-foreground shadow-none outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className)}
        >
          <div className="flex items-start justify-between gap-4 pb-4">
            <div>
              <DialogPrimitive.Title className={cn("text-base font-semibold tracking-tight", titleClassName)}>
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭对话框"
                className="-mr-2 -mt-2 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="pt-1">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
