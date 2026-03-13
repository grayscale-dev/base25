import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const { isAuthenticated } = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
}));

vi.mock("@/api/base44Client", () => ({
  base44: {
    auth: {
      isAuthenticated,
    },
  },
}));

import ProtectedRoute from "@/components/auth/ProtectedRoute";

describe("ProtectedRoute", () => {
  beforeEach(() => {
    isAuthenticated.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/alerts",
        search: "?q=critical",
        origin: "https://base25.app",
        replace: vi.fn(),
      },
    });
  });

  test("renders children when authenticated", async () => {
    isAuthenticated.mockResolvedValue(true);

    render(
      <ProtectedRoute>
        <div>Secure content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText(/Checking authentication/i)).toBeInTheDocument();
    expect(await screen.findByText("Secure content")).toBeInTheDocument();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  test("redirects unauthenticated users to sign-in with returnTo", async () => {
    isAuthenticated.mockResolvedValue(false);

    render(
      <ProtectedRoute>
        <div>Secure content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledTimes(1);
    });

    const redirectTarget = new URL(window.location.replace.mock.calls[0][0]);
    expect(redirectTarget.pathname).toBe("/auth/sign-in");
    expect(redirectTarget.searchParams.get("returnTo")).toBe("/alerts?q=critical");
  });
});
