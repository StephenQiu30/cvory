"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOtpEmail, verifyOtpEmail, type AuthSession } from "@/lib/api/http";

interface EmailAuthDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAuthenticated: (session: AuthSession) => void;
}

export function EmailAuthDialog({ open, onOpenChange, onAuthenticated }: EmailAuthDialogProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      await sendOtpEmail(email.trim());
      setSent(true);
    } catch {
      setError("验证码发送失败，请检查邮箱格式或稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      const session = await verifyOtpEmail(email.trim(), code.trim());
      onAuthenticated(session);
      onOpenChange(false);
    } catch {
      setError("验证码不正确或已过期，请重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">邮箱验证登录</DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            登录后可将当前简历认领到云端，支持跨设备自动保存、上传头像与生成只读分享链接。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-xs text-neutral-600">
              邮箱地址
            </Label>
            <div className="flex gap-2">
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
              <Button
                type="button"
                variant="outline"
                disabled={loading || !email.trim()}
                onClick={() => void handleSendOtp()}
                className="shrink-0 text-xs"
              >
                {sent ? "重新发送" : "获取验证码"}
              </Button>
            </div>
          </div>

          {sent ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-otp" className="text-xs text-neutral-600">
                6 位邮箱验证码
              </Label>
              <Input
                id="auth-otp"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="输入 6 位数字验证码"
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={loading || !sent || code.trim().length !== 6}
            onClick={() => void handleVerify()}
          >
            验证并继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
