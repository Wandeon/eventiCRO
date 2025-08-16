import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/playwright',
  use: {
    baseURL: process.env.APP_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry'
  }
})
