"use client"

import * as React from "react";
import { Dialog as PrimeDialog } from "primereact/dialog";

import { cn } from "@/lib/utils";

const DialogContext = React.createContext(null);

const Dialog = ({ open, defaultOpen = false, onOpenChange, children }) => {
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
    <DialogContext.Provider value={{ open: currentOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
};

const composeHandlers = (first, second) => (event) => {
  first?.(event);
  second?.(event);
};

const DialogTrigger = React.forwardRef(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    if (!context) {
      throw new Error("DialogTrigger must be used within Dialog");
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
DialogTrigger.displayName = "DialogTrigger";

const DialogPortal = ({ children }) => <>{children}</>;

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogClose = React.forwardRef(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    if (!context) {
      throw new Error("DialogClose must be used within Dialog");
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
DialogClose.displayName = "DialogClose";

const DialogContent = React.forwardRef(
  ({ className, children, onHide, contentClassName, pt, transitionOptions, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    if (!context) {
      throw new Error("DialogContent must be used within Dialog");
    }

    const mergedTransitionOptions = {
      timeout: 180,
      classNames: "base25-dialog-transition",
      ...transitionOptions,
    };

    const mergedPt = {
      ...pt,
      header: {
        ...(pt?.header || {}),
        className: cn(
          "absolute right-4 top-4 z-10 m-0 border-0 bg-transparent p-0",
          pt?.header?.className
        ),
      },
      headerIcons: {
        ...(pt?.headerIcons || {}),
        className: cn("flex items-center", pt?.headerIcons?.className),
      },
      closeButton: {
        ...(pt?.closeButton || {}),
        className: cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          pt?.closeButton?.className
        ),
      },
      content: {
        ...(pt?.content || {}),
        className: cn("p-6", contentClassName, pt?.content?.className),
      },
    };

    return (
      <PrimeDialog
        visible={context.open}
        onHide={(event) => {
          context.setOpen(false);
          onHide?.(event);
        }}
        modal
        draggable={false}
        resizable={false}
        dismissableMask
        className={cn(
          "relative w-full max-w-lg border bg-background p-0 shadow-lg sm:rounded-lg",
          className
        )}
        maskClassName="base25-overlay-mask fixed inset-0 z-50 bg-black/80"
        transitionOptions={mergedTransitionOptions}
        pt={mergedPt}
        appendTo={typeof document !== "undefined" ? document.body : null}
        ref={ref}
        {...props}
      >
        {children}
      </PrimeDialog>
    );
  }
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn("mb-5 flex flex-col space-y-1.5 pr-10 text-center sm:text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn("mt-6 flex flex-col-reverse pt-2 sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
