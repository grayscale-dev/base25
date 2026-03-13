import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/screens/Home", () => ({ default: () => <div>Home Screen</div> }));
vi.mock("@/screens/About", () => ({ default: () => <div>About Screen</div> }));
vi.mock("@/screens/Features", () => ({ default: () => <div>Features Screen</div> }));
vi.mock("@/screens/Pricing", () => ({ default: () => <div>Pricing Screen</div> }));
vi.mock("@/screens/Feedback", () => ({ default: () => <div>Feedback Marketing</div> }));
vi.mock("@/screens/Roadmap", () => ({ default: () => <div>Roadmap Marketing</div> }));
vi.mock("@/screens/Changelog", () => ({ default: () => <div>Changelog Marketing</div> }));
vi.mock("@/screens/AuthSignIn", () => ({ default: () => <div>Sign In Screen</div> }));
vi.mock("@/screens/AuthCallback", () => ({ default: () => <div>Callback Screen</div> }));

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound }));

describe("public route pages", () => {
  test("home page renders", async () => {
    const mod = await import("../../../app/page.jsx");
    render(<mod.default />);
    expect(screen.getByText("Home Screen")).toBeInTheDocument();
  });

  test("about/features/pricing pages render", async () => {
    const AboutPage = (await import("../../../app/about/page.jsx")).default;
    const FeaturesPage = (await import("../../../app/features/page.jsx")).default;
    const PricingPage = (await import("../../../app/pricing/page.jsx")).default;

    const { rerender } = render(<AboutPage />);
    expect(screen.getByText("About Screen")).toBeInTheDocument();

    rerender(<FeaturesPage />);
    expect(screen.getByText("Features Screen")).toBeInTheDocument();

    rerender(<PricingPage />);
    expect(screen.getByText("Pricing Screen")).toBeInTheDocument();
  });

  test("marketing capability pages render", async () => {
    const FeedbackPage = (await import("../../../app/feedback/page.jsx")).default;
    const RoadmapPage = (await import("../../../app/roadmap/page.jsx")).default;
    const ChangelogPage = (await import("../../../app/changelog/page.jsx")).default;

    const { rerender } = render(<FeedbackPage />);
    expect(screen.getByText("Feedback Marketing")).toBeInTheDocument();

    rerender(<RoadmapPage />);
    expect(screen.getByText("Roadmap Marketing")).toBeInTheDocument();

    rerender(<ChangelogPage />);
    expect(screen.getByText("Changelog Marketing")).toBeInTheDocument();
  });

  test("auth pages render", async () => {
    const SignInPage = (await import("../../../app/auth/sign-in/page.jsx")).default;
    const CallbackPage = (await import("../../../app/auth/callback/page.jsx")).default;

    const { rerender } = render(<SignInPage />);
    expect(screen.getByText("Sign In Screen")).toBeInTheDocument();

    rerender(<CallbackPage />);
    expect(screen.getByText("Callback Screen")).toBeInTheDocument();
  });

  test("api docs page is hard notFound", async () => {
    const ApiDocsPage = (await import("../../../app/api-docs/page.jsx")).default;
    await ApiDocsPage();
    expect(notFound).toHaveBeenCalled();
  });
});
