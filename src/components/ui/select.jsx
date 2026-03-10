"use client"

import * as React from "react";
import { Dropdown } from "primereact/dropdown";

import { cn } from "@/lib/utils";

const NULL_SENTINEL = "__base25_null_option__";

const toArray = (children) => React.Children.toArray(children);

const textFromNode = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (React.isValidElement(node)) return textFromNode(node.props.children);
  return "";
};

const Select = ({
  className,
  children,
  value,
  onValueChange,
  onChange,
  disabled,
  placeholder,
  ...props
}) => {
  const rootChildren = toArray(children);
  const trigger = rootChildren.find((child) => React.isValidElement(child) && child.type === SelectTrigger);
  const content = rootChildren.find((child) => React.isValidElement(child) && child.type === SelectContent);

  const triggerChildren = toArray(trigger?.props?.children);
  const valueNode = triggerChildren.find(
    (child) => React.isValidElement(child) && child.type === SelectValue
  );

  const resolvedPlaceholder =
    valueNode?.props?.placeholder ?? placeholder ?? trigger?.props?.placeholder;

  const collectItems = (nodes, acc = []) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === SelectItem) {
        acc.push({
          rawValue: child.props.value,
          value: child.props.value === null ? NULL_SENTINEL : child.props.value,
          labelNode: child.props.children,
          label: textFromNode(child.props.children),
          disabled: child.props.disabled,
          className: child.props.className,
        });
        return;
      }
      collectItems(child.props.children, acc);
    });
    return acc;
  };

  const options = collectItems(content?.props?.children);
  const normalizedValue = value === null ? NULL_SENTINEL : value;

  const triggerClassName = trigger?.props?.className;
  const panelClassName = content?.props?.className;

  return (
    <Dropdown
      value={normalizedValue}
      options={options}
      optionValue="value"
      optionLabel="label"
      disabled={disabled || trigger?.props?.disabled}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        triggerClassName,
        className
      )}
      panelClassName={cn(
        "z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        panelClassName
      )}
      placeholder={resolvedPlaceholder}
      itemTemplate={(option) => (
        <div
          className={cn(
            "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
            option?.className
          )}
        >
          {option?.labelNode}
        </div>
      )}
      valueTemplate={(option, templateProps) => {
        if (!option) {
          return (
            <span className="line-clamp-1 text-muted-foreground">
              {resolvedPlaceholder || templateProps.placeholder}
            </span>
          );
        }
        return <span className="line-clamp-1">{option.labelNode}</span>;
      }}
      onChange={(event) => {
        const nextValue = event.value === NULL_SENTINEL ? null : event.value;
        onValueChange?.(nextValue);
        onChange?.(event);
      }}
      {...props}
    />
  );
};

const SelectGroup = ({ children }) => <>{children}</>;
const SelectValue = () => null;
const SelectTrigger = ({ children }) => <>{children}</>;
const SelectContent = ({ children }) => <>{children}</>;
const SelectLabel = ({ children }) => <>{children}</>;
const SelectItem = () => null;
const SelectSeparator = () => null;
const SelectScrollUpButton = () => null;
const SelectScrollDownButton = () => null;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
