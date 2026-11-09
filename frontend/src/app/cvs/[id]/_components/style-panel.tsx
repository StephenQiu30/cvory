"use client";
import { errorMessage } from "@/lib/api/error-message";
import { useEffect, useState } from "react";
import { Trash2, Check, Pencil } from "lucide-react";
import { Dialog } from "@/components/shared/app-dialog";
import type { StyleSettings } from "@/lib/api/types";
import { TEMPLATES, ACCENTS, DEFAULT_STYLE } from "@/lib/resume/model";
import {
  listPresets,
  savePreset,
  deletePreset,
} from "@/lib/api/generated/api/presets";
import { FormField } from "@/components/ui/form-field";
import { Slider } from "@/components/ui/slider";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
export function StylePanel({
  value,
  onChange,
  onApply,
  onCancel,
}: {
  value: StyleSettings;
  onChange: (s: StyleSettings) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const [presets, setPresets] = useState<API.StylePreset[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState<API.StylePreset | null>(null);
  const [remove, setRemove] = useState<API.StylePreset | null>(null);
  useEffect(() => {
    void listPresets()
      .then(setPresets)
      .catch((cause) =>
        setError(errorMessage(cause, "无法读取个人样式，请重试。")),
      );
  }, []);
  return (
    <FieldGroup>
      <div className="grid gap-2">
        {TEMPLATES.map((t) => (
          <Button
            key={t.id}
            variant={value.templateId === t.id ? "secondary" : "ghost"}
            className="h-auto justify-between py-3 text-left"
            onClick={() => onChange({ ...value, templateId: t.id })}
          >
            <span>
              <span className="block">{t.title}</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {t.detail}
              </span>
            </span>
            {value.templateId === t.id ? (
              <Check aria-hidden className="size-4" />
            ) : null}
          </Button>
        ))}
      </div>
      <FormField id="accent" label="强调色">
        <div className="flex gap-2">
          {Object.entries(ACCENTS).map(([key, color]) => (
            <Button
              key={key}
              variant="ghost"
              aria-pressed={value.accent === key}
              aria-label={{ ink: "墨黑", blue: "深蓝", graphite: "石墨" }[key]}
              onClick={() =>
                onChange({ ...value, accent: key as StyleSettings["accent"] })
              }
            >
              <span
                className="size-4 rounded-full"
                style={{ background: color }}
              />
              {value.accent === key ? (
                <Check aria-hidden className="size-3" />
              ) : null}
            </Button>
          ))}
        </div>
      </FormField>
      {[
        ["fontSize", "正文字号（px）", 12, 20, 1],
        ["lineHeight", "行距", 1.2, 2, 0.05],
        ["margin", "四边留白（pt）", 12, 48, 1],
      ].map(([key, label, min, max, step]) => (
        <FormField
          key={String(key)}
          id={String(key)}
          label={`${label} · ${value[key as keyof StyleSettings]}`}
        >
          <Slider
            id={String(key)}
            aria-label={String(label)}
            min={Number(min)}
            max={Number(max)}
            step={Number(step)}
            value={[Number(value[key as keyof StyleSettings])]}
            onValueChange={([current]) =>
              onChange({ ...value, [key]: current })
            }
          />
        </FormField>
      ))}
      <Button variant="ghost" onClick={() => onChange({ ...DEFAULT_STYLE })}>
        恢复默认样式
      </Button>
      <FormField
        id="preset-name"
        label="保存为个人样式"
        value={name}
        onChange={setName}
      />
      <Button
        variant="secondary"
        disabled={!name.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const p = await savePreset({
              id: "",
              displayName: name.trim(),
              settings: value,
            });
            setPresets([...presets, p]);
            setName("");
          } catch (cause) {
            setError(errorMessage(cause, "样式保存失败，请重试。"));
          } finally {
            setBusy(false);
          }
        }}
      >
        保存样式
      </Button>
      {presets.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="min-w-0 flex-1 justify-start"
            onClick={() => onChange({ ...p.settings })}
          >
            {p.displayName}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`改名样式${p.displayName}`}
            onClick={() => {
              setError("");
              setRename({ ...p });
            }}
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`删除样式${p.displayName}`}
            onClick={() => {
              setError("");
              setRemove(p);
            }}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      ))}
      {busy && !rename && !remove ? (
        <StatusMessage loading>正在更新个人样式…</StatusMessage>
      ) : null}
      {error && !rename && !remove ? (
        <StatusMessage>{error}</StatusMessage>
      ) : null}
      <Dialog
        open={!!rename}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setRename(null);
            setError("");
          }
        }}
        title="修改样式名称"
        description="名称变更不修改已经应用此样式的简历。"
      >
        {busy ? <StatusMessage loading>正在修改样式名称…</StatusMessage> : null}
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <FormField
          id="rename-preset"
          label="样式名称"
          value={rename?.displayName ?? ""}
          onChange={(v) => setRename((r) => (r ? { ...r, displayName: v } : r))}
        />
        <Button
          className="mt-5"
          disabled={busy || !rename?.displayName.trim()}
          onClick={async () => {
            if (!rename) return;
            setBusy(true);
            setError("");
            try {
              const updated = await savePreset(rename);
              setPresets(
                presets.map((p) => (p.id === updated.id ? updated : p)),
              );
              setRename(null);
            } catch (cause) {
              setError(errorMessage(cause, "改名失败，名称已保留，请重试。"));
            } finally {
              setBusy(false);
            }
          }}
        >
          保存名称
        </Button>
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setRemove(null);
            setError("");
          }
        }}
        title="删除个人样式？"
        description="只删除预设，不改变已有简历的样式。"
      >
        {busy ? <StatusMessage loading>正在删除样式…</StatusMessage> : null}
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setRemove(null);
              setError("");
            }}
          >
            保留
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!remove) return;
              setBusy(true);
              setError("");
              try {
                await deletePreset({ preset_id: remove.id });
                setPresets(presets.filter((p) => p.id !== remove.id));
                setRemove(null);
              } catch (cause) {
                setError(errorMessage(cause, "删除失败，请重试。"));
              } finally {
                setBusy(false);
              }
            }}
          >
            删除样式
          </Button>
        </div>
      </Dialog>
      <div className="sticky bottom-0 flex justify-end gap-2 bg-background py-3">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={onApply}>应用样式</Button>
      </div>
    </FieldGroup>
  );
}
