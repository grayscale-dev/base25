import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const composeHandlers = (first, second) => {
  if (!first && !second) return undefined;
  return (event) => {
    first?.(event);
    second?.(event);
  };
};

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, children, onClick, ...props }, ref) => {
    const rawClassName = typeof className === "string" ? className : "";
    const useWorkspaceBrand = rawClassName.includes("bg-slate-900");
    const normalizedClassName = useWorkspaceBrand
      ? rawClassName
          .replace(/\bbg-slate-900\b/g, "")
          .replace(/\bhover:bg-slate-800\b/g, "")
          .trim()
      : className;
    const resolvedClassName = cn(
      buttonVariants({ variant, size }),
      normalizedClassName,
      useWorkspaceBrand && "base25-brand-button"
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        className: cn(resolvedClassName, children.props.className),
        onClick: composeHandlers(onClick, children.props.onClick),
        ref,
      });
    }

    return (
      <button
        className={resolvedClassName}
        ref={ref}
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    );
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
