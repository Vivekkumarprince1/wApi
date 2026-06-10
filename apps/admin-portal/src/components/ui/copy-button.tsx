"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline copy-to-clipboard control. Used to make IDs / tokens / keys one-click
 * copyable across the admin pages. Shows a transient check on success.
 */
export function CopyButton({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy${label ? ` ${label}` : ""}`}
      aria-label={copied ? "Copied" : `Copy${label ? ` ${label}` : ""}`}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** Monospace ID chip with a copy affordance shown on hover. */
export function CopyId({ value, chars = 12 }: { value: string; chars?: number }) {
  const short = value.length > chars ? value.slice(-chars) : value;
  return (
    <span className="group/cid inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
      <span title={value}>{short}</span>
      <span className="opacity-0 transition-opacity group-hover/cid:opacity-100">
        <CopyButton value={value} label="ID" />
      </span>
    </span>
  );
}
