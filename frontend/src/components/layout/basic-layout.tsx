import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Header } from "./header";
import { AccountProvider } from "@/components/account/account-provider";
export function BasicLayout({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      <div className="workspace-shell flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-3"
        >
          跳到内容
        </a>
        <Header />
        <main id="main-content" className="w-full flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </AccountProvider>
  );
}
