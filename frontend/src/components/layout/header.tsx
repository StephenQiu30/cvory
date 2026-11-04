import Link from "next/link";
import Image from "next/image";
import { GitFork } from "lucide-react";
import { AccountMenu } from "@/components/account/account-menu";
import { ThemeMenu } from "@/components/account/theme-menu";
import {Navbar} from "./navbar";
export function Header() {
  return (
    <header className="sticky top-0 z-40 h-16 shrink-0 bg-background/95 backdrop-blur">
      <div className="app-shell-container flex h-full items-center gap-6">
        <Link
          href="/"
          aria-label="简序首页"
          className="inline-flex items-center gap-2 text-sm font-medium"
        >
          <Image src="/brand/cvory.svg" width={24} height={24} alt="" className="dark:invert"/>
          简序
        </Link>
        <Navbar/>
        <div className="ml-auto flex items-center gap-1">
          <a
            href="https://github.com/StephenQiu30/cvory"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库"
            className="flex size-11 items-center justify-center rounded-full hover:bg-surface-subtle"
          >
            <GitFork aria-hidden className="size-4" />
          </a>
          <ThemeMenu />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
