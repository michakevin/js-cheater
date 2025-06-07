import { test, expect } from "playwright/test";
import path from "path";

const fileUrl = path.resolve("src/popup/popup.html");

// simple e2e test that loads the popup and checks initial elements

test("popup loads with setup section visible", async ({ page }) => {
  await page.goto("file://" + fileUrl);
  await expect(page.locator("#setupSection")).toBeVisible();
});
