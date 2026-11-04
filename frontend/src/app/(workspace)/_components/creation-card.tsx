import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CreationCard({
  title,
  description,
  icon: Icon,
  action,
  onAction,
  detail,
  isNew = false,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action: string;
  onAction: (trigger: HTMLElement) => void;
  detail?: string;
  isNew?: boolean;
}) {
  return (
    <Card variant="subtle" className="h-full min-h-[440px]">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {isNew ? (
          <CardAction>
            <Badge variant="secondary">新</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-h-36 flex-1 items-center justify-center">
        <Icon aria-hidden className="size-14" strokeWidth={1.5} />
      </CardContent>
      <CardFooter className="flex-col justify-center gap-3">
        <Button size="lg" onClick={(event) => onAction(event.currentTarget)}>
          {action}
        </Button>
        {detail ? <CardDescription>{detail}</CardDescription> : null}
      </CardFooter>
    </Card>
  );
}
