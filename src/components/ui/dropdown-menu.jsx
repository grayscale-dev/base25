"use client";

import * as React from "react";
import { OverlayPanel } from "primereact/overlaypanel";

import { cn } from "@/lib/utils";

const DropdownMenuContext = React.createContext(null);

const composeHandlers = (first, second) => (event) => {
  first?.(event);
  second?.(event);
};

const DropdownMenu = ({ children }) => {
  const overlayRef = React.useRef(null);

  const toggle = React.useCallback((event) => {
    overlayRef.current?.toggle(event);
  }, []);

  const hide = React.useCallback(() => {
    overlayRef.current?.hide();
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ overlayRef, toggle, hide }}>
      {children}
    </DropdownMenuContext.Provider>
  );
};

const DropdownMenuTrigger = React.forwardRef(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) {
      throw new Error("DropdownMenuTrigger must be used within DropdownMenu");
    }

    const handleClick = (event) => context.toggle(event);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref,
        onClick: composeHandlers(handleClick, composeHandlers(onClick, children.props.onClick)),
      });
    }

    return (
      <button
        type="button"
        ref={ref}
        onClick={composeHandlers(handleClick, onClick)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = React.forwardRef(
  ({ className, children, align: _align, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) {
      throw new Error("DropdownMenuContent must be used within DropdownMenu");
    }

    return (
      <OverlayPanel
        ref={(node) => {
          context.overlayRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          className
        )}
        showCloseIcon={false}
        {...props}
      >
        {children}
      </OverlayPanel>
    );
  }
);
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef(
  ({ className, inset, asChild = false, children, onClick, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) {
      throw new Error("DropdownMenuItem must be used within DropdownMenu");
    }

    const handleClick = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        context.hide();
      }
    };

    const itemClassName = cn(
      "relative flex w-full cursor-default select-none items-center justify-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref,
        className: cn(itemClassName, children.props.className),
        onClick: composeHandlers(handleClick, children.props.onClick),
      });
    }

    return (
      <button
        type="button"
        ref={ref}
        className={itemClassName}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuGroup = ({ children }) => <>{children}</>;
const DropdownMenuPortal = ({ children }) => <>{children}</>;
const DropdownMenuSub = ({ children }) => <>{children}</>;
const DropdownMenuSubContent = ({ children }) => <>{children}</>;
const DropdownMenuSubTrigger = ({ children }) => <>{children}</>;
const DropdownMenuRadioGroup = ({ children }) => <>{children}</>;
const DropdownMenuCheckboxItem = DropdownMenuItem;
const DropdownMenuRadioItem = DropdownMenuItem;
const DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuShortcut = ({ className, ...props }) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
