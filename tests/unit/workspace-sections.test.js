import {
  WORKSPACE_ALIAS_SECTION,
  WORKSPACE_ALL_SECTION,
  WORKSPACE_DEFAULT_SECTION,
  getWorkspacePageName,
  normalizeWorkspaceSection,
  getDefaultWorkspaceSection,
  resolveWorkspaceSection,
  isWorkspaceSection,
} from "@/lib/workspace-sections";

describe("workspace sections", () => {
  test("normalization + page names", () => {
    expect(normalizeWorkspaceSection(" Feedback ")).toBe("feedback");
    expect(getWorkspacePageName("feedback")).toBe("Feedback");
    expect(getWorkspacePageName("items")).toBe("Items");
    expect(getWorkspacePageName("missing")).toBeNull();
  });

  test("default section respects role and public access", () => {
    expect(getDefaultWorkspaceSection("admin", false)).toBe(WORKSPACE_ALL_SECTION);
    expect(getDefaultWorkspaceSection("owner", false)).toBe(WORKSPACE_ALL_SECTION);
    expect(getDefaultWorkspaceSection("admin", true)).toBe(WORKSPACE_DEFAULT_SECTION);
    expect(getDefaultWorkspaceSection("contributor", false)).toBe(WORKSPACE_DEFAULT_SECTION);
  });

  test("resolve section supports alias and all gate", () => {
    expect(resolveWorkspaceSection(WORKSPACE_ALIAS_SECTION, "admin", false)).toBe("all");
    expect(resolveWorkspaceSection(WORKSPACE_ALIAS_SECTION, "contributor", false)).toBe("feedback");

    expect(resolveWorkspaceSection("all", "admin", false)).toBe("all");
    expect(resolveWorkspaceSection("all", "contributor", false)).toBe("feedback");

    expect(resolveWorkspaceSection("roadmap", "admin", false)).toBe("roadmap");
    expect(resolveWorkspaceSection("unknown", "admin", false)).toBeNull();
    expect(resolveWorkspaceSection("", "admin", false)).toBeNull();
  });

  test("workspace section validation includes alias", () => {
    expect(isWorkspaceSection("feedback")).toBe(true);
    expect(isWorkspaceSection(WORKSPACE_ALIAS_SECTION)).toBe(true);
    expect(isWorkspaceSection("all")).toBe(true);
    expect(isWorkspaceSection("bad")).toBe(false);
  });
});
