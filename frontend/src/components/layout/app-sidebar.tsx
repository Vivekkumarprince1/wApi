"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Megaphone,
  Zap,
  ShoppingBag,
  BarChart3,
  Puzzle,
  MessageSquare,
  UserPlus,
  CreditCard,
  Building2,
  Lock,
  Store,
  BarChart,
  Grid,
  Shield,
  ShieldCheck,
  Activity,
  LayoutGrid,
  Radar,
  ChevronDown,
  Terminal,
  Server,
  Database,
  Settings,
} from "lucide-react";

import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useAuthStore, useFeatureGate } from "@/store/auth-store";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type SidebarChildItem = {
  title: string;
  url: string;
  feature?: string;
};

type SidebarItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
  badge?: string;
  badgeVariant?: string;
  status?: string;
  children?: SidebarChildItem[];
};

type SidebarGroupDef = {
  label: string;
  items: SidebarItem[];
};

import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";

export function AppSidebar({ ...props }: React.ComponentProps<typeof ShadSidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace } = useAuthStore();
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  const isAdmin = user?.role === 'super_admin';
  
  // Initialize mode based on current path
  const [isAdminMode, setIsAdminMode] = React.useState(pathname.startsWith('/super-admin'));

  // Sync mode if pathname changes manually
  React.useEffect(() => {
    if (pathname.startsWith('/super-admin') && !isAdminMode) {
      setIsAdminMode(true);
    } else if (!pathname.startsWith('/super-admin') && isAdminMode) {
       setIsAdminMode(false);
    }
  }, [pathname]);

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    return pathname.startsWith(url);
  };

  const navGroups = React.useMemo<SidebarGroupDef[]>(
    () => [
      {
        label: "Main",
        items: [
          { title: "Dashboard", url: "/", icon: LayoutDashboard },
          { title: "Inbox", url: "/inbox", icon: Inbox, feature: "INBOX" },
          { title: "Billing", url: "/billing", icon: CreditCard, feature: "BILLING" },
        ],
      },
      {
        label: "Messaging",
        items: [
          { title: "Campaigns", url: "/campaign", icon: Megaphone, feature: "CAMPAIGNS" },
          { title: "Contacts", url: "/contacts", icon: Users, feature: "CONTACTS" },
          { title: "Ads", url: "/ads", icon: BarChart, feature: "ADS" },
        ],
      },
      {
        label: "Features",
        items: [
          {
            title: "Market",
            url: "/templates",
            icon: Store,
            children: [
              { title: "Templates & Library", url: "/templates", feature: "TEMPLATES_LIBRARY" },
              { title: "Campaigns", url: "/campaign", feature: "CAMPAIGNS" },
            ],
          },
          {
            title: "Automation",
            url: "/automation",
            icon: Zap,
            children: [
              { title: "Flow Hub", url: "/automation", feature: "FLOW_HUB" },
              { title: "Workflows", url: "/automation/workflows", feature: "WORKFLOWS" },
              { title: "Auto Replies", url: "/automation/auto-replies", feature: "AUTO_REPLIES" },
              { title: "Instagram QuickFlows", url: "/automation/instagram-quickflows", feature: "INSTAGRAM_QUICKFLOWS" },
              { title: "WhatsApp Forms", url: "/automation/whatsapp-forms", feature: "WA_FORMS" },
              { title: "AnswerBot Training", url: "/automation/answerbot", feature: "ANSWERBOT" },
              { title: "AI Intent Match", url: "/automation/ai-intent-matching", feature: "AI_INTENT" },
              { title: "Interaktive List", url: "/automation/interaktive-list", feature: "INTERAKTIVE_LIST" },
            ],
          },
          {
            title: "Sales CRM",
            url: "/crm",
            icon: LayoutGrid,
            children: [
              { title: "Pipeline", url: "/crm/pipeline", feature: "PIPELINE" },
              { title: "Tasks", url: "/crm/tasks", feature: "TASKS" },
              { title: "Reports", url: "/crm/reports", feature: "REPORTS" },
            ],
          },
          {
            title: "Commerce",
            url: "/commerce",
            icon: ShoppingBag,
            children: [
              { title: "Catalog", url: "/commerce/catalog", feature: "CATALOG" },
              { title: "Order Panel", url: "/commerce/orders", feature: "ORDERS" },
              { title: "Checkout Bot", url: "/commerce/checkout-bot", feature: "CHECKOUT_BOT" },
              { title: "Settings", url: "/commerce/settings", feature: "COMMERCE_SETTINGS" },
            ],
          },
        ],
      },
      {
        label: "Support & Analysis",
        items: [
          { title: "Chat Analytics", url: "/analytics/advanced", icon: BarChart3, feature: "ANALYTICS" },
          { title: "Chat Assignment", url: "/support/chat-assignment", icon: Users, feature: "CHAT_ASSIGNMENT" },
          { title: "Team Management", url: "/settings/teams", icon: UserPlus, feature: "TEAM_MGMT" },
          { title: "Macros", url: "/support/macros", icon: Zap, feature: "MACROS" },
        ],
      },
      {
        label: "Tools",
        items: [
          { title: "Integrations", url: "/integrations", icon: Puzzle, feature: "INTEGRATIONS" },
          { title: "Widget", url: "/widget", icon: Grid, feature: "WIDGET_CONFIG" },
        ],
      },
    ],
    []
  );

  // --- Sidebar Instrument Panel (Admin Vitals) ---
  
  const { data: adminStats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiClient.get('/super-admin/stats'),
    enabled: isAdmin,
    staleTime: 60000,
  });

  const adminGroups = React.useMemo<SidebarGroupDef[]>(() => {
    if (!isAdmin) return [];

    return [
      {
        label: "Super Admin",
        items: [
          {
            title: "Command Center", 
            url: "/super-admin", 
            icon: Terminal,
            children: [
              { title: "Dashboard", url: "/super-admin", icon: LayoutDashboard },
              { title: "Workspaces", url: "/super-admin/workspaces", icon: Building2 },
              { title: "User Directory", url: "/super-admin/users", icon: Users },
            ]
          },
          {
            title: "Commercial",
            url: "/super-admin/billing",
            icon: CreditCard,
            children: [
              { title: "Billing & Plans", url: "/super-admin/billing", icon: CreditCard },
            ]
          },
          {
            title: "Operations",
            url: "/super-admin/gupshup",
            icon: Radar,
            children: [
              { title: "BSP Providers", url: "/super-admin/gupshup", icon: Radar },
              { title: "Data Explorer", url: "/super-admin/data-explorer", icon: Database },
            ]
          },
          {
            title: "Governance",
            url: "/super-admin/security",
            icon: Shield,
            children: [
              { title: "Security Audit", url: "/super-admin/audit-logs", icon: Lock },
              { title: "Compliance", url: "/super-admin/compliance", icon: ShieldCheck },
              { title: "Global Settings", url: "/super-admin/settings", icon: Grid },
            ]
          },
        ]
      }
    ];
  }, [isAdmin]);

  React.useEffect(() => {
    setOpenSections((current) => {
      let changed = false;
      const next = { ...current };

      navGroups.forEach((group) => {
        group.items.forEach((item) => {
          if (!item.children?.length) return;

          const shouldOpen = item.children.some((child: SidebarChildItem) => isActive(child.url)) || isActive(item.url);
          if (shouldOpen && !next[item.title]) {
            next[item.title] = true;
            changed = true;
          }
        });
      });

      return changed ? next : current;
    });
  }, [adminGroups, navGroups, pathname]);

  const toggleSection = (title: string) => {
    setOpenSections((current) => ({
      ...current,
      [title]: !current[title],
    }));
  };

  return (
    <ShadSidebar collapsible="icon" className="border-border/50 bg-background/95 backdrop-blur-sm" {...props}>
      <SidebarHeader className="flex flex-col gap-4 p-4 border-b border-border/50">
        <div className="flex flex-col gap-4 group-data-[collapsible=icon]:items-center">
            <Link href="/" className="flex items-center gap-2 group cursor-pointer">
                <div className={`flex aspect-square size-8 items-center justify-center rounded-lg shadow-lg transition-all duration-500 group-hover:scale-105 ${isAdmin ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-primary text-primary-foreground shadow-primary/20'}`}>
                    {isAdmin ? <Shield className="size-5" /> : <MessageSquare className="size-5" />}
                </div>
                <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                    <span className="font-bold text-lg tracking-tight truncate max-w-[150px]">
                      {workspace?.name || 'wApi'}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest font-black ${isAdmin ? 'text-indigo-500' : 'text-primary'}`}>
                        {isAdmin ? 'SuperAdmin Console' : (user?.role === 'owner' ? 'Enterprise' : 'Workspace')}
                    </span>
                </div>
            </Link>

            <div className="group-data-[collapsible=icon]:hidden">
                <WorkspaceSwitcher />
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between px-2 py-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 group-data-[collapsible=icon]:hidden">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Admin Mode</span>
                  <span className="text-[8px] font-bold text-indigo-400 uppercase">System Governance</span>
                </div>
                <Switch 
                  checked={isAdminMode} 
                  onCheckedChange={(checked) => {
                    setIsAdminMode(checked);
                    if (checked) {
                      router.push('/super-admin');
                    } else {
                      router.push('/');
                    }
                  }}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>
            )}
            
            {isAdmin && (
               <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center pt-2">
                  <div 
                    className={`h-2 w-2 rounded-full cursor-pointer transition-all duration-300 ${isAdminMode ? 'bg-indigo-600 scale-125 shadow-[0_0_8px_rgba(79,70,229,0.6)]' : 'bg-slate-300'}`}
                    onClick={() => {
                      const next = !isAdminMode;
                      setIsAdminMode(next);
                      router.push(next ? '/super-admin' : '/');
                    }}
                  />
               </div>
            )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 scrollbar-hide">
        {!isAdminMode ? (
          navGroups.map((group) => (
              <SidebarGroup key={group.label} className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      {group.label}
                  </SidebarGroupLabel>
                  <SidebarMenu>
                      {group.items.map((item) => (
                          <SidebarNavItem
                              key={item.title}
                              item={item}
                              isActive={isActive}
                              openSections={openSections}
                              toggleSection={toggleSection}
                          />
                      ))}
                  </SidebarMenu>
              </SidebarGroup>
          ))
        ) : (
          adminGroups.map((group) => (
              <SidebarGroup key={group.label} className="animate-in fade-in slide-in-from-left-4 duration-500">
                  <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden px-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-2">
                      {group.label}
                  </SidebarGroupLabel>
                  <SidebarMenu className="gap-1">
                      {group.items.map((item) => (
                          <SidebarNavItem
                              key={item.title}
                              item={item}
                              isActive={isActive}
                              openSections={openSections}
                              toggleSection={toggleSection}
                              variant="admin"
                          />
                      ))}
                  </SidebarMenu>
              </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarRail />
    </ShadSidebar>
  );
}

function SidebarNavItem({ 
  item, 
  isActive, 
  openSections, 
  toggleSection,
  variant = 'default'
}: {
  item: SidebarItem;
  isActive: (url: string) => boolean;
  openSections: Record<string, boolean>;
  toggleSection: (title: string) => void;
  variant?: 'default' | 'admin';
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Call hook at top level of component
  const featureGate = useFeatureGate(item.feature || "");
  const isLocked = item.feature ? !featureGate.gate.allowed : false;
  
  const hasChildren = Boolean(item.children?.length);
  const isItemActive = hasChildren
    ? isActive(item.url) || item.children!.some((child: any) => isActive(child.url))
    : isActive(item.url);
  const isExpanded = Boolean(openSections[item.title]);

  const button = (
    <SidebarMenuButton
      tooltip={item.title}
      isActive={isItemActive}
      className={`h-11 hover:bg-muted/50 transition-all duration-300 data-[active=true]:shadow-sm rounded-xl px-3 ${
          variant === 'admin' 
              ? 'data-[active=true]:bg-indigo-600 data-[active=true]:text-white' 
              : 'data-[active=true]:bg-primary/10 data-[active=true]:text-primary'
      } ${isLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}
      render={!isLocked ? <span /> : undefined}
    >
      <item.icon className="size-5" />
      <span className="font-bold flex items-center justify-between gap-2 tracking-tight flex-1">
        <div className="flex items-center gap-2">
          {item.title}
          {isLocked && <Lock className="h-3 w-3 text-primary animate-pulse" />}
          {item.status && (
             <div className={`h-1.5 w-1.5 rounded-full ${item.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-amber-500'} animate-pulse`} />
          )}
        </div>
        {item.badge && (
           <Badge variant="outline" className={`ml-auto text-[8px] font-black tracking-widest px-1.5 py-0 border-none h-4 min-w-[1.2rem] justify-center ${
              variant === 'admin' 
                  ? (item.badgeVariant === 'indigo' ? 'bg-white text-indigo-600' : 'bg-indigo-500/20 text-indigo-200') 
                  : 'bg-primary/10 text-primary'
           }`}>
              {item.badge}
           </Badge>
        )}
      </span>
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem key={item.title}>
      {!isLocked ? (
        <Link href={item.url} className="w-full block" passHref>
          {button}
        </Link>
      ) : (
        button
      )}

      {hasChildren ? (
        <SidebarMenuAction
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.title}`}
          aria-expanded={isExpanded}
          className="text-muted-foreground"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleSection(item.title);
          }}
          title={`${isExpanded ? "Collapse" : "Expand"} ${item.title}`}
        >
          <ChevronDown className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
        </SidebarMenuAction>
      ) : null}

      {hasChildren && isExpanded ? (
        <SidebarMenuSub className="group-data-[collapsible=icon]:hidden border-l border-primary/10 ml-4 pl-2 opacity-80">
            {item.children!.map((subItem: SidebarChildItem) => (
             <SidebarNavSubItem 
                key={subItem.title} 
                subItem={subItem} 
                pathname={pathname}
                router={router}
             />
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

function SidebarNavSubItem({ 
    subItem, 
    pathname, 
    router 
}: { 
    subItem: SidebarChildItem; 
    pathname: string; 
    router: any; 
}) {
    const subFeatureGate = useFeatureGate(subItem.feature || "");
    const isSubLocked = subItem.feature ? !subFeatureGate.gate.allowed : false;

    const subButton = (
        <SidebarMenuSubButton
            isActive={pathname === subItem.url}
            className={`h-8 hover:text-primary transition-colors text-xs ${isSubLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}
            render={!isSubLocked ? <span /> : undefined}
        >
            <div className="flex items-center gap-2">
                <span>{subItem.title}</span>
                {isSubLocked && <Lock className="h-2.5 w-2.5 text-primary" />}
            </div>
        </SidebarMenuSubButton>
    );

    return (
        <SidebarMenuSubItem key={subItem.title}>
            {!isSubLocked ? (
                <Link href={subItem.url} className="w-full block" passHref>
                    {subButton}
                </Link>
            ) : (
                subButton
            )}
        </SidebarMenuSubItem>
    );
}
