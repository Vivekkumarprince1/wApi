import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/auth";
import { AdminShell } from "@/components/layout/admin-shell";
import QueryProvider from "@/components/providers/query-provider";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  return (
    <QueryProvider>
      <AdminShell
        initialUser={{
          userId: session.userId,
          name: session.name,
          email: session.email,
          role: session.role,
        }}
      >
        {children}
      </AdminShell>
      <Toaster richColors position="top-right" />
    </QueryProvider>
  );
}
