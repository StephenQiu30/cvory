"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useForm, Controller, useWatch } from "react-hook-form";
import type { SectionItem } from "@/lib/api/types";
import { blankItem, safeLink, textContent } from "@/lib/resume/model";
import { FormField } from "@/components/ui/form-field";
import { FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusMessage } from "@/components/ui/status-message";
const RichEditor = dynamic(
  () => import("@/components/ui/tiptap-editor").then((m) => m.TiptapEditor),
  {
    ssr: false,
    loading: () => <StatusMessage loading>正在加载编辑器…</StatusMessage>,
  },
);
const LABELS: Record<
  string,
  { title: string; subtitle: string; body: string }
> = {
  education: { title: "学校", subtitle: "专业", body: "在校经历（可选）" },
  experience: { title: "公司", subtitle: "岗位", body: "职责与成果" },
  project: { title: "项目名称", subtitle: "项目角色", body: "项目内容与成果" },
  skill: { title: "技能分组名称（可选）", subtitle: "", body: "技能描述" },
  custom: { title: "名称", subtitle: "说明", body: "详细内容" },
};
export function EntryForm({
  type,
  initial,
  onApply,
  onCancel,
}: {
  type: string;
  initial?: SectionItem;
  onApply: (item: SectionItem) => void;
  onCancel: () => void;
}) {
  const labels = LABELS[type] ?? LABELS.custom;
  const [defaults] = useState(() => initial ?? blankItem());
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SectionItem>({ defaultValues: defaults });
  const current = useWatch({ control, name: "current" });
  const start = useWatch({ control, name: "startDate" });
  return (
    <form noValidate onSubmit={handleSubmit(onApply)}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend className="text-sm">
            {initial ? "编辑条目" : "新增条目"}
          </FieldLegend>
          <FormField
            id="entry-title"
            label={labels.title}
            error={errors.title?.message}
          >
            <Input
              id="entry-title"
              className="h-11 rounded-md border-0 bg-control px-3 text-sm"
              {...register("title", {
                validate: (v) =>
                  type === "skill" || !!v?.trim() || `请填写${labels.title}`,
              })}
            />
          </FormField>
          {type !== "skill" ? (
            <>
              <FormField
                id="entry-subtitle"
                label={labels.subtitle}
                error={errors.subtitle?.message}
              >
                <Input
                  id="entry-subtitle"
                  className="h-11 rounded-md border-0 bg-control px-3 text-sm"
                  {...register("subtitle", {
                    validate: (v) =>
                      type === "custom" ||
                      !!v?.trim() ||
                      `请填写${labels.subtitle}`,
                  })}
                />
              </FormField>
              {type === "education" ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    id="entry-degree"
                    label="学历"
                    error={errors.degree?.message}
                  >
                    <Input
                      id="entry-degree"
                      className="h-11 rounded-md border-0 bg-control px-3 text-sm"
                      {...register("degree", { required: "请填写学历" })}
                    />
                  </FormField>
                  <FormField id="entry-kind" label="学历类型（可选）">
                    <Input
                      id="entry-kind"
                      className="h-11 rounded-md border-0 bg-control px-3 text-sm"
                      {...register("educationType")}
                    />
                  </FormField>
                </div>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  id="entry-start"
                  label="开始月份"
                  error={errors.startDate?.message}
                >
                  <Input
                    id="entry-start"
                    type="month"
                    className="h-11 min-w-0 rounded-md border-0 bg-control px-3 text-sm"
                    {...register("startDate", { required: "请选择开始月份" })}
                  />
                </FormField>
                <FormField
                  id="entry-end"
                  label="结束月份"
                  error={errors.endDate?.message}
                >
                  <Input
                    id="entry-end"
                    type="month"
                    min={start || undefined}
                    disabled={current}
                    className="h-11 min-w-0 rounded-md border-0 bg-control px-3 text-sm disabled:opacity-40"
                    {...register("endDate", {
                      validate: (v) =>
                        current ||
                        (!!v && (!start || v >= start)) ||
                        "结束月份不能早于开始月份",
                    })}
                  />
                </FormField>
              </div>
              <Controller
                control={control}
                name="current"
                render={({ field }) => (
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <Switch
                      checked={!!field.value}
                      onCheckedChange={(v) => {
                        field.onChange(v);
                        setValue("dateRange", "");
                      }}
                    />
                    {type === "education" ? "目前在读" : "进行中／至今"}
                  </label>
                )}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                {type === "experience" || type === "education" ? (
                  <FormField
                    id="entry-department"
                    label={
                      type === "education" ? "学院（可选）" : "部门（可选）"
                    }
                  >
                    <Input
                      id="entry-department"
                      className="h-11 rounded-md border-0 bg-control px-3 text-sm"
                      {...register("department")}
                    />
                  </FormField>
                ) : null}
                <FormField id="entry-location" label="城市（可选）">
                  <Input
                    id="entry-location"
                    className="h-11 rounded-md border-0 bg-control px-3 text-sm"
                    {...register("location")}
                  />
                </FormField>
              </div>
              {type === "project" ? (
                <FormField
                  id="entry-link"
                  label="项目链接（可选）"
                  error={errors.link?.message}
                >
                  <Input
                    id="entry-link"
                    className="h-11 rounded-md border-0 bg-control px-3 text-sm"
                    {...register("link", {
                      validate: (v) =>
                        !v || !!safeLink(v) || "请输入有效的 https:// 链接",
                    })}
                  />
                </FormField>
              ) : null}
            </>
          ) : null}
          <FormField
            id="entry-body"
            label={labels.body}
            error={
              typeof errors.description?.message === "string"
                ? errors.description.message
                : undefined
            }
          >
            <Controller
              control={control}
              name="description"
              rules={{
                validate: (v) =>
                  type === "education" ||
                  !!textContent(v).trim() ||
                  "请填写内容与成果",
              }}
              render={({ field }) => (
                <RichEditor value={field.value} onChange={field.onChange} />
              )}
            />
          </FormField>
        </FieldSet>
        <div className="sticky bottom-0 flex justify-end gap-2 bg-background py-3">
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">{initial ? "应用修改" : "添加到简历"}</Button>
        </div>
      </FieldGroup>
    </form>
  );
}
