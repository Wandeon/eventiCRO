declare module "@sentry/sveltekit" {
  import type { CaptureContext, Options } from "@sentry/types";
  export function init(options: Options): void;
  export function captureException(
    exception: unknown,
    captureContext?: CaptureContext,
  ): string;
}

declare module "jsonwebtoken" {
  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string,
    options?: Record<string, unknown>,
  ): string;
  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: Record<string, unknown>,
  ): string | Record<string, unknown>;
}

declare module "leaflet" {
  namespace L {
    interface Map {
      setView(center: [number, number], zoom: number): Map;
    }
    function map(element: string | HTMLElement): Map;
    function tileLayer(
      urlTemplate: string,
      options?: Record<string, unknown>,
    ): unknown;
    function marker(
      latlng: [number, number],
      options?: Record<string, unknown>,
    ): unknown;
  }
  export = L;
}

declare module "svelte/store" {
  export interface Writable<T> {
    subscribe(run: (value: T) => void): () => void;
    set(value: T): void;
    update(updater: (value: T) => T): void;
  }
  export function writable<T>(value?: T): Writable<T>;
}

declare module "hono" {
  export class Hono {
    use(...handlers: unknown[]): void;
    get(path: string, ...handlers: unknown[]): void;
    post(path: string, ...handlers: unknown[]): void;
    route(path: string, app: Hono): void;
    request(input: RequestInfo, init?: RequestInit): Promise<Response>;
  }

  export interface Context {
    req: {
      query(name: string): string | undefined;
      param(name: string): string;
      header(name: string): string | undefined;
      json<T = unknown>(): Promise<T>;
    };
    json<T>(data: T, status?: number): Response;
    text(data: string, status?: number): Response;
    header(name: string, value: string): void;
    get<T = unknown>(key: string): T;
    set<T = unknown>(key: string, value: T): void;
  }
  export type Next = () => Promise<void>;
}

declare module "bullmq" {
  export interface ConnectionOptions {
    url?: string;
    [key: string]: unknown;
  }

  export interface Job<Data = unknown> {
    data: Data;
    id?: string;
    name: string;
  }

  export class Worker<Data = unknown> {
    constructor(
      name: string,
      processor: (job: Job<Data>) => Promise<unknown>,
      opts?: { connection?: ConnectionOptions },
    );
  }
}
