import {
  ITEM_GROUP_KEYS,
  isValidGroupKey,
  validateMetadata,
} from "../../supabase/functions/_shared/itemValidation.ts";

describe("edge shared item validation", () => {
  test("recognizes valid group keys", () => {
    expect(ITEM_GROUP_KEYS).toEqual(["feedback", "roadmap", "changelog"]);
    expect(isValidGroupKey("feedback")).toBe(true);
    expect(isValidGroupKey("roadmap")).toBe(true);
    expect(isValidGroupKey("unknown")).toBe(false);
  });

  test("validates feedback metadata types and priorities", () => {
    expect(
      validateMetadata("feedback", { type: "feature_request", priority: "high" })
    ).toEqual({ valid: true, message: "" });
    expect(validateMetadata("feedback", { type: "invalid" })).toEqual({
      valid: false,
      message: "Invalid feedback metadata.type",
    });
    expect(validateMetadata("feedback", { priority: "urgent" })).toEqual({
      valid: false,
      message: "Invalid feedback metadata.priority",
    });
  });

  test("validates changelog announcement type", () => {
    expect(
      validateMetadata("changelog", { announcement_type: "release" })
    ).toEqual({ valid: true, message: "" });
    expect(
      validateMetadata("changelog", { announcement_type: "weekly" })
    ).toEqual({
      valid: false,
      message: "Invalid changelog metadata.announcement_type",
    });
  });

  test("rejects invalid metadata shapes", () => {
    expect(validateMetadata("feedback", null)).toEqual({
      valid: false,
      message: "metadata must be an object",
    });
    expect(validateMetadata("feedback", [])).toEqual({
      valid: false,
      message: "metadata must be an object",
    });
  });
});
