"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  UserPlus,
  MoreVertical,
  Settings2,
  ShieldAlert,
  Trash2,
  Clock,
  Mail,
  Loader2,
  Users as UsersIcon,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiGet, apiPost } from "@/lib/api/client";
import { useAdminAuth } from "@/store/admin-auth-store";

interface AdminUserRow {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  lastLoginAt?: string;
}
interface UsersResponse {
  items: AdminUserRow[];
  page: number;
  total: number;
  totalPages: number;
}

const ROLES = ["super_admin", "owner", "admin", "manager", "agent", "member", "viewer"];

let searchTimer: ReturnType<typeof setTimeout>;

export default function UsersPage() {
  const qc = useQueryClient();
  const can = useAdminAuth((s) => s.can);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  // Role-edit dialog
  const [roleEdit, setRoleEdit] = useState<{ user: AdminUserRow; role: string } | null>(null);

  function onSearch(value: string) {
    setSearch(value);
    setPage(1);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setDebounced(value), 350);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", debounced, roleFilter, page],
    queryFn: () =>
      apiGet<UsersResponse>(
        `/api/admin/read/users?q=${encodeURIComponent(debounced)}${roleFilter !== "all" ? `&role=${roleFilter}` : ""}&page=${page}`
      ),
  });

  const rows = (data?.items ?? []).filter((u) => statusFilter === "all" || u.status === statusFilter);

  const action = useMutation({
    mutationFn: ({ id, act, body }: { id: string; act: string; body?: unknown }) =>
      apiPost(`/api/admin/ops/users/${id}/${act}`, body),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const invite = useMutation({
    mutationFn: () => apiPost("/api/admin/ops/users/invite", { email: inviteEmail, name: inviteName, role: inviteRole }),
    onSuccess: () => {
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleDelete(u: AdminUserRow) {
    if (!confirm(`Remove user ${u.email}? This deactivates the account and revokes access.`)) return;
    action.mutate({ id: u._id, act: "delete" });
  }

  return (
    <>
      <PageHeader
        title="User Directory"
        description="Manage platform users, roles, and access across all workspaces"
        actions={
          can("workspaces") ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite User
            </Button>
          ) : null
        }
      />
      <div className="p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative sm:max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9" />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {isLoading ? "Loading…" : `Showing ${rows.length} of ${data?.total ?? 0}`}
          </p>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="text-center text-destructive py-8">Failed to load users.</TableCell></TableRow>
              ) : rows.length ? (
                rows.map((u) => {
                  const suspended = u.status === "suspended" || u.status === "removed";
                  return (
                    <TableRow key={u._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold uppercase">
                            {(u.name || u.email || "?").charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{u.name || "Pending invite"}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{u.role || "—"}</Badge></TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {can("workspaces") && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>User actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setRoleEdit({ user: u, role: u.role || "member" })}>
                                <Settings2 className="h-4 w-4" /> Edit role
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => action.mutate({ id: u._id, act: suspended ? "enable" : "disable" })}>
                                <ShieldAlert className="h-4 w-4" /> {suspended ? "Activate user" : "Suspend user"}
                              </DropdownMenuItem>
                              {can("system") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setTimeout(() => handleDelete(u), 50)}>
                                    <Trash2 className="h-4 w-4" /> Remove user
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <UsersIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    No users match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{data.total.toLocaleString()} users</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-muted-foreground">{page} / {data.totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Invite User</DialogTitle>
            <DialogDescription>Add a new user to the platform with a role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email address</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name (optional)</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInviteRole("member")}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors", inviteRole === "member" ? "border-primary bg-primary/5" : "border-border hover:bg-accent")}
                >
                  <UsersIcon className="h-5 w-5" /><span className="text-xs font-medium">Member</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole("admin")}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors", inviteRole === "admin" ? "border-primary bg-primary/5" : "border-border hover:bg-accent")}
                >
                  <ShieldCheck className="h-5 w-5" /><span className="text-xs font-medium">Admin</span>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={invite.isPending}>Cancel</Button>
            <Button onClick={() => { if (!inviteEmail) { toast.error("Email is required"); return; } invite.mutate(); }} disabled={invite.isPending}>
              {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role edit dialog */}
      <Dialog open={!!roleEdit} onOpenChange={(o) => !o && setRoleEdit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>{roleEdit?.user.email}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs">Role</Label>
            <Select value={roleEdit?.role} onValueChange={(v) => roleEdit && setRoleEdit({ ...roleEdit, role: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEdit(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!roleEdit) return;
                action.mutate({ id: roleEdit.user._id, act: "role", body: { role: roleEdit.role } });
                setRoleEdit(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
