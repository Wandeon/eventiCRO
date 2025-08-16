declare module "@sveltejs/kit" {
  export interface RequestEvent {
    request: Request;
    url: URL;
    locals: Record<string, unknown>;
  }

  export type Resolve = (event: RequestEvent) => Promise<Response>;

  export type Handle = (input: {
    event: RequestEvent;
    resolve: Resolve;
  }) => Promise<Response>;

  export type HandleServerError = (input: {
    error: unknown;
    event: RequestEvent;
  }) => { message: string };

  export function error(status: number, message?: string): Error;
}
