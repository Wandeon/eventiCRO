declare module "node:test" {
  export function test(name: string, fn: () => Promise<void> | void): void;
  export const mock: Record<string, unknown>;
  export default test;
}
declare module "node:assert/strict" {
  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    strictEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
  }
  const assert: Assert;
  export { assert as default };
}
declare module "node:child_process" {
  export function execSync(
    command: string,
    options?: { encoding?: string },
  ): string | Buffer;
}
declare module "node:crypto" {
  export function randomUUID(): string;
}
declare const process: {
  env: Record<string, string | undefined>;
};
declare class Buffer {
  static from(input: string | ArrayBuffer, encoding?: string): Buffer;
  toString(encoding?: string): string;
}
