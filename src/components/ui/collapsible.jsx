"use client"

import * as React from "react";

const CollapsibleContext = React.createContext(null);

const composeHandlers = (first, second) => (event) => {
  first?.(event);
  second?.(event);
};

const Collapsible = ({ open, defaultOpen = false, onOpenChange, children }) => {
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
    <CollapsibleContext.Provider value={{ open: currentOpen, setOpen }}>
      {children}
    </CollapsibleContext.Provider>
  );
};

const CollapsibleTrigger = React.forwardRef(
  ({ asChild = false, onClick, children, ...props }, ref) => {
    const context = React.useContext(CollapsibleContext);
    if (!context) {
      throw new Error("CollapsibleTrigger must be used within Collapsible");
    }

    const handleClick = () => {
      context.setOpen(!context.open);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref,
        "data-state": context.open ? "open" : "closed",
        onClick: composeHandlers(handleClick, composeHandlers(onClick, children.props.onClick)),
      });
    }

    return (
      <button
        type="button"
        ref={ref}
        onClick={composeHandlers(handleClick, onClick)}
        data-state={context.open ? "open" : "closed"}
        {...props}
      >
        {children}
      </button>
    );
  }
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef(({ children, ...props }, ref) => {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("CollapsibleContent must be used within Collapsible");
  }

  if (!context.open) {
    return null;
  }

  return (
    <div ref={ref} data-state={context.open ? "open" : "closed"} {...props}>
      {children}
    </div>
  );
});
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
