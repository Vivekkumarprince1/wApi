"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dependency-free checkbox matching the small API used by the admin pages:
 * `checked` + `onCheckedChange`.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  className,
  id,
  disabled,
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "h-4 w-4 shrink-0 rounded-sm border border-border flex items-center justify-center transition-colors",
        checked ? "bg-primary border-primary text-primary-foreground" : "bg-background",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {checked ? <Check className="h-3 w-3" /> : null}
    </button>
  );
}
