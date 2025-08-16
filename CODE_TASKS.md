# Code Tasks

## package.json

- [ ] Tests rely on pnpm, which isn't installed offline → install with `corepack enable pnpm && pnpm install`
- [ ] `npm test` requires API_BASE_URL → run with `API_BASE_URL=http://localhost:8787 pnpm test`

## src/modules.d.ts

- [ ] Multiple `any` types → replace with explicit types and run `npm run lint`

## src/routes/$types.d.ts

- [ ] `any` types for route params → specify concrete types and run `npm run lint`

## src/routes/event/[id]/$types.d.ts

- [ ] `any` types for event routes → specify concrete types and run `npm run lint`

## src/sveltekit.d.ts

- [ ] `any` types in route typing → replace with explicit types and rerun `npm run lint`

## tests/node.d.ts

- [ ] `any` types for Node globals → define Node types or use `unknown`, then run `npm run lint`

## tests/playwright.d.ts

- [ ] `any` types for test helpers → replace with Playwright types and run `npm run lint`

## src/server/routes/admin/feature-flags.ts

- [ ] Parameter `c` implicitly has `any` type → type context: `import { Context } from 'hono'`

## src/server/routes/admin/submissions.ts

- [ ] Handler parameters `c` implicitly `any` → add `Context` type
- [ ] Invalid `await` operand and `string | undefined` passed where string expected → ensure API returns promises and handle undefined

## src/server/routes/events.ts

- [ ] Parameter `c` implicitly `any`; unknown[] passed to query → type parameters and validate array elements

## src/server/routes/ingest.ts

- [ ] Parameter `c` implicitly `any`; query call typed `never`; `IngestItem` missing `description` → define proper interfaces and ensure query args types

## src/server/routes/submit.ts

- [ ] Parameter `c` implicitly `any`; object with unknown properties not assignable to `JSONValue` → validate and cast request body fields

## src/workers/crawl.ts

- [ ] Generic `Job` type mismatch and `job` implicitly `any` → import `Job` from bullmq

## src/workers/media.ts

- [ ] Generic `Job` type mismatch and `job` implicitly `any` → import `Job` from bullmq

## src/workers/render.ts

- [ ] Generic `Job` type mismatch and `job` implicitly `any` → import `Job` from bullmq

## tests/admin/submissions.test.ts

- [ ] Argument of type `unknown` not assignable to `BodyInit` → cast to `string` or `Record<string, unknown>`

## tests/playwright/events.spec.ts

- [ ] `page` parameter implicitly `any` → type with `Page` from `@playwright/test`

## tests/playwright/submit.spec.ts

- [ ] `page` binding, `route` param, and `res` param implicitly `any` → type with Playwright's `Page`, `Route`, and `APIResponse`
