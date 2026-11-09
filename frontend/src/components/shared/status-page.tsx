import { CircleAlert, type LucideIcon } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function StatusPage({
  title,
  description,
  icon: Icon = CircleAlert,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-6 py-16">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle role="heading" aria-level={1}>
            {title}
          </EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {children ? <EmptyContent>{children}</EmptyContent> : null}
      </Empty>
    </main>
  );
}
