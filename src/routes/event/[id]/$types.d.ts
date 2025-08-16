export interface PageLoadEvent {
  fetch: typeof fetch;
  params: { id: string };
}

export type PageLoad = (
  event: PageLoadEvent,
) => Promise<Record<string, unknown>>;
