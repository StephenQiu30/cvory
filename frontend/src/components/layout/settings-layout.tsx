"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, UserRound, ShieldCheck, Palette } from "lucide-react";
import type { ReactNode } from "react";
import { Content } from "./content";
import { useAccount } from "@/components/account/account-provider";
export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { account, loading, error, refresh } = useAccount();
  return (
    <Content>
      <div className="grid gap-8 md:grid-cols-[208px_minmax(0,1fr)]">
        <aside>
          <p className="mb-4 text-xs text-muted-foreground">账户设置</p>
          <nav
            aria-label="账户设置"
            className="grid grid-cols-2 gap-1 md:flex md:flex-col"
          >
            {[
              ["profile", "个人资料", UserRound],
              ["access", "账户与访问", ShieldCheck],
            ["appearance", "外观", Palette],
              ["publication", "公开简历", Globe],
            ].map(([path, label, Icon]) => {
              const I = Icon as typeof Globe;
              return (
                <Link
                  key={String(path)}
                  href={`/settings/${path}`}
                  aria-current={
                    pathname.endsWith(String(path)) ? "page" : undefined
                  }
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-3.5 text-[13px] font-medium transition-colors ${pathname.endsWith(String(path)) ? "bg-foreground text-background" : "hover:bg-surface-subtle text-secondary-foreground"}`}
                >
                  <I aria-hidden className="size-4" />
                  {String(label)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          {loading ? (
            <p role="status">正在读取账户…</p>
          ) : account ? (
            children
          ) : (
            <div>
              <p>{error || "登录后管理个人资料与公开简历。"}</p>
              {error ? (
                <button
                  className="mt-3 text-link"
                  onClick={() => void refresh()}
                >
                  重新连接
                </button>
              ) : (
                <Link
                  className="mt-4 inline-block text-link"
                  href={`/login?returnTo=${encodeURIComponent(pathname)}`}
                >
                  登录账户
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </Content>
  );
}
