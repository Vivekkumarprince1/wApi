"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type LabelProps = React.ComponentProps<"label"> & {
  /** Render a required marker after the label text. The marker itself is hidden from screen readers — the underlying input should set aria-required. */
  required?: boolean
  /** Render an optional hint after the label text (e.g. "(optional)"). */
  optional?: boolean
}

function Label({ className, required, optional, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span
          aria-hidden="true"
          className="text-destructive"
          title="Required"
        >
          *
        </span>
      )}
      {optional && !required && (
        <span className="text-muted-foreground text-xs font-normal">
          (optional)
        </span>
      )}
    </label>
  )
}

export { Label }
