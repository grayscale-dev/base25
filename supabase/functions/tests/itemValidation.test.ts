import {
  ITEM_GROUP_KEYS,
  isValidGroupKey,
  validateMetadata,
} from "../_shared/itemValidation.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";

Deno.test("itemValidation recognizes allowed group keys", () => {
  assertEquals(ITEM_GROUP_KEYS, ["feedback", "roadmap", "changelog"]);
  assertEquals(isValidGroupKey("feedback"), true);
  assertEquals(isValidGroupKey("invalid"), false);
});

Deno.test("itemValidation validates feedback and changelog metadata", () => {
  assertEquals(
    validateMetadata("feedback", { type: "feature_request", priority: "high" }),
    { valid: true, message: "" },
  );
  assertEquals(
    validateMetadata("feedback", { type: "invalid" }),
    { valid: false, message: "Invalid feedback metadata.type" },
  );
  assertEquals(
    validateMetadata("changelog", { announcement_type: "release" }),
    { valid: true, message: "" },
  );
  assertEquals(
    validateMetadata("changelog", { announcement_type: "weekly" }),
    { valid: false, message: "Invalid changelog metadata.announcement_type" },
  );
});
