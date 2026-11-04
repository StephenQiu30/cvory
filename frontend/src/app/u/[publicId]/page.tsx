import { Globe } from "lucide-react";
import { getPublicResume } from "@/lib/api/generated/api/publication";
import { ResumeDocument } from "@/components/resume/resume-document";
import { ApiError } from "@/lib/api/request";
export const dynamic = "force-dynamic";
export default async function Visitor({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  let document: API.ResumeDocument | null = null;
  try {
    document = await getPublicResume(
      { public_id: publicId },
      { baseURL: process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000" },
    );
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 404) throw e;
  }
  return document ? (
    <main className="min-h-dvh bg-white px-6 py-12 text-[#171717] sm:px-10 sm:py-16">
      <div className="mx-auto max-w-[880px]">
        <ResumeDocument web document={document} />
      </div>
    </main>
  ) : (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#171717]">
      <Globe aria-hidden className="size-6 text-muted-foreground" />
      <h1 className="text-xl font-medium">这份简历暂未公开</h1>
      <p className="text-sm text-muted-foreground">内容尚未发布，或已由本人撤回。</p>
    </main>
  );
}
