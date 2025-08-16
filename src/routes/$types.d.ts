export interface PageLoadEvent {
  fetch: typeof fetch;
}

export type PageLoad = (
  event: PageLoadEvent,
) => Promise<Record<string, unknown>>;
