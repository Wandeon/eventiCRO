import test from 'node:test'
import { execSync } from 'node:child_process'

// Integration contract test using Schemathesis
// deployment-docs.md §CI instructs Schemathesis runs against /api/openapi.json

test('OpenAPI contract is valid', () => {
  const baseUrl = process.env.API_BASE_URL
  if (!baseUrl) {
    throw new Error('API_BASE_URL env var is required')
  }
  // Delegates to Schemathesis CLI; expects it to be installed in the environment
  execSync(
    `schemathesis run --checks all --rate-limit=50 --hypothesis-max-examples=50 --base-url=${baseUrl} ${baseUrl}/openapi.json`,
    { stdio: 'inherit' }
  )
})
