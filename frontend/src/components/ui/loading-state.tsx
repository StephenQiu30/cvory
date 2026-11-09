import { Skeleton } from "@/components/ui/skeleton";
import { StatusMessage } from "@/components/ui/status-message";

export function LoadingState({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-4 py-5">
      <StatusMessage loading>{children}</StatusMessage>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}
