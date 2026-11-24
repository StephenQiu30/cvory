import Link from 'next/link';
import { appName, docsRoute } from '@/lib/shared';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center items-center text-center flex-1 px-4 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight mb-4">{appName}</h1>
      <p className="text-lg text-muted-foreground max-w-xl mb-8">
        查看简序的产品需求、模板调研与设计依据。
      </p>
      <Link
        href={docsRoute}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
      >
        进入文档中心
      </Link>
    </div>
  );
}
