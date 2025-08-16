import { test, expect } from '@playwright/test'

test('submission flow', async ({ page }) => {
  // Mock the submit endpoint to bypass backend validation/Friendly Captcha
  await page.route('**/api/submit', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ submission_id: 1 })
      })
    } else {
      await route.continue()
    }
  })

  await page.goto('/submit')

  // Inject a mock Friendly Captcha solution
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = 'frc-captcha-solution'
    input.value = 'test'
    document.querySelector('form')?.appendChild(input)
  })

  await page.fill('input[name="title"]', 'Playwright Test Event')
  await page.fill(
    'input[name="start_time"]',
    new Date(Date.now() + 3600000).toISOString()
  )

  const [response] = await Promise.all([
    page.waitForResponse((res) =>
      res.url().includes('/api/submit') && res.status() === 202
    ),
    page.click('button[type="submit"]')
  ])
  expect(response.ok()).toBeTruthy()

  await expect(
    page.getByText('Thanks! Your event was submitted for review.')
  ).toBeVisible()
})
