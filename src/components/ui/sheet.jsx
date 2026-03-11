"use client";

import * as React from "react";
import { Sidebar } from "primereact/sidebar";

import { cn } from "@/lib/utils";

const SheetContext = React.createContext(null);

const composeHandlers = (first, second) => (event) => {
  first?.(event);
  second?.(event);
};

const Sheet = ({ open, defaultOpen = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;

  const setOpen = React.useCallback(
    (nextOpen) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open: currentOpen, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
};

const SheetTrigger = React.forwardRef(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const context = React.useContext(SheetContext);
    if (!context) {
      throw new Error("SheetTrigger must be used within Sheet");
    }

    const handleClick = () => context.setOpen(true);

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
SheetTrigger.displayName = "SheetTrigger";

const SheetClose = React.forwardRef(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const context = React.useContext(SheetContext);
    if (!context) {
      throw new Error("SheetClose must be used within Sheet");
    }

    const handleClick = () => context.setOpen(false);

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
SheetClose.displayName = "SheetClose";

const SheetPortal = ({ children }) => <>{children}</>;

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

const sideToPosition = {
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
};

const SheetContent = React.forwardRef(
  ({ side = "right", className, children, onHide, transitionOptions, ...props }, ref) => {
    const context = React.useContext(SheetContext);
    if (!context) {
      throw new Error("SheetContent must be used within Sheet");
    }

    const mergedTransitionOptions = {
      timeout: 220,
      classNames: "base25-sheet-transition",
      ...transitionOptions,
    };

    return (
      <Sidebar
        visible={context.open}
        position={sideToPosition[side] || "right"}
        onHide={(event) => {
          context.setOpen(false);
          onHide?.(event);
        }}
        dismissable
        showCloseIcon
        modal
        className={cn("bg-background p-6 shadow-lg", className)}
        maskClassName="base25-overlay-mask fixed inset-0 z-50 bg-black/80"
        transitionOptions={mergedTransitionOptions}
        ref={ref}
        {...props}
      >
        {children}
      </Sidebar>
    );
  }
);
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }) => (
  <div
    className={cn("mb-4 flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
