"use client";

import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  LifeBuoy,
  MessageSquareText,
  Settings2,
  Users,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const supportModules = [
  {
    title: "Chat Assignment",
    description: "Routing, agent availability, SLA, and queue controls.",
    href: "/support/chat-assignment",
    icon: Users,
    badge: "Routing",
  },
  {
    title: "Macros",
    description: "Reusable replies and keyboard shortcuts for operators.",
    href: "/support/macros",
    icon: Zap,
    badge: "Replies",
  },
  {
    title: "Team Management",
    description: "Members, roles, invitations, and workspace access.",
    href: "/settings/teams",
    icon: Settings2,
    badge: "Access",
  },
  {
    title: "Chat Analytics",
    description: "Conversation volume, response health, and agent metrics.",
    href: "/analytics/advanced",
    icon: BarChart3,
    badge: "Insights",
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-8 p-8 pb-24">
      <div className="flex flex-col gap-6 rounded-[32px] border border-border/50 bg-card p-8 shadow-premium-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LifeBuoy className="h-7 w-7" />
          </div>
          <div>
            <Badge className="mb-3 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              Support
            </Badge>
            <h1 className="text-3xl font-black tracking-tight">Support Center</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
              Manage the workspace support operation from one place.
            </p>
          </div>
        </div>
        <Button asChild className="h-11 rounded-xl px-5 font-black uppercase tracking-widest text-[10px]">
          <Link href="/inbox">
            <MessageSquareText className="mr-2 h-4 w-4" />
            Open Inbox
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {supportModules.map((module) => (
          <Card key={module.href} className="group border-border/50 shadow-premium-sm transition-all hover:border-primary/40 hover:shadow-premium">
            <CardContent className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-primary">
                  <module.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase tracking-widest">
                  {module.badge}
                </Badge>
              </div>
              <h2 className="text-lg font-black">{module.title}</h2>
              <p className="mt-2 min-h-[48px] text-sm font-medium leading-6 text-muted-foreground">
                {module.description}
              </p>
              <Button asChild variant="ghost" className="mt-6 w-full justify-between rounded-xl font-bold">
                <Link href={module.href}>
                  Open
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
