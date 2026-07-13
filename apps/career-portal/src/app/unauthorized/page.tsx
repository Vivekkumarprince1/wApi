import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button, Surface } from "@/components/ui";
import { getCurrentUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Unauthorized",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; permission?: string }>;
}) {
  const [{ from, permission }, user] = await Promise.all([searchParams, getCurrentUser()]);

  return (
    <div className="container-page py-10">
      <Surface className="mx-auto max-w-2xl p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-6 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">Access denied</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">You do not have permission for this page</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {user
                ? `${user.name} is signed in as ${user.role}. This route requires a different role or explicit permission.`
                : "Sign in with an eligible account to continue."}
            </p>
            {permission ? (
              <p className="mt-2 rounded-md border bg-muted px-3 py-2 text-sm">
                Required permission: <span className="font-medium">{permission}</span>
              </p>
            ) : null}
            {from ? <p className="mt-2 text-xs text-muted-foreground">Requested route: {from}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/login">Switch account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/jobs">Open jobs</Link>
              </Button>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
