import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/events/${params.id}`);
  if (!res.ok) {
    throw error(res.status, await res.text());
  }
  const event = await res.json();
  return { event };
};
