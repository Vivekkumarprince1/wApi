"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
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
  UserPlus,
  CreditCard,
  Lock,
  Store,
  BarChart,
  Grid,
  LayoutGrid,
  ChevronDown,
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
import { useFeatureGate } from "@/store/auth-store";
import { useQuery } from "@tanstack/react-query";
import { getWABASettings } from "@/lib/api/settings";

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
  children?: SidebarChildItem[];
};

type SidebarGroupDef = {
  label: string;
  items: SidebarItem[];
};

import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { BrandMark } from "@/components/layout/brand-mark";

export function AppSidebar({ ...props }: React.ComponentProps<typeof ShadSidebar>) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  const { data: wabaSettings } = useQuery({
    queryKey: ['waba-settings'],
    queryFn: async () => {
      const response: any = await getWABASettings();
      return response?.waba || response || {};
    }
  });

  const isWabaConnected = !!wabaSettings?.hasToken;

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
  }, [navGroups, pathname]);

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
            <Link href="/" className="group flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <BrandMark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
                <div
                  title={isWabaConnected ? "WhatsApp Business Account connected" : "WhatsApp Business Account disconnected"}
                  aria-label={isWabaConnected ? "WhatsApp Business Account connected" : "WhatsApp Business Account disconnected"}
                  className={`h-2 w-2 shrink-0 rounded-full ${isWabaConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`}
                />
            </Link>

            <div className="group-data-[collapsible=icon]:hidden">
                <WorkspaceSwitcher />
            </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 scrollbar-hide">
        {navGroups.map((group) => (
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
        ))}
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
}: {
  item: SidebarItem;
  isActive: (url: string) => boolean;
  openSections: Record<string, boolean>;
  toggleSection: (title: string) => void;
}) {
  const pathname = usePathname();
  
  // Call hook at top level of component
  const featureGate = useFeatureGate(item.feature || "");
  const isLocked = item.feature ? !featureGate.gate.allowed : false;
  
  const hasChildren = Boolean(item.children?.length);
  const isItemActive = hasChildren
    ? isActive(item.url) || item.children!.some((child: any) => isActive(child.url))
    : isActive(item.url);
  const isExpanded = Boolean(openSections[item.title]);

  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        render={<Link href={isLocked ? '#' : item.url} />}
        tooltip={item.title}
        isActive={isItemActive}
        className={`h-11 hover:bg-muted/50 transition-all duration-300 data-[active=true]:shadow-sm rounded-xl px-3 data-[active=true]:bg-primary/10 data-[active=true]:text-primary ${isLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}
      >
        <item.icon className="size-5" />
        <span className="font-bold flex items-center justify-between gap-2 tracking-tight flex-1">
          <div className="flex items-center gap-2">
            {item.title}
            {isLocked && <Lock className="h-3 w-3 text-primary animate-pulse" />}
          </div>
        </span>
      </SidebarMenuButton>

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

    return (
        <SidebarMenuSubItem key={subItem.title}>
            <SidebarMenuSubButton
                render={<Link href={isSubLocked ? '#' : subItem.url} />}
                isActive={pathname === subItem.url}
                className={`h-8 hover:text-primary transition-colors text-xs ${isSubLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`}
            >
                <div className="flex items-center gap-2">
                    <span>{subItem.title}</span>
                    {isSubLocked && <Lock className="h-2.5 w-2.5 text-primary" />}
                </div>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}
