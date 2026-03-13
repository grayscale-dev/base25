import { parseWorkspaceSlug } from "@/lib/workspace-join";

describe("parseWorkspaceSlug", () => {
  test("parses direct slug and workspace route", () => {
    expect(parseWorkspaceSlug("acme", "https://base25.app")).toBe("acme");
    expect(parseWorkspaceSlug("/workspace/Acme/feedback", "https://base25.app")).toBe("acme");
  });

  test("parses URL and workspace query param", () => {
    expect(parseWorkspaceSlug("https://base25.app/workspace/demo/roadmap")).toBe("demo");
    expect(parseWorkspaceSlug("https://base25.app/join-workspace?workspace=TEAM")).toBe("team");
  });

  test("returns null for empty input and tokenizes raw join-workspace path", () => {
    expect(parseWorkspaceSlug("")).toBeNull();
    expect(parseWorkspaceSlug("/join-workspace")).toBe("join-workspace");
  });
});
