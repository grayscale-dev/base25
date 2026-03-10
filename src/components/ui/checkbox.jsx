"use client"

import * as React from "react";
import { Checkbox as PrimeCheckbox } from "primereact/checkbox";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => (
    <PrimeCheckbox
      ref={ref}
      binary
      checked={Boolean(checked)}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onChange={(event) => {
        onCheckedChange?.(Boolean(event.checked));
        onChange?.(event);
      }}
      {...props}
    />
  )
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
