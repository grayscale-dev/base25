"use client"

import * as React from "react";
import { RadioButton } from "primereact/radiobutton";

import { cn } from "@/lib/utils";

const RadioGroupContext = React.createContext(null);

const RadioGroup = React.forwardRef(
  (
    { className, value, defaultValue, onValueChange, name, children, ...props },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;
    const generatedName = React.useId();
    const resolvedName = name || generatedName;

    const setValue = React.useCallback(
      (nextValue) => {
        if (!isControlled) {
          setInternalValue(nextValue);
        }
        onValueChange?.(nextValue);
      },
      [isControlled, onValueChange]
    );

    return (
      <RadioGroupContext.Provider
        value={{ value: currentValue, setValue, name: resolvedName }}
      >
        <div ref={ref} className={cn("grid gap-2", className)} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = "RadioGroup";

const RadioGroupItem = React.forwardRef(
  ({ className, value, onChange, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    if (!context) {
      throw new Error("RadioGroupItem must be used within RadioGroup");
    }

    return (
      <RadioButton
        ref={ref}
        name={context.name}
        value={value}
        checked={context.value === value}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onChange={(event) => {
          context.setValue(event.value);
          onChange?.(event);
        }}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
