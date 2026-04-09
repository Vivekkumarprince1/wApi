"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  UserPlus, 
  Mail, 
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { getAllUsers, updateUserRole } from "@/lib/api";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const UserDirectory = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await getAllUsers({
        page: pagination.page,
        limit: 20,
        search: searchTerm,
        role: roleFilter === "all" ? null : roleFilter
      });
      setUsers(res.data || []);
      setPagination(prev => ({ ...prev, total: res.pagination?.total || 0 }));
    } catch (err) {
      toast.error("Failed to load users");
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, { role: newRole });
      toast.success("User role updated successfully");
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update user role");
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await updateUserRole(userId, { status: newStatus });
      toast.success(`User set to ${newStatus}`);
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update user status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">User Directory</h1>
          <p className="text-slate-400 mt-1">Manage every user across the entire platform</p>
        </div>
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
          {["all", "owner", "admin", "agent"].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                roleFilter === role ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-400 hover:text-white"
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-[2rem] flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchUsers()}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
          />
        </div>
        <button 
          onClick={fetchUsers}
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20"
        >
          Search
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="text-left p-6 text-slate-400 font-semibold text-xs uppercase tracking-widest">User</th>
                <th className="text-left p-6 text-slate-400 font-semibold text-xs uppercase tracking-widest">Role</th>
                <th className="text-left p-6 text-slate-400 font-semibold text-xs uppercase tracking-widest">Workspace</th>
                <th className="text-left p-6 text-slate-400 font-semibold text-xs uppercase tracking-widest">Status</th>
                <th className="text-left p-6 text-slate-400 font-semibold text-xs uppercase tracking-widest">Joined</th>
                <th className="text-left p-6 text-slate-400 font-semibold text-xs uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500">
                    <Loader2 className="animate-spin inline-block mr-2" />
                    Crunching user data...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500 italic">
                    No users found matching your criteria
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
                          {user.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="text-white font-bold">{user.name}</p>
                          <p className="text-slate-500 text-sm flex items-center gap-1">
                            <Mail size={12} /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <select 
                        value={user.role}
                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 capitalize cursor-pointer hover:border-slate-700 transition-colors"
                      >
                        {["owner", "admin", "agent"].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-medium">
                          {user.workspace?.name || "N/A"}
                        </span>
                        {user.workspace?.plan && (
                          <span className="px-2 py-0.5 bg-blue-600/10 text-blue-400 text-[10px] font-bold rounded uppercase tracking-tighter border border-blue-600/20">
                            {user.workspace.plan.name || user.workspace.plan}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-6">
                      <button 
                        onClick={() => handleStatusToggle(user._id, user.status)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                          user.status === "active" 
                            ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" 
                            : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        )}
                      >
                        {user.status === "active" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        <span className="capitalize">{user.status}</span>
                      </button>
                    </td>
                    <td className="p-6 text-slate-500 text-sm font-mono">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-6">
                      <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="text-white font-bold">{users.length}</span> of <span className="text-white font-bold">{pagination.total}</span> users
          </p>
          <div className="flex gap-2">
            <button 
              disabled={pagination.page === 1 || loading}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button 
              disabled={users.length < 20 || pagination.page * 20 >= pagination.total || loading}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDirectory;
