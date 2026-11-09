"use client";
import NextImage from "next/image";
import { useRef, useState } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { Dialog } from "@/components/shared/app-dialog";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
export function ImagePicker({
  value,
  onApply,
  portrait = false,
  crop,
}: {
  value: string | null | undefined;
  onApply: (
    url: string | null,
    position?: { x: number; y: number; scale: number },
  ) => void;
  portrait?: boolean;
  crop?: { x?: number; y?: number; scale?: number };
}) {
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [scale, setScale] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setCandidate(value ?? null);
          setX(crop?.x ?? 50);
          setY(crop?.y ?? 50);
          setScale(crop?.scale ?? 1);
          setLoading(false);
          setError("");
          setOpen(true);
        }}
      >
        <Upload aria-hidden className="size-4" />
        {value ? "更换／调整照片" : "选择照片"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          request.current++;
          setLoading(false);
          setOpen(v);
        }}
        title={portrait ? "简历证件照" : "账户头像"}
        description={
          portrait
            ? "3:4 证件照，独立于账户头像。选择后预览并确认。"
            : "只改变账户头像，不修改简历中的照片。"
        }
      >
        <FieldGroup>
          <div
            className={`relative mx-auto overflow-hidden bg-surface-subtle ${portrait ? "h-56 w-42" : "size-40 rounded-full"}`}
          >
            {candidate ? (
              <NextImage
                unoptimized
                width={168}
                height={224}
                src={candidate}
                alt="待应用的照片预览"
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${x}% ${y}%`,
                  transform: `scale(${scale})`,
                }}
              />
            ) : (
              <span className="flex h-full items-center justify-center">
                <ImagePlus aria-hidden className="size-7" />
              </span>
            )}
          </div>
          <Input
            ref={input}
            type="file"
            className="sr-only"
            aria-label="选择图片文件"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const version = ++request.current;
              setLoading(false);
              if (
                !["image/png", "image/jpeg", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 2_097_152
              ) {
                setError("请选择 2 MB 以内的 JPG、PNG 或 WebP 图片。");
                return;
              }
              setLoading(true);
              setError("");
              try {
                const data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });
                const image = new Image();
                image.src = data;
                await image.decode();
                if (version === request.current) {
                  setCandidate(data);
                  setX(50);
                  setY(50);
                  setScale(1);
                }
              } catch {
                if (version === request.current)
                  setError("无法读取图片，请重选。原照片已保留。");
              } finally {
                if (version === request.current) setLoading(false);
              }
            }}
          />
          <Button
            variant="secondary"
            onClick={() => input.current?.click()}
            disabled={loading}
          >
            {loading ? "读取中" : "选择图片"}
          </Button>
          {portrait && candidate ? (
            <>
              <FormField id="photo-x" label="水平位置">
                <Slider
                  id="photo-x"
                  aria-label="水平位置"
                  min={0}
                  max={100}
                  value={[x]}
                  onValueChange={([value]) => setX(value)}
                />
              </FormField>
              <FormField id="photo-y" label="垂直位置">
                <Slider
                  id="photo-y"
                  aria-label="垂直位置"
                  min={0}
                  max={100}
                  value={[y]}
                  onValueChange={([value]) => setY(value)}
                />
              </FormField>
              <FormField id="photo-zoom" label="缩放">
                <Slider
                  id="photo-zoom"
                  aria-label="缩放"
                  min={1}
                  max={3}
                  step={0.05}
                  value={[scale]}
                  onValueChange={([value]) => setScale(value)}
                />
              </FormField>
            </>
          ) : null}
          {loading ? (
            <StatusMessage loading>正在读取图片…</StatusMessage>
          ) : null}
          {error ? <StatusMessage>{error}</StatusMessage> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                request.current++;
                setLoading(false);
                setOpen(false);
              }}
            >
              取消
            </Button>
            <Button
              disabled={loading || !candidate}
              onClick={() => {
                onApply(candidate, { x, y, scale });
                setOpen(false);
              }}
            >
              应用照片
            </Button>
          </div>
        </FieldGroup>
      </Dialog>
    </>
  );
}
