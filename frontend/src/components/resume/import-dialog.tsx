"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { StatusMessage } from "@/components/ui/status-message";
import type { CreateCVRequest } from "@/lib/api/types";
import {
  MAX_IMPORT_BYTES,
  parseBackup,
  parseMarkdown,
} from "@/lib/resume/files";
import { cvApi } from "@/lib/api/client";
import { textContent } from "@/lib/resume/model";
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [candidate, setCandidate] = useState<CreateCVRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const requestId = useRef("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          onOpenChange(v);
          if (!v) {
            setCandidate(null);
            setError("");
          }
        }
      }}
      title={candidate ? "校对导入内容" : "导入简历"}
      description="支持 CVory v1 JSON 备份与 Markdown，单文件不超过 10 MB。确认后另存，不覆盖已有简历。"
    >
      <FieldGroup>
        {!candidate ? (
          <input
            type="file"
            aria-label="选择简历文件"
            accept=".json,.md,.markdown"
            className="min-h-11 text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                if (file.size > MAX_IMPORT_BYTES)
                  throw Error("文件超过 10 MB，请选择较小的文件。");
                const text = await file.text();
                requestId.current = crypto.randomUUID();
                if (file.name.endsWith(".json"))
                  setCandidate(parseBackup(text));
                else if (/\.(md|markdown)$/i.test(file.name))
                  setCandidate(parseMarkdown(text));
                else
                  throw Error(
                    "暂不支持 PDF、Word 或图片，请使用 JSON／Markdown。",
                  );
              } catch (e) {
                setError(e instanceof Error ? e.message : "读取失败，请重试。");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <>
            <FormField
              id="import-title"
              label="简历名称"
              value={candidate.displayName}
              onChange={(v) => setCandidate({ ...candidate, displayName: v })}
            />
            <FormField
              id="import-name"
              label="姓名"
              value={candidate.profile?.fullName}
              onChange={(v) =>
                setCandidate({
                  ...candidate,
                  profile: { ...candidate.profile, fullName: v },
                })
              }
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Markdown
              段落保留在对应模块，不自动猜测学校、公司或日期。可在此校对文字，新建后继续结构化编辑。
            </p>
            {candidate.sections?.map((s, index) => (
              <FormField
                id={`import-section-${index}`}
                key={s.id}
                label={s.title}
              >
                <Textarea
                  id={`import-section-${index}`}
                  value={
                    textContent(s.content) ||
                    s.items
                      ?.map((i) =>
                        [i.title, i.subtitle, textContent(i.description)]
                          .filter(Boolean)
                          .join("\n"),
                      )
                      .join("\n\n") ||
                    ""
                  }
                  onChange={(e) =>
                    setCandidate({
                      ...candidate,
                      sections: candidate.sections?.map((v, i) =>
                        i === index
                          ? { ...v, content: e.target.value, items: [] }
                          : v,
                      ),
                    })
                  }
                />
              </FormField>
            ))}
          </>
        )}
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              setCandidate(null);
            }}
            disabled={busy}
          >
            取消
          </Button>
          {candidate ? (
            <Button
              disabled={busy || !candidate.displayName.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const created = await cvApi.createCv({
                    ...candidate,
                    requestId: requestId.current,
                  });
                  onOpenChange(false);
                  router.push(`/cvs/${created.id}`);
                } catch {
                  setError("另存失败，候选已保留，请检查格式或登录后重试。");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "另存中" : "确认并新建"}
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </Dialog>
  );
}
