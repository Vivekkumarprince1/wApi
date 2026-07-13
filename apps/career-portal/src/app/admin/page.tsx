import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server-auth";

export default async function AdminIndexPage() {
  await requireUser({ from: "/admin", adminAccess: true, permission: "canAccessDashboard" });
  redirect("/admin/dashboard");
}
