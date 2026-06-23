import Link from 'next/link';
import {
  Bot,
  ChevronRight,
  CreditCard,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const stats = [
  { label: 'Total Sales', value: 'INR 0', icon: CreditCard, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  { label: 'Orders', value: '0', icon: ShoppingCart, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30' },
  { label: 'Products', value: '0', icon: Package, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
  { label: 'Customers', value: '--', icon: Users, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
];

const modules = [
  {
    title: 'Product Catalog',
    description: 'Manage products, inventory, pricing, and catalog visibility.',
    icon: Package,
    href: '/commerce/catalog',
    badge: 'Catalog',
    tone: 'text-sky-600 bg-sky-50 border-sky-100 dark:bg-sky-950/30 dark:border-sky-900',
  },
  {
    title: 'Sales Orders',
    description: 'Track order status, fulfillment, payments, and customer updates.',
    icon: ShoppingCart,
    href: '/commerce/orders',
    badge: 'Orders',
    tone: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900',
  },
  {
    title: 'Checkout Bot',
    description: 'Configure WhatsApp checkout automation and selling flows.',
    icon: Bot,
    href: '/commerce/checkout-bot',
    badge: 'Automation',
    tone: 'text-violet-600 bg-violet-50 border-violet-100 dark:bg-violet-950/30 dark:border-violet-900',
  },
  {
    title: 'Store Settings',
    description: 'Set currency, tax, shipping, and payment preferences.',
    icon: Settings,
    href: '/commerce/settings',
    badge: 'Settings',
    tone: 'text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-900/60 dark:border-slate-800',
  },
];

const capabilities = [
  { title: 'Automated Selling', description: 'Guide product discovery and checkout from chat.', icon: Bot },
  { title: 'Payment Links', description: 'Send payment-ready order confirmations.', icon: CreditCard },
  { title: 'Fulfillment Updates', description: 'Keep customers informed after purchase.', icon: Truck },
];

export default function CommerceOverviewPage() {
  return (
    <main className="h-[calc(100vh-theme(spacing.20))] overflow-y-auto bg-muted/[0.02]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8 p-6 pb-24 lg:p-8">
        <section className="flex flex-col gap-4 border-b border-border/50 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-foreground">Commerce Engine</h1>
              <Badge variant="outline" className="h-7 rounded-md border-primary/20 bg-primary/5 px-3 text-[10px] font-black uppercase tracking-widest text-primary">
                Operational
              </Badge>
            </div>
            <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
              Manage products, orders, checkout automation, and store controls for WhatsApp commerce.
            </p>
          </div>
          <Button asChild className="h-11 rounded-md px-5 text-xs font-black uppercase tracking-widest">
            <Link href="/commerce/catalog">New Product</Link>
          </Button>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-lg border border-border/60 bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-md', item.tone)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="rounded-md text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Live
                </Badge>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-black tracking-tight">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Module Control Center</h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="group rounded-lg border border-border/60 bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-md border', module.tone)}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="rounded-md text-[9px] font-black uppercase tracking-widest">
                    {module.badge}
                  </Badge>
                </div>
                <h3 className="text-lg font-black tracking-tight transition group-hover:text-primary">{module.title}</h3>
                <p className="mt-2 min-h-10 text-sm font-medium leading-relaxed text-muted-foreground">{module.description}</p>
                <div className="mt-5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                  <span>Open Module</span>
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
                Checkout Intelligence
                <Sparkles className="h-5 w-5 text-amber-500" />
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Automation-ready commerce workflows</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {capabilities.map((item) => (
              <div key={item.title} className="rounded-lg border border-border/50 bg-muted/20 p-5">
                <item.icon className="mb-4 h-8 w-8 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-wide">{item.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
