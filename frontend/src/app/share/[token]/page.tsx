"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ResumePaper } from "@/components/preview/resume-paper";
import { Button } from "@/components/ui/button";
import { fetchPublicSharedResume, type PublicSharedResume } from "@/lib/api/http";

interface SharePageProps {
  readonly params: Promise<{ readonly token: string }>;
}

export default function PublicSharePage({ params }: SharePageProps) {
  const { token } = use(params);
  const [data, setData] = useState<PublicSharedResume | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicSharedResume(token)
      .then((res) => {
        if (active) {
          setData(res);
        }
      })
      .catch(() => {
        if (active) {
          setError("该分享链接不存在或已被作者关闭");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-8 text-neutral-950">
      <header className="mx-auto mb-6 flex max-w-[210mm] items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">简序 · 在线简历</span>
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
          <Link href="/">我也要做一份</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-[210mm]">
        {error ? (
          <div className="rounded-md bg-white px-6 py-16 text-center text-sm text-neutral-600">
            {error}
          </div>
        ) : data ? (
          <ResumePaper templateId={data.template_id} content={data.content} />
        ) : (
          <div className="rounded-md bg-white px-6 py-16 text-center text-sm text-neutral-400">
            正在加载分享简历...
          </div>
        )}
      </main>
    </div>
  );
}
