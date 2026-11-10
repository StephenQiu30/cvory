import { PublicResumePage } from "@/components/resume/public-resume-page";
export const dynamic = "force-dynamic";
export default async function Visitor({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <PublicResumePage publicId={publicId} />;
}
