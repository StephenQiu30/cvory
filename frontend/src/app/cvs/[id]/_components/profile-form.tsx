"use client";
import NextImage from "next/image";
import { useState } from "react";
import { Eye, EyeOff, Plus, ImageOff } from "lucide-react";
import type { Profile } from "@/lib/api/types";
import { FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/account/image-picker";
import { Dialog } from "@/components/shared/app-dialog";
const CONTACTS = [
  ["email", "邮箱"],
  ["phone", "电话"],
  ["location", "所在城市"],
  ["website", "个人网站"],
  ["github", "GitHub"],
  ["wechat", "微信号（可选）"],
] as const;
export function ProfileForm({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const [more, setMore] = useState(false);
  const [remove, setRemove] = useState(false);
  const update = (key: keyof Profile, value: unknown) =>
    onChange({ ...profile, [key]: value });
  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend className="text-sm">个人信息</FieldLegend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="fullName"
            label="姓名"
            value={profile.fullName}
            onChange={(v) => update("fullName", v)}
          />
          <FormField
            id="headline"
            label="求职职位"
            value={profile.headline}
            onChange={(v) => update("headline", v)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {profile.avatarUrl ? (
            <div className="relative h-24 w-[72px] overflow-hidden bg-muted">
              <NextImage
                unoptimized
                width={72}
                height={96}
                src={profile.avatarUrl}
                alt="当前简历证件照"
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${profile.photoX ?? 50}% ${profile.photoY ?? 50}%`,
                  transform: `scale(${profile.photoScale ?? 1})`,
                }}
              />
            </div>
          ) : (
            <div className="flex h-24 w-[72px] items-center justify-center bg-surface-subtle">
              <ImageOff
                aria-label="尚未选择证件照"
                className="size-5 text-muted-foreground"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs">简历照片</p>
            <p className="mt-1 text-xs text-muted-foreground">
              3:4 证件照，独立于账户头像
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ImagePicker
                portrait
                crop={{
                  x: profile.photoX,
                  y: profile.photoY,
                  scale: profile.photoScale,
                }}
                value={profile.avatarUrl}
                onApply={(url, pos) =>
                  onChange({
                    ...profile,
                    avatarUrl: url,
                    photoX: pos?.x ?? profile.photoX,
                    photoY: pos?.y ?? profile.photoY,
                    photoScale: pos?.scale ?? profile.photoScale,
                  })
                }
              />
              {profile.avatarUrl ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => update("photoHidden", !profile.photoHidden)}
                  >
                    {profile.photoHidden ? "显示照片" : "隐藏照片"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update(
                        "photoPosition",
                        profile.photoPosition === "left" ? "right" : "left",
                      )
                    }
                  >
                    {profile.photoPosition === "left" ? "放到右侧" : "放到左侧"}
                  </Button>
                  <Button variant="ghost" onClick={() => setRemove(true)}>
                    移除
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </FieldSet>
      <FieldSet>
        <FieldLegend className="text-sm">联系方式</FieldLegend>
        <div className="grid gap-5 sm:grid-cols-2">
          {CONTACTS.map(([key, label]) => (
            <div key={key} className="relative">
              <FormField
                id={key}
                label={label}
                value={profile[key]}
                onChange={(v) => update(key, v)}
                error={
                  key === "email" &&
                  profile.email &&
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
                    ? "请输入有效邮箱，如 chen@example.com"
                    : undefined
                }
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute -top-2 right-0"
                aria-label={`${profile.hiddenFields?.includes(key) ? "显示" : "隐藏"}${label}`}
                aria-pressed={!profile.hiddenFields?.includes(key)}
                onClick={() =>
                  update(
                    "hiddenFields",
                    profile.hiddenFields?.includes(key)
                      ? profile.hiddenFields.filter((k) => k !== key)
                      : [...(profile.hiddenFields ?? []), key],
                  )
                }
              >
                {profile.hiddenFields?.includes(key) ? (
                  <EyeOff aria-hidden className="size-3.5" />
                ) : (
                  <Eye aria-hidden className="size-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          眼睛图标控制是否在简历中展示，隐藏会保留填写内容。
        </p>
      </FieldSet>
      <FieldSet>
        <FieldLegend className="text-sm">求职意向</FieldLegend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="jobStatus"
            label="当前状态（可选）"
            value={profile.jobStatus}
            onChange={(v) => update("jobStatus", v)}
          />
          <FormField
            id="expectedLocation"
            label="期望工作地（可选）"
            value={profile.expectedLocation}
            onChange={(v) => update("expectedLocation", v)}
          />
        </div>
        <Button
          variant="ghost"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className="justify-start"
        >
          <Plus aria-hidden className="size-4" />
          更多展示字段
        </Button>
        {more ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="experienceYears"
              label="工作年限"
              value={profile.experienceYears}
              onChange={(v) => update("experienceYears", v)}
            />
            <FormField
              id="expectedSalary"
              label="期望薪资"
              value={profile.expectedSalary}
              onChange={(v) => update("expectedSalary", v)}
            />
          </div>
        ) : null}
      </FieldSet>
      <Dialog
        open={remove}
        onOpenChange={setRemove}
        title="移除此份简历的照片？"
        description="照片将从当前简历移除，账户头像保持不变。"
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemove(false)}>
            保留照片
          </Button>
          <Button
            onClick={() => {
              update("avatarUrl", null);
              setRemove(false);
            }}
          >
            移除照片
          </Button>
        </div>
      </Dialog>
    </FieldGroup>
  );
}
