import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import type { Metadata } from 'next';
import { appName } from '@/lib/shared';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.WORKSPACE_PUBLIC_URL ??
      (process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'http://127.0.0.1:1230'),
  ),
  title: appName,
  description: '简序的产品需求、模板调研与设计依据',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
