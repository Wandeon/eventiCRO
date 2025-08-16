// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { randomUUID } from "node:crypto";

interface Submission {
  id: string;
  created_at: Date;
  status: string;
  payload: Record<string, unknown>;
  reviewer: string | null;
  reviewed_at: Date | null;
  reason: string | null;
}

let submissions: Submission[] = [];
let events: { id: string }[] = [];

const initialSubmissions: Submission[] = [
  {
    id: "s1",
    created_at: new Date("2024-01-01T00:00:00Z"),
    status: "pending",
    payload: { title: "Event 1", start_time: "2024-01-01T10:00:00Z" },
    reviewer: null,
    reviewed_at: null,
    reason: null,
  },
  {
    id: "s2",
    created_at: new Date("2024-01-02T00:00:00Z"),
    status: "pending",
    payload: { title: "Event 2", start_time: "2024-01-02T10:00:00Z" },
    reviewer: null,
    reviewed_at: null,
    reason: null,
  },
  {
    id: "s3",
    created_at: new Date("2024-01-03T00:00:00Z"),
    status: "pending",
    payload: { title: "Event 3", start_time: "2024-01-03T10:00:00Z" },
    reviewer: null,
    reviewed_at: null,
    reason: null,
  },
];

function resetDB() {
  submissions = initialSubmissions.map((s) => ({ ...s }));
  events = [];
}

interface Database {
  (strings: TemplateStringsArray, ...values: unknown[]): unknown;
  json<T>(v: T): T;
}

const fakeDb: Database = (strings, ...values) => {
  const sql = strings.join(" ").replace(/\s+/g, " ").trim();
  if (
    sql.startsWith(
      "SELECT id, created_at, status, payload, reviewer, reviewed_at, reason FROM submissions",
    )
  ) {
    const status = values[0] as string;
    const limitPlus = values[values.length - 1] as number;
    let list = submissions.filter((s) => s.status === status);
    list.sort(
      (a, b) =>
        a.created_at.getTime() - b.created_at.getTime() ||
        a.id.localeCompare(b.id),
    );
    if (values.length === 4) {
      const cursorTime = new Date(values[1] as string);
      const cursorId = values[2] as string;
      list = list.filter(
        (s) =>
          s.created_at > cursorTime ||
          (s.created_at.getTime() === cursorTime.getTime() && s.id > cursorId),
      );
    }
    const rows = list.slice(0, limitPlus);
    return rows.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      status: s.status,
      payload: s.payload,
      reviewer: s.reviewer,
      reviewed_at: s.reviewed_at,
      reason: s.reason,
    }));
  }
  if (sql.startsWith("SELECT id, payload FROM submissions WHERE id")) {
    const id = values[0] as string;
    const s = submissions.find((s) => s.id === id);
    return s ? [{ id: s.id, payload: s.payload }] : [];
  }
  if (sql.startsWith("INSERT INTO events")) {
    const id = randomUUID();
    events.push({ id });
    return [{ id }];
  }
  if (
    sql.startsWith("UPDATE submissions") &&
    sql.includes("SET status = 'approved'")
  ) {
    const reviewer = values[0] as string;
    const id = values[1] as string;
    const s = submissions.find((s) => s.id === id);
    if (s) {
      s.status = "approved";
      s.reviewer = reviewer;
      s.reviewed_at = new Date();
      s.reason = null;
    }
    return [];
  }
  if (sql.startsWith("SELECT payload FROM submissions WHERE id")) {
    const id = values[0] as string;
    const s = submissions.find((s) => s.id === id);
    return s ? [{ payload: s.payload }] : [];
  }
  if (
    sql.startsWith("UPDATE submissions") &&
    sql.includes("SET status = 'rejected'")
  ) {
    const reviewer = values[0] as string;
    const reason = values[1] as string | undefined;
    const id = values[2] as string;
    const s = submissions.find((s) => s.id === id);
    if (s) {
      s.status = "rejected";
      s.reviewer = reviewer;
      s.reviewed_at = new Date();
      s.reason = reason ?? null;
    }
    return [];
  }
  throw new Error("Unknown SQL: " + sql);
};
fakeDb.json = <T>(v: T): T => v;

interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

interface Context {
  req: {
    query: (name: string) => string | null;
    param: (name: string) => string | undefined;
    header: (name: string) => string | undefined;
    json: () => Promise<Record<string, unknown>>;
  };
  get: (key: string) => unknown;
  set: (key: string, val: unknown) => void;
  json: (data: unknown, status?: number) => Response;
  text: (txt: string, status?: number) => Response;
  body: (data: BodyInit | null, status?: number) => Response;
}

type Handler = (c: Context) => Response | Promise<Response>;

class StubHono {
  getHandler?: Handler;
  approveHandler?: Handler;
  rejectHandler?: Handler;
  use() {}
  get(path: string, handler: Handler) {
    this.getHandler = handler;
  }
  post(path: string, handler: Handler) {
    if (path === "/:id/approve") this.approveHandler = handler;
    if (path === "/:id/reject") this.rejectHandler = handler;
  }
  async request(url: string, options: RequestOptions = {}) {
    const u = new URL(url, "http://localhost");
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    const body = options.body;
    const locals: Record<string, unknown> = { user: { sub: "tester" } };
    const c: Context = {
      req: {
        query: (name: string) => u.searchParams.get(name),
        param: (name: string) => {
          if (name === "id") {
            const parts = u.pathname.split("/");
            return parts[1] || "";
          }
          return undefined;
        },
        header: (name: string) => headers[name.toLowerCase()],
        json: async () => {
          if (!body) return {};
          const parsed = JSON.parse(body) as unknown;
          return typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)
            : {};
        },
      },
      get: (key: string) => locals[key],
      set: (key: string, val: unknown) => {
        locals[key] = val;
      },
      json: (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      text: (txt: string, status = 200) => new Response(txt, { status }),
      body: (data: BodyInit | null, status = 200) =>
        new Response(data, { status }),
    };
    if (method === "GET" && this.getHandler) {
      return this.getHandler(c);
    }
    if (
      method === "POST" &&
      u.pathname.endsWith("/approve") &&
      this.approveHandler
    ) {
      return this.approveHandler(c);
    }
    if (
      method === "POST" &&
      u.pathname.endsWith("/reject") &&
      this.rejectHandler
    ) {
      return this.rejectHandler(c);
    }
    throw new Error("Unknown route");
  }
}

mock.module("hono", { Hono: StubHono });
mock.module(new URL("../../src/server/db/client.ts", import.meta.url), {
  default: fakeDb,
  db: fakeDb,
});
mock.module(new URL("../../src/server/middleware/auth.ts", import.meta.url), {
  default: () => {},
});

const route = (await import("../../src/server/routes/admin/submissions.ts"))
  .default;

function getSubmission(id: string) {
  return submissions.find((s) => s.id === id)!;
}

test("lists submissions with pagination via next_cursor", async () => {
  resetDB();
  const res1 = await route.request("/?status=pending&limit=2");
  const body1 = await res1.json();
  assert.strictEqual(body1.items.length, 2);
  assert.ok(body1.next_cursor);
  const res2 = await route.request(
    `/?status=pending&limit=2&cursor=${encodeURIComponent(body1.next_cursor)}`,
  );
  const body2 = await res2.json();
  assert.strictEqual(body2.items.length, 1);
  assert.equal(body2.next_cursor, null);
});

test("approving and rejecting submissions updates database", async () => {
  resetDB();
  const approveRes = await route.request("/s1/approve", { method: "POST" });
  assert.strictEqual(approveRes.status, 200);
  const s1 = getSubmission("s1");
  assert.strictEqual(s1.status, "approved");
  assert.strictEqual(s1.reviewer, "tester");
  assert.ok(s1.reviewed_at instanceof Date);
  assert.strictEqual(events.length, 1);

  const rejectRes = await route.request("/s2/reject", {
    method: "POST",
    body: JSON.stringify({ reason: "spam" }),
    headers: { "content-type": "application/json" },
  });
  assert.strictEqual(rejectRes.status, 204);
  const s2 = getSubmission("s2");
  assert.strictEqual(s2.status, "rejected");
  assert.strictEqual(s2.reviewer, "tester");
  assert.ok(s2.reviewed_at instanceof Date);
  assert.strictEqual(s2.reason, "spam");
});
