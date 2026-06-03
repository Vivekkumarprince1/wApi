import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  active: "success",
  trialing: "secondary",
  past_due: "outline",
  suspended: "destructive",
  canceled: "destructive",
  frozen: "destructive",
  // Invoice statuses
  paid: "success",
  pending: "secondary",
  draft: "outline",
  void: "destructive",
  // Onboarding / ESB statuses
  completed: "success",
  phone_pending: "secondary",
  in_progress: "secondary",
  failed: "destructive",
  blocked: "destructive",
};

export function StatusBadge({ status }: { status?: string }) {
  const key = (status || "").toLowerCase();
  return <Badge variant={VARIANT[key] || "outline"}>{status || "unknown"}</Badge>;
}
