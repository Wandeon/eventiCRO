declare module "@sentry/sveltekit" {
  export const init: any;
  export const captureException: any;
}
declare module "jsonwebtoken" {
  const jwt: any;
  export default jwt;
}
declare module "leaflet" {
  namespace L {
    interface Map {
      setView(...args: any[]): any;
    }
    function map(...args: any[]): Map;
    function tileLayer(...args: any[]): any;
    function marker(...args: any[]): any;
  }
  export = L;
}
declare module "svelte/store" {
  export function writable<T = any>(value?: T): any;
}
declare module "hono" {
  export class Hono {
    use(...args: any[]): any;
    get(...args: any[]): any;
    post(...args: any[]): any;
    route(...args: any[]): any;
    request(...args: any[]): any;
  }
  export interface Context {
    req: any;
    json: any;
    text: any;
    header: any;
    get(key: string): any;
    set(key: string, value: any): any;
  }
  export type Next = any;
}
declare module "bullmq" {
  interface ConnectionOptions {
    url?: string;
    [key: string]: any;
  }
  export class Worker {
    constructor(...args: any[]);
  }
}
