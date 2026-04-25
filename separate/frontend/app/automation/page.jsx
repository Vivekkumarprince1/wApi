'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Brain,
  FormInput,
  MessageSquareMore,
  Sparkles,
  Workflow,
  Instagram,
  MessageCircleReply,
  ShieldCheck,
  Zap,
  ClipboardList,
  Layers3
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

const buckets = [
  {
    title: 'Shared Inbox Triggers',
    description: 'Trigger automations from customer messages, assignment changes, labels, campaign replies, and first-agent response events.',
    href: '/automation/workflows',
    icon: Workflow,
    status: 'Live',
    tone: 'emerald'
  },
  {
    title: 'Custom Auto Replies',
    description: 'Build simple keyword and business-hours replies for fast FAQ handling and after-hours routing.',
    href: '/automation/auto-replies',
    icon: MessageCircleReply,
    status: 'Live',
    tone: 'blue'
  },
  {
    title: 'AI Intent Match',
    description: 'Fallback semantic matching that routes ambiguous messages into the best workflow automatically.',
    href: '/automation/ai-intent-matching',
    icon: Brain,
    status: 'Live',
    tone: 'indigo'
  },
  {
    title: 'AnswerBot Knowledge Base',
    description: 'Train bot answers from URLs, text, and documents, then approve FAQs for production use.',
    href: '/automation/answerbot',
    icon: Bot,
    status: 'Live',
    tone: 'violet'
  },
  {
    title: 'WhatsApp Forms',
    description: 'Capture leads through forms and emit contact and tag events into the automation engine.',
    href: '/automation/whatsapp-forms',
    icon: FormInput,
    status: 'Live',
    tone: 'amber'
  },
  {
    title: 'Instagram Quickflows',
    description: 'Route Instagram comments, DMs, story replies, and mentions into keyword-based quickflows.',
    href: '/automation/instagram-quickflows',
    icon: Instagram,
    status: 'Live',
    tone: 'rose'
  }
];

const workflowSteps = [
  'Trigger: message, label, tag, campaign reply, or form submit',
  'Match: exact keyword, contains, AI intent, or workflow graph rules',
  'Action: reply, tag, assign, close, reopen, or send template',
  'Audit: execution logs, counters, and fallback handling'
];

const colorMap = {
  emerald: 'from-emerald-500/15 to-emerald-600/5 text-emerald-600 border-emerald-500/15',
  blue: 'from-sky-500/15 to-sky-600/5 text-sky-600 border-sky-500/15',
  indigo: 'from-indigo-500/15 to-indigo-600/5 text-indigo-600 border-indigo-500/15',
  violet: 'from-violet-500/15 to-violet-600/5 text-violet-600 border-violet-500/15',
  amber: 'from-amber-500/15 to-amber-600/5 text-amber-600 border-amber-500/15',
  rose: 'from-rose-500/15 to-rose-600/5 text-rose-600 border-rose-500/15'
};

export default function AutomationHubPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] dark:bg-slate-950 pb-16">
      <div className="max-w-[1400px] mx-auto px-6 pt-6">
        <PageHeader
          icon={Sparkles}
          title="Automation Hub"
          subtitle="A central place to build Interakt-style triggers, replies, AI fallback, forms, and channel-specific automations."
          actions={(
            <Link href="/automation/workflows/create" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition-transform hover:-translate-y-0.5">
              <Zap className="h-4 w-4" />
              New Workflow
            </Link>
          )}
        />

        <div className="grid gap-4 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 rounded-[2rem] border border-slate-200/80 bg-white/80 backdrop-blur-xl p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Workflow model</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">One engine, many entry points</h2>
              </div>
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                Matching Interakt
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-black text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm font-bold leading-relaxed text-slate-700 dark:text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 backdrop-blur-xl p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Current coverage</p>
            <div className="mt-4 space-y-3">
              {[
                ['Live triggers', 'message, tag, label, campaign, form, Instagram'],
                ['AI fallback', 'enabled through intent match'],
                ['Execution logs', 'stored and inspectable'],
                ['Automation UX', 'split across workflow pages']
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
                  <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buckets.map((bucket, index) => {
            const Icon = bucket.icon;
            return (
              <motion.div
                key={bucket.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`group rounded-[2rem] border bg-gradient-to-br p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${colorMap[bucket.tone]} dark:bg-slate-900/70`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/85 shadow-sm dark:bg-slate-950/60">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="rounded-full border border-current/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em]">
                    {bucket.status}
                  </div>
                </div>

                <h3 className="mt-5 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">{bucket.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{bucket.description}</p>

                <Link
                  href={bucket.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-900 transition-transform group-hover:translate-x-1 dark:text-white"
                >
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center gap-3">
              <Layers3 className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">What is already matched</h3>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                'Conversation label events',
                'Assignment / unassignment',
                'First agent reply tracking',
                'Campaign reply tracking',
                'AnswerBot FAQ generation',
                'Workflow graph execution'
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Remaining product depth</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>Interakt bundles these tools into one guided automation workspace. Your backend support is there, but the product surface still needs fuller orchestration.</p>
              <p>The biggest remaining work is a single entry point for rule building, trigger selection, fallback tuning, and reusable template/FAQ libraries.</p>
            </div>
            <div className="mt-5 rounded-2xl border border-indigo-500/15 bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-700 dark:text-indigo-300">
              Recommended next step: unify the existing pages into a single tabbed automation console.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
