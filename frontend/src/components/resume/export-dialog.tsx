"use client";
import { useState, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { StatusMessage } from "@/components/ui/status-message";
import { download, markdown, hasContent } from "@/lib/resume/files";
import { cvApi, ApiError } from "@/lib/api/client";
import { exportCvPdf } from "@/lib/api/generated/api/files";
import type { CVResource } from "@/lib/api/types";
export function ExportDialog({
  open,
  onOpenChange,
  cv,
  dirty,
  save,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cv: CVResource;
  dirty: boolean;
  save: () => Promise<boolean>;
}) {
  const [format, setFormat] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  function close() {
    operation.current?.abort();
    setBusy(false);
    onOpenChange(false);
  }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(v);
      }}
      title="导出简历"
      description="先保存，再从已保存内容生成文件。生成期间的编辑不会混入本次文件。"
    >
      <FieldGroup>
        <fieldset className="space-y-3">
          <legend className="sr-only">文件格式</legend>
          {[
            ["pdf", "PDF · 用于投递", "可选文字、多页 A4，保留当前样式。"],
            [
              "json",
              "JSON · 完整备份",
              "包含内容、样式、可见性与照片，不包含账户或公开状态。",
            ],
            [
              "md",
              "Markdown · 正文交换",
              "保留正文语义，不保留照片、精确模板或分页。",
            ],
          ].map(([value, title, description]) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-md bg-surface-subtle p-3"
            >
              <input
                type="radio"
                name="format"
                value={value}
                checked={format === value}
                onChange={() => {
                  setFormat(value);
                  setMessage("");
                  setError("");
                }}
              />
              <span className="text-sm">
                {title}
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {dirty ? (
          <p className="text-xs text-muted-foreground">
            有未保存修改，将先保存。
          </p>
        ) : null}
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {busy ? "取消生成" : "返回编辑"}
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              const controller = new AbortController();
              operation.current = controller;
              setBusy(true);
              setError("");
              setMessage("");
              try {
                if (dirty && !(await save()))
                  throw Error("保存未成功，请返回编辑处理后重试。");
                if (controller.signal.aborted) return;
                const saved = await cvApi.getCv(cv.id);
                if (controller.signal.aborted) return;
                if (format !== "json" && !hasContent(saved))
                  throw Error("请先填写姓名和至少一段内容。");
                let blob: Blob;
                if (format === "pdf") {
                  blob = (await exportCvPdf(
                    { cv_id: saved.id, etag: saved.etag },
                    {
                      responseType: "blob",
                      timeout: 120000,
                      signal: controller.signal,
                    },
                  )) as unknown as Blob;
                } else if (format === "json") {
                  if (
                    saved.profile.avatarUrl &&
                    !saved.profile.avatarUrl.startsWith("data:")
                  ) {
                    const response = await fetch(saved.profile.avatarUrl);
                    if (!response.ok) throw Error("照片读取失败，请重试。");
                    const image = await response.blob();
                    saved.profile.avatarUrl = await new Promise<string>(
                      (resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = reject;
                        reader.readAsDataURL(image);
                      },
                    );
                  }
                  blob = new Blob(
                    [
                      JSON.stringify(
                        {
                          format: "cvory",
                          version: 1,
                          document: {
                            displayName: saved.displayName,
                            profile: saved.profile,
                            sections: saved.sections,
                            styleSettings: saved.styleSettings,
                          },
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  );
                } else
                  blob = new Blob([markdown(saved)], {
                    type: "text/markdown;charset=utf-8",
                  });
                if (controller.signal.aborted) return;
                download(
                  blob,
                  `${saved.displayName.replace(/[\\/:*?"<>|]/g, "-")}.${format}`,
                );
                setMessage("文件已生成，已发起下载。");
              } catch (e) {
                if (!controller.signal.aborted)
                  setError(
                    e instanceof ApiError
                      ? e.code === 401
                        ? "登录已过期，请登录后重试。"
                        : e.code === 409
                          ? "简历已有更新，请返回编辑重新保存后导出。"
                          : "暂时无法生成文件，请重试或选择 JSON 备份。"
                      : e instanceof Error
                        ? e.message
                        : "生成失败，请重试。",
                  );
              } finally {
                if (operation.current === controller) setBusy(false);
              }
            }}
          >
            {busy ? "生成中" : "生成并下载"}
          </Button>
        </div>
      </FieldGroup>
    </Dialog>
  );
}
