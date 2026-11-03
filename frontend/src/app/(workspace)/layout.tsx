import { BasicLayout } from "@/components/layout/basic-layout";

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <BasicLayout>{children}</BasicLayout>;
}
