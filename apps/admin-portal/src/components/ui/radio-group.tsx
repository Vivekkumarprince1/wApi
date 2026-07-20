"use client";

import * as React from "react";

/**
 * Dependency-free radio group. Minimal API used by admin pages:
 *   <RadioGroup value onValueChange><RadioGroupItem value id /></RadioGroup>
 * Supports the `peer` + `peer-data-[state=checked]` styling pattern via a
 * hidden native input.
 */

interface Ctx {
  value: string;
  onValueChange: (v: string) => void;
  name: string;
}
const RadioCtx = React.createContext<Ctx | null>(null);

export function RadioGroup({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const name = React.useId();
  return (
    <RadioCtx.Provider value={{ value, onValueChange, name }}>
      <div role="radiogroup" className={className}>
        {children}
      </div>
    </RadioCtx.Provider>
  );
}

export function RadioGroupItem({
  value,
  id,
  className,
}: {
  value: string;
  id?: string;
  className?: string;
}) {
  const ctx = React.useContext(RadioCtx);
  if (!ctx) throw new Error("RadioGroupItem must be used within RadioGroup");
  const checked = ctx.value === value;
  return (
    <input
      type="radio"
      id={id}
      name={ctx.name}
      checked={checked}
      onChange={() => ctx.onValueChange(value)}
      data-state={checked ? "checked" : "unchecked"}
      className={className}
    />
  );
}
