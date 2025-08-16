import { test, expect } from '@playwright/test'

test('submission flow', async ({ page }) => {
  await page.goto('/submit')
  await page.fill('input[name="title"]', 'Playwright Test Event')
  await page.fill('input[name="start_time"]', new Date(Date.now() + 3600000).toISOString())
  await page.fill('input[name="captcha_token"]', 'test')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=submitted for review')).toBeVisible()
})
