import { CircleAlert, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function StatusMessage({
  children,
  loading = false,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  const Icon = loading ? LoaderCircle : CircleAlert;
  return (
    <Alert
      role={loading ? "status" : "alert"}
      variant={loading ? "default" : "destructive"}
    >
      <Icon aria-hidden className={loading ? "animate-spin" : undefined} />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
