"use client";

import React, { useState } from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { 
  Users, 
  Search, 
  Filter,
  UserPlus,
  MoreVertical,
  ShieldCheck,
  Mail,
  Calendar,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Settings2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { toast } from "sonner";
import { useAuthStore } from '@/store/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { Label } from '@/components/ui/label';

export default function UserManagementPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/users');
      return response?.data || response || [];
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.post('/super-admin/users/invite', payload);
    },
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      setIsInviteOpen(false);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to send invitation");
    }
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return toast.error("Please enter an email");
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return await apiClient.patch(`/super-admin/users/${id}/role`, { role });
    },
    onSuccess: (resp: any) => {
      toast.success(resp?.message || "Role updated");
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Failed to update role"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiClient.patch(`/super-admin/users/${id}/status`, { status });
    },
    onSuccess: (resp: any) => {
      toast.success(resp?.message || "Status updated");
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Failed to update status"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/super-admin/users/${id}`);
    },
    onSuccess: () => {
      toast.success("User decommissioned");
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Failed to remove user"),
  });

  const handleEditPermissions = (user: any) => {
    const newRole = prompt(`Change role for ${user.email}.\nCurrent: ${user.role}\n\nOptions: owner, admin, agent, viewer`, user.role);
    if (newRole && newRole !== user.role) {
      updateRoleMutation.mutate({ id: user._id, role: newRole });
    }
  };

  const handleToggleStatus = (user: any) => {
    const currentStatus = user.status || 'active';
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    updateStatusMutation.mutate({ id: user._id, status: newStatus });
  };

  const handleDeleteUser = (user: any) => {
    if (!confirm(`CRITICAL: Remove user ${user.email}?\n\nThis will deactivate their account and revoke all access.`)) return;
    deleteUserMutation.mutate(user._id);
  };

  const filteredUsers = (users || []).filter((u: any) => {
    const matchesSearch = (u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
      <div className="flex flex-col gap-8 pb-20 max-w-[1600px] mx-auto p-4 md:p-8 font-inter">
        <SuperAdminPageHeader
          icon={Users}
          eyebrow="Console"
          title="User Management"
          subtitle="Manage platform users, roles, and access permissions across all workspaces."
          actions={(
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xl shadow-emerald-500/20 h-12 px-8 rounded-2xl flex items-center gap-2 group" onClick={() => setIsInviteOpen(true)}>
              <UserPlus className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase tracking-widest">Invite User</span>
            </Button>
          )}
        />

        {/* Control Bar */}
        <div className="bg-white/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, email or ID..." 
                className="h-11 pl-10 bg-white border-slate-200 rounded-xl text-xs font-bold" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">System Admin</option>
              <option value="user">Standard User</option>
            </select>
            <select 
              className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="invited">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {isLoading ? 'Scanning...' : `Showing ${filteredUsers.length} of ${users?.length || 0} Entities`}
          </div>
        </div>

        {/* User Table */}
        <div className="glass-card rounded-3xl overflow-hidden shadow-sm border border-slate-200/50 flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">User</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last Active</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-5"><Skeleton className="h-12 w-64 rounded-xl" /></td>
                      <td className="px-6 py-5"><Skeleton className="h-8 w-24 rounded-lg" /></td>
                      <td className="px-6 py-5"><Skeleton className="h-8 w-20 rounded-full" /></td>
                      <td className="px-6 py-5"><Skeleton className="h-6 w-32 rounded-lg" /></td>
                      <td className="px-6 py-5"><Skeleton className="h-8 w-8 ml-auto rounded-lg" /></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center">
                          <Users className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="font-manrope text-lg font-black">No Entities Found</h3>
                        <p className="text-sm text-muted-foreground max-w-xs font-medium">No users match your current search or filter criteria.</p>
                        <Button variant="outline" className="h-9 px-6 rounded-xl font-black uppercase tracking-widest text-[9px]" onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}>
                          Reset View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.map((u: any) => (
                  <tr key={u._id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm shadow-sm">
                          {u.name?.charAt(0) || u.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">{u.name || 'Pending Invite'}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5" /> {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant="outline" className={cn(
                        "font-black text-[9px] uppercase tracking-widest border-none",
                        u.role === 'admin' ? "bg-indigo-500/10 text-indigo-600" : "bg-slate-500/10 text-slate-600"
                      )}>
                        {u.role === 'admin' ? 'ADMIN' : 'USER'}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                          u.status === 'active' ? "bg-emerald-500" : u.status === 'suspended' ? "bg-red-500" : "bg-amber-500"
                        )} />
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          u.status === 'active' ? "text-emerald-600" : u.status === 'suspended' ? "text-red-600" : "text-amber-600"
                        )}>
                          {u.status || 'ACTIVE'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Never'}
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-tighter">
                          {u.lastActive ? new Date(u.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Activity'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-all">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-slate-200 shadow-2xl backdrop-blur-xl">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground p-3">User Actions</DropdownMenuLabel>
                            <DropdownMenuItem className="rounded-xl p-3 text-xs font-bold gap-3 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer" onClick={() => handleEditPermissions(u)}>
                              <Settings2 className="h-4 w-4" /> Edit Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl p-3 text-xs font-bold gap-3 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer" onClick={() => handleToggleStatus(u)}>
                              <ShieldAlert className="h-4 w-4" /> {u.status === 'suspended' ? 'Activate User' : 'Suspend User'}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator className="bg-slate-100" />
                          <DropdownMenuItem className="rounded-xl p-3 text-xs font-bold gap-3 text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer" onClick={() => handleDeleteUser(u)}>
                            <Trash2 className="h-4 w-4" /> Remove User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 border-t border-slate-100 bg-white/40 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 rounded-xl font-black text-[9px] uppercase tracking-widest" disabled>Previous</Button>
              <Button variant="outline" className="h-9 rounded-xl font-black text-[9px] uppercase tracking-widest" disabled>Next</Button>
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Global Synchronization: <span className="text-emerald-600">Nominal</span></p>
          </div>
        </div>

        {/* Invite Dialog */}
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogContent className="sm:max-w-[480px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-white">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <UserPlus className="h-24 w-24" />
              </div>
              <DialogHeader>
                <DialogTitle className="font-manrope text-2xl font-black uppercase tracking-tighter">Invite User</DialogTitle>
                <DialogDescription className="text-emerald-100 font-medium text-sm mt-2">
                  Add a new user to the platform with specified role and permissions.
                </DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleInvite} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                  <Input 
                    type="email" 
                    placeholder="entity@domain.com" 
                    className="h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold focus:ring-emerald-500/20"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Role</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                        inviteRole === 'user' ? "border-emerald-500 bg-emerald-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      )}
                      onClick={() => setInviteRole('user')}
                    >
                      <Users className={cn("h-6 w-6 mb-2", inviteRole === 'user' ? "text-emerald-600" : "text-slate-400")} />
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", inviteRole === 'user' ? "text-emerald-700" : "text-slate-500")}>User</span>
                    </button>
                    <button 
                      type="button"
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                        inviteRole === 'admin' ? "border-emerald-500 bg-emerald-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      )}
                      onClick={() => setInviteRole('admin')}
                    >
                      <ShieldCheck className={cn("h-6 w-6 mb-2", inviteRole === 'admin' ? "text-emerald-600" : "text-slate-400")} />
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", inviteRole === 'admin' ? "text-emerald-700" : "text-slate-500")}>Admin</span>
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                <Button type="submit" className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

  );
}
