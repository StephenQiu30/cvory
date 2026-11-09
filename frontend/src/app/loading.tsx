import { LoadingState } from "@/components/ui/loading-state";
export default function Loading() {
  return (
    <main className="app-shell-container py-16">
      <LoadingState>正在读取页面…</LoadingState>
    </main>
  );
}
