# Code Tasks

## package.json

- [ ] Tests require pnpm and API_BASE_URL → install pnpm (`corepack enable pnpm && pnpm install`) and run tests with `API_BASE_URL=http://localhost:8787 npm test`

## scripts/check-api-base-url.mjs

- [ ] Script throws when `API_BASE_URL` is unset → default to local URL:
  ```diff
  - throw new Error("API_BASE_URL env var is required");
  + const base = process.env.API_BASE_URL ?? "http://localhost:8787";
  ```

## src/lib/map.ts

- [ ] `L.map` expects one argument and tile layer types are `unknown` → cast options and marker:
  ```diff
  - const map = L.map(el, { zoomControl: true, attributionControl: true });
  + const map = L.map(el, { zoomControl: true, attributionControl: true } as L.MapOptions);
  ```
  Run `npx tsc --noEmit` after editing.

## src/server/middleware/rate-limit.ts

- [ ] `c.raw` missing on context → use `c.req.raw` or type context:
  ```diff
  - c.raw.headers.get("cf-connecting-ip");
  + c.req.raw.headers.get("cf-connecting-ip");
  ```
  Run `npx tsc --noEmit`.

## src/server/routes/admin/submissions.ts

- [ ] Invalid `await` and undefined arguments → ensure `getSubmissions()` returns a promise and guard optional values:

  ```diff
  - const res = await getSubmissions(c.req.raw);
  - await ctx.insert(res.reason);
  + const res = await getSubmissions(c.req.raw);
  + if (res?.reason) await ctx.insert(res.reason);
  ```

  Then `npx tsc --noEmit`.

- [ ] `c.req.json()` returns `{}` so `body.reason` is invalid and `Context` lacks `body()` helper → type JSON body and return a plain response:
  ```diff
  - const body = await c.req.json();
  - if (body && typeof body.reason === "string") {
  -   reason = body.reason;
  - }
  + const body = await c.req.json<{ reason?: string }>();
  + if (typeof body.reason === "string") {
  +   reason = body.reason;
  + }
  @@
  - return c.body(null, 204);
  + return c.newResponse(null, 204);
  ```
  Run `npx tsc --noEmit`.

## src/server/routes/ingest.ts

- [ ] Transaction callback and query args type mismatch → define proper return type and parameter array:
  ```diff
  - const [row] = await sql.begin(async (tx) => {
  + const [row] = await sql.begin<{ id: string; inserted: boolean }>(async (tx) => {
      /* ... */
    });
  ```
  Run `npx tsc --noEmit`.

## src/server/routes/submit.ts

- [ ] `Record<string, unknown>` not assignable to `JSONValue` → validate and stringify request body:
  ```diff
  - await job.add(payload as Record<string, unknown>);
  + await job.add(JSON.parse(JSON.stringify(payload)) as JSONValue);
  ```
  Then `npx tsc --noEmit`.

## tests/admin/submissions.test.ts

- [ ] `mock.module` is `unknown` → cast module type:
  ```diff
  - mock.module
  + (mock.module as { default: unknown })
  ```
  Run `npx tsc --noEmit`.

## tests/schemathesis.test.ts

- [ ] `stdio` option not allowed in spawn options → remove property or cast:
  ```diff
  - spawn('schemathesis', ['run'], { stdio: 'inherit' });
  + spawn('schemathesis', ['run']);
  ```
  Run `npx tsc --noEmit`.
