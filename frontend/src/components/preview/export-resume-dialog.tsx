"use client";

import { PdfPaper } from "@/components/preview/pdf-paper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PdfFailure } from "@/lib/pdf/pdf-worker";
import { downloadResumePdf, type ResumePdf } from "@/lib/pdf/use-resume-pdf";
import { cn } from "@/lib/utils";

interface ExportResumeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReturnToForm: () => void;
  readonly onRetry: () => void;
  readonly restoreFocus: (event: Event) => void;
  readonly filename: string;
  readonly pdf: ResumePdf | null;
  readonly changed: boolean;
  readonly failure: PdfFailure | null;
}

export function ExportResumeDialog({
  open,
  onOpenChange,
  onReturnToForm,
  onRetry,
  restoreFocus,
  filename,
  pdf,
  changed,
  failure,
}: ExportResumeDialogProps) {
  const needsRetry = changed || failure !== null;
  const title = pdf
    ? "PDF 已生成"
    : changed
      ? "简历已更新"
      : failure
        ? "暂时无法生成 PDF"
        : "正在生成 PDF";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90dvh] overflow-y-auto rounded-md p-5 sm:p-6",
          pdf ? "sm:max-w-[650px]" : "sm:max-w-[460px]"
        )}
        onCloseAutoFocus={restoreFocus}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-[22px] leading-8 font-semibold">{title}</DialogTitle>
          {!needsRetry && (
            <DialogDescription role="status" className="text-[13px]">
              {pdf ? "纸面预览与下载使用同一份文件。" : "正在排版并嵌入字体。"}
            </DialogDescription>
          )}
        </DialogHeader>
        {needsRetry && (
          <div className="bg-muted space-y-1.5 rounded-md p-4" role="status">
            {failure && !changed && (
              <p className="text-destructive font-medium">
                {failure === "fonts" ? "字体还未加载完成" : "文件生成中断"}
              </p>
            )}
            <DialogDescription className="text-[13px]">
              {changed
                ? "请重新生成当前版本。"
                : failure === "fonts"
                  ? "正文已保留。重新加载字库后可重试。"
                  : "正文已保留。可以重新生成文件。"}
            </DialogDescription>
          </div>
        )}
        {pdf && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 font-medium break-all">{filename}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                A4 / {pdf.document.numPages} 页
              </span>
            </div>
            <PdfPaper
              pdf={pdf}
              className={cn(
                "bg-muted max-h-[50dvh] overflow-y-auto p-3",
                pdf.document.numPages > 1
                  ? "grid-cols-2"
                  : "[&>article]:mx-auto [&>article]:max-w-[280px]"
              )}
            />
          </>
        )}
        <div
          className={cn("flex items-center gap-2", needsRetry ? "justify-end" : "justify-between")}
        >
          <Button
            type="button"
            variant={needsRetry ? "secondary" : "link"}
            className={cn("h-11", !needsRetry && "px-0")}
            onClick={needsRetry ? onReturnToForm : () => onOpenChange(false)}
          >
            {needsRetry ? "返回填写" : "继续编辑"}
          </Button>
          {pdf ? (
            <Button type="button" className="h-11" onClick={() => downloadResumePdf(pdf, filename)}>
              下载 PDF
            </Button>
          ) : needsRetry ? (
            <Button type="button" className="h-11" onClick={onRetry}>
              {changed ? "重新生成" : "重试下载"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
