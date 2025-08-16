declare module "@sveltejs/kit" {
  export type Handle = (input: any) => any;
  export type HandleServerError = (input: any) => any;
  export function error(status: number, message?: string): Error;
}
