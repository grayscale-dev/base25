import {
  getGroupLabel,
  getGroupColor,
  normalizeGroupKey,
  sanitizeStatusKey,
  getPriorityLabel,
  getPriorityColor,
  getMetadataShapeForGroup,
  validateMetadata,
} from "@/lib/item-groups";

describe("item group helpers", () => {
  test("group labels and colors with fallback", () => {
    expect(getGroupLabel("feedback")).toBe("Feedback");
    expect(getGroupLabel("unknown", "Fallback")).toBe("Fallback");

    expect(getGroupColor("roadmap")).toMatch(/^#/);
    expect(getGroupColor("unknown", "#111111")).toBe("#111111");
  });

  test("group and status normalization", () => {
    expect(normalizeGroupKey("ROAdMap")).toBe("roadmap");
    expect(normalizeGroupKey("bad", "feedback")).toBe("feedback");
    expect(sanitizeStatusKey("  In Progress!! ")).toBe("in_progress");
  });

  test("priority label and color", () => {
    expect(getPriorityLabel("critical")).toBe("Critical");
    expect(getPriorityLabel("missing")).toBe("No Priority");

    expect(getPriorityColor("medium")).toMatch(/^#/);
    expect(getPriorityColor("missing")).toMatch(/^#/);
  });

  test("metadata shape and validation", () => {
    expect(getMetadataShapeForGroup("feedback")).toHaveProperty("type");
    expect(getMetadataShapeForGroup("roadmap")).toEqual({});
    expect(getMetadataShapeForGroup("changelog")).toHaveProperty("announcement_type");

    expect(validateMetadata("feedback", { type: "feature_request", priority: "high" })).toEqual({ valid: true, message: "" });
    expect(validateMetadata("feedback", { type: "invalid" }).valid).toBe(false);
    expect(validateMetadata("feedback", null).valid).toBe(false);
    expect(validateMetadata("changelog", { announcement_type: "hotfix" }).valid).toBe(true);
    expect(validateMetadata("changelog", { announcement_type: "bad" }).valid).toBe(false);
  });
});
