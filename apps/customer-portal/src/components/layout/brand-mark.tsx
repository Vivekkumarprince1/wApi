import { MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({
  descriptor = "Customer Portal",
  compact = false,
  className,
}: {
  descriptor?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
        <MessageSquare className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold leading-none tracking-tight text-foreground">
          ConnectSphere
        </span>
        {!compact ? (
          <span className="mt-1 block truncate text-[10px] font-bold leading-none tracking-[0.14em] text-primary uppercase">
            {descriptor}
          </span>
        ) : null}
      </span>
    </span>
  );
}
