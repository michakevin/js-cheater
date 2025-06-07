import { test, expect } from "playwright/test";
import path from "path";

const fileUrl = path.resolve("src/popup/popup.html");

// e2e tests for popup behaviour

test.use({ launchOptions: { args: ["--allow-file-access-from-files"] } });

test.describe("popup", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Mock clipboard API to avoid permission errors
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
      });
      // Basic chrome API mocks used by communication.js
      window.chrome = {
        tabs: {
          query: async () => [{ id: 1 }],
          sendMessage: async () => ({ scannerLoaded: false }),
        },
      };
    });
  });

  test("popup loads with setup section visible", async ({ page }) => {
    await page.goto("file://" + fileUrl);
    await expect(page.locator("#setupSection")).toBeVisible();
  });

  test("instructions shown after copy button click", async ({ page }) => {
    await page.goto("file://" + fileUrl);
    await page.getByRole("button", { name: /Scanner-Code kopieren/ }).click();
    await expect(page.locator("#instructions")).toBeVisible();
  });

  test("tab switching shows correct panels", async ({ page }) => {
    await page.goto("file://" + fileUrl);
    await page.evaluate(async () => {
      const ui = await import("./ui.js");
      ui.showScannerMode();
    });

    // search tab initially active
    const searchTab = page.locator("#searchTab");
    await expect(searchTab).toBeVisible();

    // switch to favorites
    await page.locator('[data-tab="favorites"]').click();
    const favTab = page.locator("#favoritesTab");
    await expect(favTab).toBeVisible();
    await expect(searchTab).not.toBeVisible();

    // switch to tools
    await page.locator('[data-tab="tools"]').click();
    const toolsTab = page.locator("#toolsTab");
    await expect(toolsTab).toBeVisible();
    await expect(favTab).not.toBeVisible();
  });
});
