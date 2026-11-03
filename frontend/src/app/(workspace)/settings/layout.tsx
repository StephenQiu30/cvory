import type { ReactNode } from "react";
import { SettingsLayout } from "@/components/layout/settings-layout";
export default function Layout({ children }: { children: ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
