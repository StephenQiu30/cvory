"use client";
import * as React from "react";
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  returnFocusRef,
  className,
  titleClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={className}
        aria-describedby={description ? undefined : undefined}
        onCloseAutoFocus={(event) => {
          const trigger = returnFocusRef?.current;
          if (trigger?.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </DialogRoot>
  );
}
