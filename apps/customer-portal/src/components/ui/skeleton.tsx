import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    >
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export { Skeleton }
