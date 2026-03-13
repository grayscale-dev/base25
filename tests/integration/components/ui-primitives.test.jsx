import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("primereact/checkbox", () => ({
  Checkbox: React.forwardRef(({ checked, onChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onChange?.({ checked: event.target.checked })}
      {...props}
    />
  )),
}));

vi.mock("primereact/inputswitch", () => ({
  InputSwitch: React.forwardRef(({ checked, onChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onChange?.({ value: event.target.checked })}
      {...props}
    />
  )),
}));

vi.mock("primereact/radiobutton", () => ({
  RadioButton: React.forwardRef(({ checked, value, onChange, ...props }, ref) => (
    <input
      ref={ref}
      type="radio"
      checked={Boolean(checked)}
      onChange={() => onChange?.({ value })}
      {...props}
    />
  )),
}));

vi.mock("primereact/dropdown", () => ({
  Dropdown: ({ options = [], value = "", placeholder, onChange, ...props }) => (
    <select
      aria-label="Prime Dropdown"
      value={value ?? ""}
      onChange={(event) => onChange?.({ value: event.target.value })}
      {...props}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("primereact/overlaypanel", () => ({
  OverlayPanel: React.forwardRef(({ children, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      toggle: () => setOpen((prev) => !prev),
      hide: () => setOpen(false),
    }));
    return open ? <div {...props}>{children}</div> : null;
  }),
}));

vi.mock("primereact/dialog", () => ({
  Dialog: React.forwardRef(({ visible, onHide, children, ...props }, ref) =>
    visible ? (
      <div ref={ref} {...props}>
        <button type="button" onClick={onHide}>
          close-prime-dialog
        </button>
        {children}
      </div>
    ) : null
  ),
}));

import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

describe("UI primitives", () => {
  test("checkbox and switch emit boolean updates", () => {
    const onCheckedChange = vi.fn();
    const onSwitchChange = vi.fn();

    render(
      <div>
        <Checkbox checked={false} onCheckedChange={onCheckedChange} aria-label="checkbox" />
        <Switch checked={false} onCheckedChange={onSwitchChange} aria-label="switch" />
      </div>
    );

    fireEvent.click(screen.getByLabelText("checkbox"));
    fireEvent.click(screen.getByLabelText("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(onSwitchChange).toHaveBeenCalledWith(true);
  });

  test("collapsible toggles content visibility", () => {
    render(
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger>Toggle Section</CollapsibleTrigger>
        <CollapsibleContent>Hidden Content</CollapsibleContent>
      </Collapsible>
    );

    expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Section" }));
    expect(screen.getByText("Hidden Content")).toBeInTheDocument();
  });

  test("dropdown menu opens and closes after item click", () => {
    const onItemClick = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onItemClick}>First Action</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "First Action" }));

    expect(onItemClick).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "First Action" })).not.toBeInTheDocument();
  });

  test("radio group and select update values", () => {
    const onRadioChange = vi.fn();
    const onSelectChange = vi.fn();

    render(
      <div>
        <RadioGroup defaultValue="a" onValueChange={onRadioChange}>
          <RadioGroupItem value="a" aria-label="radio-a" />
          <RadioGroupItem value="b" aria-label="radio-b" />
        </RadioGroup>

        <Select value="x" onValueChange={onSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="x">X</SelectItem>
            <SelectItem value={null}>None</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );

    fireEvent.click(screen.getByLabelText("radio-b"));
    expect(onRadioChange).toHaveBeenCalledWith("b");

    fireEvent.change(screen.getByLabelText("Prime Dropdown"), { target: { value: "__base25_null_option__" } });
    expect(onSelectChange).toHaveBeenCalledWith(null);
  });

  test("separator, table, and tabs render expected structures", () => {
    render(
      <div>
        <Separator data-testid="sep" orientation="vertical" decorative={false} />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Col</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel One</TabsContent>
          <TabsContent value="two">Panel Two</TabsContent>
        </Tabs>
      </div>
    );

    expect(screen.getByTestId("sep")).toHaveAttribute("role", "separator");
    expect(screen.getByText("Cell")).toBeInTheDocument();
    expect(screen.getByText("Panel One")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    expect(screen.getByText("Panel Two")).toBeInTheDocument();
  });

  test("dialog trigger opens content and close dismisses", () => {
    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
          <DialogClose>Close Dialog</DialogClose>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Dialog" }));
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Dialog" }));
    expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument();
  });
});
