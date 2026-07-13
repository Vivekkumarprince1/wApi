import * as React from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Inbox, ShieldCheck } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, statusClassName, statusLabel } from "@/lib/utils";
import type { ApplicationStatus, CredentialStatus, OfferStatus } from "@/types/career";

export const buttonVariants = cva(
  "inline-flex min-h-9 min-w-0 items-center justify-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-center text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-emerald-700",
        secondary: "bg-secondary text-secondary-foreground hover:bg-slate-800",
        outline: "border-border bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
        subtle: "border-border bg-card text-foreground hover:bg-muted",
        destructive: "bg-destructive text-white hover:bg-red-700",
      },
      size: {
        sm: "min-h-8 px-2.5 text-xs",
        default: "min-h-9 px-3",
        lg: "min-h-10 px-4",
        icon: "size-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild, children, ...props }: ButtonProps) {
  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      className: cn(buttonVariants({ variant, size, className }), children.props.className),
    });
  }

  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {children}
    </button>
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus | OfferStatus | CredentialStatus }) {
  return <Badge className={statusClassName(status)}>{statusLabel(status)}</Badge>;
}

export function Input(props: React.ComponentPropsWithoutRef<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        props.className
      )}
    />
  );
}

export function Select(props: React.ComponentPropsWithoutRef<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "min-h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        props.className
      )}
    />
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Surface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("min-w-0 rounded-lg border bg-card", className)}>{children}</section>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-balance">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center">
      <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Button asChild className="mt-4" variant="outline">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ title, rows = 4 }: { title: string; rows?: number }) {
  return (
    <div className="rounded-lg border bg-card p-5" aria-busy="true">
      <div className="mb-5 h-5 w-56 rounded bg-muted" />
      <span className="sr-only">{title}</span>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[1.5fr_1fr_0.6fr]">
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon ? <div className="rounded-md bg-muted p-2 text-primary">{icon}</div> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function WorkflowSteps({
  current,
}: {
  current: ApplicationStatus;
}) {
  const steps: ApplicationStatus[] = ["pending", "reviewing", "shortlisted", "offered", "hired"];
  const currentIndex = steps.indexOf(current);

  if (current === "rejected") {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        This application is closed. Candidate-safe feedback is available in the status message.
      </div>
    );
  }

  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label="Application progress">
      {steps.map((step, index) => {
        const isDone = index <= currentIndex;
        return (
          <li
            key={step}
            className={cn(
              "rounded-md border px-2.5 py-2 text-xs font-medium",
              isDone ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {statusLabel(step)}
          </li>
        );
      })}
    </ol>
  );
}

export function CapabilityStrip() {
  const items = [
    { label: "Permission checked", icon: ShieldCheck },
    { label: "Audit ready", icon: BriefcaseBusiness },
    { label: "Actionable records", icon: ArrowRight },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item.label} className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <item.icon className="mr-1 size-3.5" aria-hidden="true" />
          {item.label}
        </Badge>
      ))}
    </div>
  );
}
