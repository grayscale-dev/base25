import React from "react";
import { render, screen } from "@testing-library/react";
import AssigneeDisplay from "@/screens/items/AssigneeDisplay";

describe("AssigneeDisplay", () => {
  test("shows fallback when no assignee exists", () => {
    render(<AssigneeDisplay assignee={null} fallback="Unassigned user" />);
    expect(screen.getByText("Unassigned user")).toBeInTheDocument();
  });

  test("renders initials when profile photo is absent", () => {
    render(
      <AssigneeDisplay
        assignee={{ name: "Ada Lovelace", profile_photo_url: null }}
      />
    );
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  test("renders photo when profile photo exists", () => {
    render(
      <AssigneeDisplay
        assignee={{
          name: "Grace Hopper",
          profile_photo_url: "https://example.com/grace.png",
        }}
      />
    );

    const image = screen.getByRole("img", { name: "Grace Hopper" });
    expect(image).toHaveAttribute("src", "https://example.com/grace.png");
  });
});
