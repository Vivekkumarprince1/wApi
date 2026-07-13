import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-page py-12">
      <div className="rounded-lg border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">This careers page is not available</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The role, credential, or workspace link may have expired or moved.
        </p>
        <Button asChild className="mt-5">
          <Link href="/jobs">Browse open roles</Link>
        </Button>
      </div>
    </div>
  );
}
