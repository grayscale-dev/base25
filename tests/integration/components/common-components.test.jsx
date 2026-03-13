import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AppLink from "@/components/common/AppLink";
import RelativeDate, {
  formatExactDateTimeValue,
  formatRelativeDateValue,
} from "@/components/common/RelativeDate";
import PageEmptyState from "@/components/common/PageEmptyState";
import { StateBanner, StatePanel } from "@/components/common/StateDisplay";

describe("RelativeDate", () => {
  const now = new Date("2026-03-12T12:00:00.000Z");

  test("formats minute, hour, day, and date-only thresholds", () => {
    expect(
      formatRelativeDateValue("2026-03-12T11:01:00.000Z", { now })
    ).toMatch(/minute/i);
    expect(
      formatRelativeDateValue("2026-03-12T11:00:00.000Z", { now })
    ).toMatch(/hour/i);
    expect(
      formatRelativeDateValue("2026-03-11T12:00:00.000Z", { now })
    ).toMatch(/hour/i);
    expect(
      formatRelativeDateValue("2026-03-05T12:00:00.000Z", { now })
    ).toMatch(/day/i);

    const expectedDate = new Date("2026-03-04T12:00:00.000Z").toLocaleDateString();
    expect(
      formatRelativeDateValue("2026-03-04T12:00:00.000Z", { now })
    ).toBe(expectedDate);
  });

  test("renders tooltip with exact local datetime", () => {
    const { container } = render(<RelativeDate value="2026-03-12T11:45:00.000Z" />);
    const node = container.querySelector("time");
    expect(node).toBeTruthy();
    expect(node.tagName).toBe("TIME");
    expect(node).toHaveAttribute("title", formatExactDateTimeValue("2026-03-12T11:45:00.000Z"));
    expect(node).toHaveAttribute("dateTime", "2026-03-12T11:45:00.000Z");
  });

  test("falls back for invalid values", () => {
    render(<RelativeDate value="not-a-date" fallback="N/A" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(formatRelativeDateValue("not-a-date")).toBe("Unknown");
    expect(formatExactDateTimeValue("not-a-date")).toBe("Unknown");
  });
});

describe("AppLink", () => {
  test("renders local links with next/link anchor semantics", () => {
    render(<AppLink to="/pricing">Pricing</AppLink>);
    const anchor = screen.getByRole("link", { name: "Pricing" });
    expect(anchor).toHaveAttribute("href", "/pricing");
  });

  test("renders external and mailto links as plain anchors", () => {
    const { rerender } = render(
      <AppLink to="https://example.com">External</AppLink>
    );
    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
      "href",
      "https://example.com"
    );

    rerender(<AppLink to="mailto:hello@example.com">Email</AppLink>);
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com"
    );
  });
});

describe("state and empty components", () => {
  test("StateBanner renders action callback", () => {
    const onAction = vi.fn();
    render(
      <StateBanner
        tone="warning"
        message="Workspace blocked"
        action={onAction}
        actionLabel="Retry"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test("StatePanel supports primary and secondary actions", () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    render(
      <StatePanel
        tone="danger"
        title="Unable to load"
        description="Try again"
        action={primary}
        actionLabel="Retry"
        secondaryAction={secondary}
        secondaryActionLabel="Cancel"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
  });

  test("PageEmptyState renders title and description", () => {
    render(<PageEmptyState title="No items" description="Create one to start." />);
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Create one to start.")).toBeInTheDocument();
  });
});
