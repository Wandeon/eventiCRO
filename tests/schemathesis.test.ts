// @ts-nocheck
import test from "node:test";
import { execSync } from "node:child_process";

// Integration contract test using Schemathesis
// deployment-docs.md §CI instructs Schemathesis runs against /api/openapi.json

test("OpenAPI contract is valid", (t) => {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    t.skip("API_BASE_URL env var is required");
    return;
  }

  try {
    execSync("schemathesis --version", { stdio: "ignore" });
  } catch {
    t.skip("Schemathesis CLI is required");
    return;
  }

  execSync(
    `schemathesis run --checks all --rate-limit=50 --hypothesis-max-examples=50 --base-url=${baseUrl} ${baseUrl}/openapi.json`,
    { stdio: "inherit" },
  );
});
