"use client";
import { useState } from "react";
import { ArrowUp, ArrowDown, Plus } from "lucide-react";
import type { Section } from "@/lib/api/types";
import { MODULES } from "@/lib/resume/model";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/shared/app-dialog";
import { FormField } from "@/components/ui/form-field";
import { FieldGroup } from "@/components/ui/field";
export function ModuleManager({
  sections,
  onChange,
}: {
  sections: Section[];
  onChange: (s: Section[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const move = (index: number, delta: number) => {
    const next = [...sections];
    const item = next.splice(index, 1)[0];
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  return (
    <FieldGroup>
      {sections.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <Input
            aria-label={`${s.title}模块名称`}
            value={s.title}
            onChange={(e) =>
              onChange(
                sections.map((v) =>
                  v.id === s.id ? { ...v, title: e.target.value } : v,
                ),
              )
            }
          />
          <Switch
            aria-label={`展示${s.title}`}
            checked={s.visible !== false}
            onCheckedChange={(visible) =>
              onChange(
                sections.map((v) => (v.id === s.id ? { ...v, visible } : v)),
              )
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`上移${s.title}`}
            disabled={i === 0}
            onClick={() => move(i, -1)}
          >
            <ArrowUp aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`下移${s.title}`}
            disabled={i === sections.length - 1}
            onClick={() => move(i, 1)}
          >
            <ArrowDown aria-hidden className="size-4" />
          </Button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        隐藏会保留内容，顺序同步应用到预览。
      </p>
      {MODULES.filter(
        (m) => m.type !== "custom" && !sections.some((s) => s.type === m.type),
      ).map((m) => (
        <Button
          key={m.type}
          variant="secondary"
          onClick={() =>
            onChange([
              ...sections,
              {
                id: crypto.randomUUID(),
                type: m.type,
                title: m.title,
                visible: true,
                content: null,
                items: [],
              },
            ])
          }
        >
          <Plus aria-hidden className="size-4" />
          添加{m.title}
        </Button>
      ))}
      <Button variant="secondary" onClick={() => setAdding(true)}>
        <Plus aria-hidden className="size-4" />
        添加自定义模块
      </Button>
      <Dialog
        open={adding}
        onOpenChange={setAdding}
        title="添加自定义模块"
        description="例如荣誉奖项、研究经历或作品集。"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onChange([
              ...sections,
              {
                id: crypto.randomUUID(),
                type: "custom",
                title: title.trim(),
                visible: true,
                items: [],
                content: null,
              },
            ]);
            setAdding(false);
            setTitle("");
          }}
        >
          <FormField
            id="module-title"
            label="模块名称"
            value={title}
            onChange={setTitle}
            required
          />
          <Button className="mt-5" type="submit">
            添加模块
          </Button>
        </form>
      </Dialog>
    </FieldGroup>
  );
}
