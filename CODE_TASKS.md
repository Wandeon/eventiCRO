# Code Tasks

## scripts/check-api-base-url.mjs
- [ ] API_BASE_URL env var is required for tests → run tests with `API_BASE_URL=http://localhost:8787 npm test`

## src/server/middleware/rate-limit.ts
- [ ] line 53 uses `any` → replace with a specific type, e.g.:
  ```ts
  const limit: number = (c.get('rateLimit') as number);
  ```

## src/server/routes/admin/submissions.ts
- [ ] lines 57,65,105,123 use `any` → define interfaces and replace casts, then run `npm run lint`

## src/server/routes/events.ts
- [ ] line 29 uses `any` → declare a proper type or `unknown`

## src/server/routes/ingest.ts
- [ ] lines 28,39,116 use `any` → replace with typed payload or `Record<string, unknown>`

## src/server/routes/submit.ts
- [ ] lines 24,153,157 use `any` → specify concrete types for request data

## tests/admin/submissions.test.ts
- [ ] multiple `any` usages (54,125,128,129,130,132,135,139,144,159,162,168) → add explicit test data types

## tsconfig.json
- [ ] No TypeScript config; `npx tsc --noEmit` shows help only → add `tsconfig.json` and rerun `npx tsc --noEmit`
