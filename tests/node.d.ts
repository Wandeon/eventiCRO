declare module "node:test" {
  export const test: any;
  export const mock: any;
  export default test;
}
declare module "node:assert/strict" {
  const assert: any;
  export { assert as default };
}
declare module "node:child_process" {
  export function execSync(...args: any[]): any;
}
declare module "node:crypto" {
  export function randomUUID(): string;
}
declare const process: any;
declare class Buffer {
  static from(input: any, encoding?: string): Buffer;
  toString(encoding?: string): string;
}
