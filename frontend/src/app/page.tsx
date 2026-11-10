import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";
import { PublicResumePage } from "@/components/resume/public-resume-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const publicId = process.env.SITE_OWNER_PUBLIC_ID?.trim();
  if (!publicId) {
    return (
      <StatusPage
        title="站主主页尚未配置"
        description="站主还没有发布可公开查阅的简历。"
        icon={UserRound}
      >
        <Button asChild variant="secondary">
          <Link href="/workspace">进入工作台</Link>
        </Button>
      </StatusPage>
    );
  }
  return <PublicResumePage publicId={publicId} />;
}
