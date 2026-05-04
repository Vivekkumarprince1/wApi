"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Settings2,
  Phone,
  Code,
  Users,
  UserCheck,
  ShieldCheck,
  Building2,
  Tags,
  MessageSquareReply,
  UserCircle,
  Calendar,
  Layers,
} from "lucide-react";

const sidebarNavItems = [
  {
    title: "Quick Settings",
    href: "/settings",
    icon: Settings2,
  },
  {
    title: "WhatsApp Profile",
    href: "/settings/whatsapp-profile",
    icon: Phone,
  },
  {
    title: "Developer Settings",
    href: "/settings/developer",
    icon: Code,
  },
  {
    title: "Manage Teams",
    href: "/settings/teams",
    icon: Building2,
  },
  {
    title: "Manage Tags",
    href: "/settings/tags",
    icon: Tags,
  },
  {
    title: "Quick Replies",
    href: "/settings/quick-replies",
    icon: MessageSquareReply,
  },
  {
    title: "Member Profile",
    href: "/settings/member-profile",
    icon: UserCircle,
  },
  {
    title: "Manage Events",
    href: "/settings/developer/webhooks",
    icon: Calendar,
  },
  {
    title: "Configure Channels",
    href: "/settings/channels",
    icon: Layers,
  },
];

export function SettingsSidebarNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 scrollbar-hide",
        className
      )}
      {...props}
    >
      {sidebarNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap lg:whitespace-normal flex-shrink-0",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
