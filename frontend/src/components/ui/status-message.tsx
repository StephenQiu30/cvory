import { CircleAlert, LoaderCircle } from "lucide-react";
export function StatusMessage({
  children,
  loading = false,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  const Icon = loading ? LoaderCircle : CircleAlert;
  return (
    <p
      role={loading ? "status" : "alert"}
      className="flex items-start gap-2 text-[13px] leading-5"
    >
      <Icon
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${loading ? "animate-spin" : ""}`}
      />
      {children}
    </p>
  );
}
