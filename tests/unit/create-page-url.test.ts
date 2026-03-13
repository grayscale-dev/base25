import { createPageUrl } from "@/utils";

describe("createPageUrl", () => {
  test("maps known route names to canonical paths", () => {
    expect(createPageUrl("Home")).toBe("/");
    expect(createPageUrl("WorkspaceSettings")).toBe("/workspace-settings");
    expect(createPageUrl("ApiDocs")).toBe("/api-docs");
  });

  test("slugifies unknown names", () => {
    expect(createPageUrl("Custom Page Name")).toBe("/custom-page-name");
  });
});
