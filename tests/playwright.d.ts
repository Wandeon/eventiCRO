declare module "@playwright/test" {
  export interface Route {
    request(): { method(): string };
    fulfill(options: {
      status: number;
      contentType: string;
      body: string;
    }): Promise<void>;
    continue(): Promise<void>;
  }

  export interface APIResponse {
    url(): string;
    status(): number;
    ok(): boolean;
  }

  export interface Locator {
    first(): Locator;
    waitFor(): Promise<void>;
    click(): Promise<void>;
  }

  export interface Page {
    goto(url: string): Promise<void>;
    locator(selector: string): Locator;
    route(
      url: string | RegExp,
      handler: (route: Route) => Promise<void>,
    ): Promise<void>;
    fill(selector: string, value: string): Promise<void>;
    click(selector: string): Promise<void>;
    evaluate<R>(fn: () => R): Promise<R>;
    waitForResponse(
      predicate: (response: APIResponse) => boolean,
    ): Promise<APIResponse>;
    getByText(text: string): Locator;
  }

  export interface ExpectAPI {
    toHaveURL(url: RegExp): Promise<void>;
    toBeVisible(): Promise<void>;
    toBeTruthy(): void;
  }

  export const expect: (value: unknown) => ExpectAPI;

  export interface TestFn {
    (name: string, fn: (args: { page: Page }) => Promise<void>): void;
    describe(name: string, fn: () => void): void;
  }

  export const test: TestFn;
  export { Page, Route, APIResponse };
}
