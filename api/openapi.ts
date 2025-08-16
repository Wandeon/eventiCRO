// api/openapi.ts — serve OpenAPI JSON/YAML
// References:
// - openapi/openapi.yaml (source of truth)
// - project-baseline-index.md → PR-1
// - deployment-docs.md → schemathesis runs against /api/openapi.json
// - security-headers-csp.md → API caching guidance (no-store at proxy level)

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import YAML from 'yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SPEC_PATH = path.resolve(__dirname, '../openapi/openapi.yaml')

// Simple on-disk cache with mtime validation
let cachedYaml: string | null = null
let cachedJson: string | null = null
let cachedEtag: string | null = null
let cachedMtimeMs = 0

async function loadSpec() {
  const st = await stat(SPEC_PATH)
  if (!cachedYaml || st.mtimeMs !== cachedMtimeMs) {
    cachedYaml = await readFile(SPEC_PATH, 'utf8')
    const doc = YAML.parse(cachedYaml)
    cachedJson = JSON.stringify(doc)
    cachedEtag = createHash('sha1').update(cachedJson).digest('hex')
    cachedMtimeMs = st.mtimeMs
  }
  return { yaml: cachedYaml!, json: cachedJson!, etag: cachedEtag! }
}

const route = new Hono()

route.get('/openapi.json', async (c) => {
  try {
    const { json, etag } = await loadSpec()

    // Conditional GET support
    const inm = c.req.header('if-none-match')
    if (inm && inm === etag) {
      return c.body(null, 304)
    }

    c.header('Content-Type', 'application/json; charset=utf-8')
    c.header('ETag', etag)
    // Proxy (Caddy) will add Cache-Control: no-store per security-headers-csp.md
    return c.body(json)
  } catch (err) {
    throw new HTTPException(500, { message: 'Failed to load OpenAPI spec' })
  }
})

// Optional YAML endpoint for humans/tools
route.get('/openapi.yaml', async (c) => {
  try {
    const { yaml, etag } = await loadSpec()
    const inm = c.req.header('if-none-match')
    if (inm && inm === etag) {
      return c.body(null, 304)
    }
    c.header('Content-Type', 'application/yaml; charset=utf-8')
    c.header('ETag', etag)
    return c.body(yaml)
  } catch (err) {
    throw new HTTPException(500, { message: 'Failed to load OpenAPI spec' })
  }
})

export default route
