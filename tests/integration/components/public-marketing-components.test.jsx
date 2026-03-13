import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const { startWorkspaceLogin } = vi.hoisted(() => ({
  startWorkspaceLogin: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/start-workspace-login", () => ({ startWorkspaceLogin }));
vi.mock("@/components/common/PublicHeader", () => ({
  default: ({ currentPage }) => <div>Public Header [{currentPage}]</div>,
}));

import {
  MarketingCtaBanner,
  MarketingHeroActions,
} from "@/components/common/PublicMarketingBlocks";
import {
  ComparisonRows,
  FaqGrid,
  PlaceholderLogoCloud,
  PlanCard,
  SectionHeading,
  SectionShell,
  StatGrid,
} from "@/components/common/PublicMarketingPrimitives";
import PublicCapabilityPage from "@/components/common/PublicCapabilityPage";
import PublicFooter from "@/components/common/PublicFooter";
import PublicPageLayout from "@/components/common/PublicPageLayout";

describe("public marketing building blocks", () => {
  beforeEach(() => {
    startWorkspaceLogin.mockClear();
  });

  test("MarketingHeroActions triggers workspace login CTA", () => {
    render(<MarketingHeroActions />);

    fireEvent.click(screen.getByRole("button", { name: /start for \$30\/month/i }));
    expect(startWorkspaceLogin).toHaveBeenCalledTimes(1);
  });

  test("MarketingCtaBanner renders both actions and handles auth CTA", () => {
    render(
      <MarketingCtaBanner
        title="Run your product loop"
        description="Feedback, roadmap, changelog"
      />
    );

    expect(screen.getByText("Run your product loop")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start for \$30\/month/i }));
    expect(startWorkspaceLogin).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /see pricing/i })).toHaveAttribute("href", "/pricing");
  });

  test("primitive sections render expected content", () => {
    render(
      <div>
        <SectionShell id="test-shell">
          <SectionHeading
            eyebrow="Eyebrow"
            title="Section title"
            description="Section description"
            align="center"
          />
        </SectionShell>
        <StatGrid stats={[{ value: "1", label: "Inbox" }]} />
        <PlaceholderLogoCloud labels={["Acme", "Orbit"]} />
        <ComparisonRows
          rows={[
            { label: "Pricing", base25: "$30", alternatives: "Tiered" },
          ]}
        />
        <FaqGrid
          items={[{ question: "Is pricing flat?", answer: "Yes, one plan." }]}
        />
      </div>
    );

    expect(screen.getByText("Section title")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Is pricing flat?")).toBeInTheDocument();
  });

  test("PlanCard shows included bullets and CTA links", () => {
    render(
      <PlanCard
        bullets={["Feedback", "Roadmap", "Changelog"]}
        primaryLabel="Get Started"
        secondaryLabel="Explore"
      />
    );

    expect(screen.getByText("Feedback")).toBeInTheDocument();
    expect(screen.getByText("Roadmap")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/workspaces");
    expect(screen.getByRole("link", { name: /Explore/i })).toHaveAttribute("href", "/features");
  });

  test("PublicCapabilityPage renders workflow and stats", () => {
    render(
      <PublicCapabilityPage
        pageKey="feedback"
        eyebrow="Feedback"
        title="Centralize feedback"
        subtitle="Keep requests in one place"
        imageSrc="/feedback-page.png"
        imageAlt="Feedback screenshot"
        whyPoints={["Point A", "Point B"]}
        workflowSteps={["Step 1", "Step 2", "Step 3"]}
        valueStats={[
          { value: "Less noise", label: "for planning" },
          { value: "Faster", label: "prioritization" },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Centralize feedback" })).toBeInTheDocument();
    expect(screen.getByText("Point A")).toBeInTheDocument();
    expect(screen.getAllByText("Step 2").length).toBeGreaterThan(0);
    expect(screen.getByText("Less noise")).toBeInTheDocument();
  });

  test("PublicPageLayout and footer render shared chrome", () => {
    const { rerender } = render(
      <PublicPageLayout currentPage="home">
        <div>Body content</div>
      </PublicPageLayout>
    );

    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();

    rerender(<PublicFooter />);
    expect(screen.getByText("One plan: $30/month")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/features");
  });
});
