import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";
export default function NotFound() {
  return (
    <StatusPage
      title="找不到这个页面"
      description="页面不存在，或地址已失效。"
      icon={FileQuestion}
    >
      <Button asChild>
        <Link href="/">返回我的简历</Link>
      </Button>
    </StatusPage>
  );
}
