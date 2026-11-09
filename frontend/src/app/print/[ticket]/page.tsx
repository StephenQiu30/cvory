import { getPrintContext } from "@/lib/api/generated/api/files";
import { ResumeDocument } from "@/components/resume/resume-document";
export const dynamic = "force-dynamic";
export default async function Print({
  params,
}: {
  params: Promise<{ ticket: string }>;
}) {
  const { ticket } = await params;
  const document = await getPrintContext(
    { ticket },
    { baseURL: process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:4321" },
  );
  return (
    <main data-print-ready="true">
      <ResumeDocument document={document} />
    </main>
  );
}
