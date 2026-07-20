"use client";

import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Brain,
  ClipboardList,
  Clock3,
  MessageSquareReply,
  Sparkles,
  TrendingUp,
  Workflow,
  Zap,
  ListChecks,
  Activity,
  Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import {
  fetchAutomationHubSummary,
  fetchAiIntents,
  fetchInteraktiveLists,
  fetchRules,
  fetchWhatsAppForms,
  getAnswerBotFAQs,
  getAnswerBotSettings,
  getAnswerBotSources,
  getAutomationStats,
} from '@/lib/api/automation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import FlashLoader from '@/components/ui/flash-loader';

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  countLabel: string;
  countValue: string;
  icon: any;
  gradient: string;
  badge?: string;
};

const safeArray = (value: any) => (Array.isArray(value) ? value : []);

export default function AutomationHubPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['automation-hub-summary'],
    queryFn: async () => {
      const [summaryRes, formsRes] = await Promise.allSettled([
        fetchAutomationHubSummary({ days: 7 }),
        fetchWhatsAppForms(),
      ]);

      const summaryPayload = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
      const formsPayload = formsRes.status === 'fulfilled' ? formsRes.value : null;

      const forms = safeArray(formsPayload);
      const publishedForms = forms.filter((form: any) => form.status === 'published').length;

      return {
        workflowsCount: summaryPayload?.workflowsCount || 0,
        autoRepliesCount: summaryPayload?.autoRepliesCount || 0,
        activeRulesCount: summaryPayload?.activeRulesCount || 0,
        aiIntentsCount: summaryPayload?.aiIntentsCount || 0,
        answerBotEnabled: !!summaryPayload?.answerBot?.enabled,
        answerBotSourcesCount: summaryPayload?.answerBot?.sourcesCount || 0,
        answerBotDraftFaqsCount: summaryPayload?.answerBot?.draftFaqsCount || 0,
        formsCount: forms.length,
        publishedFormsCount: publishedForms,
        interaktiveListsCount: summaryPayload?.interaktive?.total || 0,
        enabledInteraktiveCount: summaryPayload?.interaktive?.enabled || 0,
        quickflowsCount: summaryPayload?.quickflows?.total || 0,
        enabledQuickflowsCount: summaryPayload?.quickflows?.enabled || 0,
        executionOverview: summaryPayload?.executionOverview || { total: 0, success: 0, failed: 0, skipped: 0 },
        successRate: summaryPayload?.successRate || 0,
      };
    },
  });

  if (isLoading) return <FlashLoader />;

  const summary = data || {
    workflowsCount: 0,
    autoRepliesCount: 0,
    activeRulesCount: 0,
    aiIntentsCount: 0,
    answerBotEnabled: false,
    answerBotSourcesCount: 0,
    answerBotDraftFaqsCount: 0,
    formsCount: 0,
    publishedFormsCount: 0,
    interaktiveListsCount: 0,
    enabledInteraktiveCount: 0,
    quickflowsCount: 0,
    enabledQuickflowsCount: 0,
    executionOverview: { total: 0, success: 0, failed: 0, skipped: 0 },
    successRate: 0,
  };

  const totalAutomationAssets =
    summary.workflowsCount +
    summary.autoRepliesCount +
    summary.aiIntentsCount +
    summary.formsCount +
    summary.interaktiveListsCount +
    0;

  const moduleCards: ModuleCard[] = [
    {
      title: 'Visual Workflows',
      description: 'Complex branching automations, event triggers, and journey orchestration.',
      href: '/automation/workflows',
      countLabel: 'Workflows',
      countValue: String(summary.workflowsCount),
      icon: Workflow,
      gradient: 'from-blue-500 to-cyan-600',
      badge: 'Core',
    },
    {
      title: 'Auto Replies',
      description: 'Keyword and condition-based instant replies for high-volume inbound chats.',
      href: '/automation/auto-replies',
      countLabel: 'Rules',
      countValue: String(summary.autoRepliesCount),
      icon: MessageSquareReply,
      gradient: 'from-emerald-500 to-teal-600',
      badge: 'Fast Response',
    },
    {
      title: 'AnswerBots',
      description: 'Knowledge-trained assistant with draft FAQ approval and fallback logic.',
      href: '/automation/answerbot',
      countLabel: summary.answerBotEnabled ? 'Enabled' : 'Disabled',
      countValue: summary.answerBotEnabled
        ? `${summary.answerBotSourcesCount} sources`
        : `${summary.answerBotDraftFaqsCount} draft FAQs`,
      icon: Bot,
      gradient: 'from-indigo-500 to-violet-600',
      badge: 'AI',
    },
    {
      title: 'AI Intent Match',
      description: 'Intent-level NLP matching for fuzzy inbound phrasing and smart action routing.',
      href: '/automation/ai-intent-matching',
      countLabel: 'Intent Rules',
      countValue: String(summary.aiIntentsCount),
      icon: Brain,
      gradient: 'from-fuchsia-500 to-purple-600',
      badge: 'NLP',
    },
    {
      title: 'WhatsApp Forms',
      description: 'Interactive forms and flow-based data capture with response tracking.',
      href: '/automation/whatsapp-forms',
      countLabel: 'Published',
      countValue: `${summary.publishedFormsCount}/${summary.formsCount}`,
      icon: ClipboardList,
      gradient: 'from-amber-500 to-orange-600',
      badge: 'Lead Capture',
    },
    {
      title: 'Interaktive List',
      description: 'Tap-first list menus for triage, navigation, and guided support entry points.',
      href: '/automation/interaktive-list',
      countLabel: 'Enabled',
      countValue: `${summary.enabledInteraktiveCount}/${summary.interaktiveListsCount}`,
      icon: ListChecks,
      gradient: 'from-emerald-600 to-lime-600',
      badge: 'WhatsApp List',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Zap className="h-7 w-7 text-primary" />
              Flow Hub
              <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-primary/10 text-primary border-primary/20">
                {summary.activeRulesCount} Active Rules
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Unified command center for all WhatsApp automation systems.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/automation/workflows/builder/create">
              <Button className="rounded-xl h-10 px-4 font-bold">
                <Plus className="h-4 w-4 mr-2" />
                New Workflow
              </Button>
            </Link>
            <Link href="/automation/auto-replies">
              <Button variant="outline" className="rounded-xl h-10 px-4 font-bold">
                Quick Auto-Reply
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Automation Assets',
            value: String(totalAutomationAssets),
            icon: Activity,
            helper: 'Across all modules',
          },
          {
            label: '7-Day Executions',
            value: String(summary.executionOverview.total || 0),
            icon: TrendingUp,
            helper: `${summary.executionOverview.success || 0} successful`,
          },
          {
            label: 'Success Rate',
            value: `${summary.successRate}%`,
            icon: Sparkles,
            helper: 'From engine telemetry',
          },
          {
            label: 'Engine Pace',
            value: `${Math.round(((summary.executionOverview.total || 0) / 7) * 10) / 10}/day`,
            icon: Clock3,
            helper: 'Avg over last 7 days',
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="bg-card border border-border/60 rounded-3xl p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.helper}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
        {moduleCards.map((module, index) => (
          <Link key={module.title} href={module.href}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + index * 0.05 }}
              className="group h-full bg-card border border-border/60 rounded-[28px] p-5 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${module.gradient} text-white flex items-center justify-center shadow`}> 
                  <module.icon className="h-5 w-5" />
                </div>
                {module.badge ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-black">{module.badge}</Badge>
                ) : null}
              </div>

              <h3 className="mt-4 text-lg font-black tracking-tight text-foreground group-hover:text-primary transition-colors">
                {module.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>

              <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">{module.countLabel}</p>
                  <p className="text-sm font-black text-foreground">{module.countValue}</p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
