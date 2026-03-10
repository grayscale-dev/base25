"use client"

import * as React from "react";
import { InputSwitch } from "primereact/inputswitch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => (
    <InputSwitch
      ref={ref}
      checked={checked}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onChange={(event) => {
        onCheckedChange?.(Boolean(event.value));
        onChange?.(event);
      }}
      {...props}
    />
  )
);
Switch.displayName = "Switch";

export { Switch };
