import { test, expect } from "@playwright/test";

test("@fast marketing home renders and CTA is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /get started/i }).first()).toBeVisible();
});

test("@real workspace route redirects unauthenticated users to sign in", async ({ page }) => {
  await page.goto("/workspace/acme/feedback");
  await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=/i);
});
