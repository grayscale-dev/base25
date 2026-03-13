import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const { startWorkspaceLogin } = vi.hoisted(() => ({
  startWorkspaceLogin: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/start-workspace-login", () => ({ startWorkspaceLogin }));

import Home from "@/screens/Home";
import Features from "@/screens/Features";
import Pricing from "@/screens/Pricing";
import About from "@/screens/About";
import Feedback from "@/screens/Feedback";
import Roadmap from "@/screens/Roadmap";
import Changelog from "@/screens/Changelog";

describe("public marketing screens", () => {
  beforeEach(() => {
    startWorkspaceLogin.mockClear();
  });

  test("Home page communicates positioning and pricing", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Collect feedback, share your roadmap, and publish your changelog/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\$30\/month/i).length).toBeGreaterThan(1);

    fireEvent.click(screen.getAllByRole("button", { name: /get started|start for \$30\/month/i })[0]);
    expect(startWorkspaceLogin).toHaveBeenCalled();
  });

  test("Features page shows three pillars and workflow section", () => {
    render(<Features />);

    expect(screen.getByRole("heading", { name: /Everything your team needs/i })).toBeInTheDocument();
    expect(screen.getAllByText("Feedback").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Roadmap").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Changelog").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Explore Feedback/i })).toHaveAttribute("href", "/feedback");
  });

  test("Pricing page keeps single-plan messaging", () => {
    render(<Pricing />);

    expect(screen.getByRole("heading", { name: /One clear plan/i })).toBeInTheDocument();
    expect(screen.getByText(/No modular pricing/i)).toBeInTheDocument();
    expect(screen.getByText("$30")).toBeInTheDocument();
  });

  test("About page reflects brand principles", () => {
    render(<About />);

    expect(screen.getByRole("heading", { name: /Built for teams that ship software/i })).toBeInTheDocument();
    expect(screen.getByText("Clarity over complexity")).toBeInTheDocument();
    expect(screen.getByText("Keep customers in the loop")).toBeInTheDocument();
  });

  test("Capability pages render distinct value props", () => {
    const { rerender } = render(<Feedback />);
    expect(screen.getByRole("heading", { name: /Centralize customer feedback/i })).toBeInTheDocument();

    rerender(<Roadmap />);
    expect(screen.getByRole("heading", { name: /Share priorities clearly/i })).toBeInTheDocument();

    rerender(<Changelog />);
    expect(screen.getByRole("heading", { name: /Show shipped progress/i })).toBeInTheDocument();
  });
});
