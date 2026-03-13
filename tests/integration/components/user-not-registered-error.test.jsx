import React from "react";
import { render, screen } from "@testing-library/react";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";

describe("UserNotRegisteredError", () => {
  test("renders support guidance", () => {
    render(<UserNotRegisteredError />);

    expect(screen.getByRole("heading", { name: "Access Restricted" })).toBeInTheDocument();
    expect(screen.getByText(/not registered to use this application/i)).toBeInTheDocument();
    expect(screen.getByText(/Verify you are logged in with the correct account/i)).toBeInTheDocument();
  });
});
