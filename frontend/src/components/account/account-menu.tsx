"use client";
import { errorMessage } from "@/lib/api/error-message";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BriefcaseBusiness,
  Globe,
  LogOut,
  UserRound,
  Settings,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/shared/app-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StatusMessage } from "@/components/ui/status-message";
import { Skeleton } from "@/components/ui/skeleton";
import { announceLogout, clearOwnerRecoveries } from "@/lib/resume/recovery";
import { logoutAccount } from "@/lib/api/generated/api/account";
export function AccountMenu() {
  const { account, loading, setAccount, openAuth } = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (loading)
    return (
      <Skeleton className="size-8 rounded-full" aria-label="正在读取账户" />
    );
  if (!account)
    return (
      <Button variant="ghost" onClick={() => openAuth()}>
        登录
      </Button>
    );
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="打开账户菜单"
            className="size-11"
          >
            <Avatar>
              <AvatarImage src={account.avatar ?? undefined} alt="账户头像" />
              <AvatarFallback>{account.displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">
            {account.displayName}
            <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
              {account.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <UserRound />
                个人资料
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/access">
                <Settings />
                账户与访问
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/publication">
                <Globe />
                公开简历
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/delivery">
                <BriefcaseBusiness />
                求职准备
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setError("");
              setOpen(true);
            }}
          >
            <LogOut />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="退出当前账户？"
        description="已保存的简历和公开页会保留。请先保存正在编辑的内容。"
      >
        {error ? <StatusMessage>{error}</StatusMessage> : null}
        {busy ? <StatusMessage loading>正在退出…</StatusMessage> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                if (account) clearOwnerRecoveries(account.id);
                await logoutAccount();
                if (account) announceLogout(account.id);
                setAccount(null);
                setOpen(false);
                router.push("/workspace");
              } catch (cause) {
                setError(errorMessage(cause, "退出失败，请重试。"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "正在退出" : "退出登录"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
