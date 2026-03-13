import {
  workspaceUrl,
  workspaceDefaultUrl,
  workspaceItemUrl,
  buildQuery,
} from "@/components/utils/workspaceUrl";

describe("workspace url utilities", () => {
  test("builds workspace paths", () => {
    expect(workspaceUrl("acme", "feedback")).toBe("/workspace/acme/feedback");
    expect(workspaceUrl("acme", null)).toBe("/workspace/acme/feedback");
    expect(workspaceUrl("acme", "all", { query: "?q=1" })).toBe("/workspace/acme/all?q=1");
  });

  test("default and item urls", () => {
    expect(workspaceDefaultUrl("acme", "admin", false)).toBe("/workspace/acme/all");
    expect(workspaceDefaultUrl("acme", "contributor", false)).toBe("/workspace/acme/feedback");
    expect(workspaceItemUrl("acme", "it-1")).toBe("/workspace/acme/item/it-1");
  });

  test("buildQuery helper", () => {
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ q: "a b", page: "2" })).toMatch(/^\?/);
    expect(buildQuery({ q: "a b", page: "2" })).toContain("q=a+b");
  });
});
