import { CheckCircle2, CircleAlert, Info, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export type StatusTone = "error" | "success" | "info";
const icons = { error: CircleAlert, success: CheckCircle2, info: Info };

export function StatusMessage({
  children,
  title,
  tone = "error",
  loading = false,
  action,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  tone?: StatusTone;
  loading?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = loading ? LoaderCircle : icons[tone];
  return (
    <Alert
      role={!loading && tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      variant={!loading && tone === "error" ? "destructive" : "default"}
      data-tone={loading ? "loading" : tone}
      className={className}
    >
      <Icon
        aria-hidden
        className={
          loading ? "animate-spin motion-reduce:animate-none" : undefined
        }
      />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>
        {children}
        {action ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function StatusBadge({
  children,
  loading = false,
  success = false,
}: {
  children: React.ReactNode;
  loading?: boolean;
  success?: boolean;
}) {
  const Icon = loading ? LoaderCircle : success ? CheckCircle2 : Info;
  return (
    <Badge variant="secondary" role="status" aria-atomic="true">
      <Icon
        aria-hidden
        className={
          loading ? "animate-spin motion-reduce:animate-none" : undefined
        }
      />
      {children}
    </Badge>
  );
}
