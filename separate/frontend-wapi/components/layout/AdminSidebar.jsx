"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart3, 
  Building2, 
  Users, 
  CreditCard, 
  Settings, 
  Heart, 
  ShieldAlert,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  Zap
} from "lucide-react";
import { useAuthStore as useAuth } from '@/store/authStore';
import { cn } from "@/lib/utils";

const AdminSidebar = ({ isOpen, onClose, currentPath }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "Overview", icon: BarChart3, path: "/admin" },
    { id: "workspaces", label: "Workspaces", icon: Building2, path: "/admin/workspaces" },
    { id: "users", label: "User Directory", icon: Users, path: "/admin/users" },
    { id: "plans", label: "Plan Management", icon: CreditCard, path: "/admin/plans" },
    { id: "verification", label: "WABA Requests", icon: Zap, path: "/admin/whatsapp-requests" },
    { id: "health", label: "WABA Health", icon: Heart, path: "/admin/health" },
  ];

  const navigate = (path) => {
    router.push(path);
    if (onClose) onClose();
  };

  const isActive = (path) => {
    if (path === "/admin") return currentPath === "/admin";
    return currentPath?.startsWith(path);
  };

  return (
    <>
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full z-50 bg-slate-950 border-r border-slate-800 transition-all duration-300",
          collapsed ? "w-20" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header/Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/40">
                A
              </div>
              <span className="font-bold text-white tracking-tight">ADMIN PANEL</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white mx-auto">
              A
            </div>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <div className="py-6 px-4 space-y-2 overflow-y-auto h-[calc(100%-140px)]">
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all group",
                  active 
                    ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" 
                    : "text-slate-400 hover:bg-slate-900 hover:text-white border border-transparent"
                )}
              >
                <item.icon size={20} className={cn(active ? "text-blue-400" : "group-hover:text-blue-400 transition-colors")} />
                {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* User Footer */}
        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-slate-800 bg-slate-950">
          <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold border border-slate-700">
              {user?.name?.[0] || "A"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || "Admin"}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            )}
            {!collapsed && (
              <button 
                onClick={() => navigate('/dashboard')}
                className="p-2 text-slate-500 hover:text-white transition-colors"
                title="Back to User Dashboard"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
};

export default AdminSidebar;
