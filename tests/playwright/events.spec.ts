import { test, expect, Page } from "@playwright/test";

test.describe("Event browsing", () => {
  test("event listing and detail navigation", async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto("/");
    const firstEventLink = page.locator('a[href^="/event/"]').first();
    await firstEventLink.waitFor();
    await firstEventLink.click();
    await expect(page).toHaveURL(/\/event\//);
    await expect(page.locator("h1")).toBeVisible();
  });
});
