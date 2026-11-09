"use client";
import { errorMessage } from "@/lib/api/error-message";
import { useState } from "react";
import { useAccount } from "@/components/account/account-provider";
import { updateAccount } from "@/lib/api/generated/api/account";
import { PageHeader } from "@/components/layout/content";
import { ImagePicker } from "@/components/account/image-picker";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
function ProfileForm({ account }: { account: API.AccountResource }) {
  const [displayName, setName] = useState(account.displayName);
  const [avatar, setAvatar] = useState(account.avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { setAccount } = useAccount();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("");
        if (!displayName.trim()) {
          setError("请输入显示名称。");
          return;
        }
        setBusy(true);
        setError("");
        try {
          setAccount(
            await updateAccount({ displayName: displayName.trim(), avatar }),
          );
          setMessage("资料已保存");
        } catch (cause) {
          setError(
            errorMessage(cause, "保存失败，输入已保留。请重试或重新登录。"),
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <FieldGroup>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar className="size-16">
            <AvatarImage src={avatar ?? undefined} alt="账户头像" />
            <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="mb-2 text-sm">账户头像</p>
            <div className="flex items-center gap-2">
              <ImagePicker value={avatar} onApply={setAvatar} />
              {avatar ? (
                <Button variant="ghost" onClick={() => setAvatar(null)}>
                  移除
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="account-name"
            label="显示名称"
            value={displayName}
            onChange={setName}
            error={!displayName.trim() ? error : undefined}
          />
          <FormField
            id="account-email"
            label="登录邮箱"
            value={account.email}
            disabled
          />
        </div>
        {error && displayName.trim() ? (
          <StatusMessage>{error}</StatusMessage>
        ) : null}
        {message ? (
          <StatusMessage tone="success">{message}</StatusMessage>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setName(account.displayName);
              setAvatar(account.avatar);
              setError("");
              setMessage("");
            }}
          >
            取消
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "保存中" : "保存资料"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
export default function Profile() {
  const { account } = useAccount();
  return (
    <>
      <PageHeader
        title="个人资料"
        description="管理账户头像与称呼。简历中的姓名和证件照由各份简历单独维护。"
      />
      {account ? <ProfileForm account={account} /> : null}
    </>
  );
}
