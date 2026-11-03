"use client";
import { useAccount } from "@/components/account/account-provider";
import { PageHeader } from "@/components/layout/content";
export default function Access() {
  const { account } = useAccount();
  return (
    <>
      <PageHeader
        title="账户与访问"
        description="使用邮箱和密码登录。退出入口位于右上角账户菜单。"
      />
      <dl className="grid gap-5 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">登录邮箱</dt>
          <dd className="mt-2">{account?.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">账户状态</dt>
          <dd className="mt-2">已登录 · 邮箱尚未验证</dd>
        </div>
      </dl>
      <p className="mt-8 text-xs text-muted-foreground">
        当前不提供邮件验证、密码重置与注册邮件发送。
      </p>
    </>
  );
}
