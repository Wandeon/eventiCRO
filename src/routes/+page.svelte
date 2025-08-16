<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { createMap, addEventMarker } from '$lib/map';

  export let data: PageData;

  let events = [...data.initialEvents];
  let cursor: string | null = data.initialCursor;
  let map: L.Map;
  let markers: L.Marker[] = [];

  function addMarkers(newEvents: typeof events) {
    if (!map) return;
    for (const e of newEvents) {
      if (e.lat != null && e.lng != null) {
        markers.push(addEventMarker(map, e));
      }
    }
  }

  async function loadMore() {
    if (!cursor) return;
    const res = await fetch(`/api/events?cursor=${encodeURIComponent(cursor)}`);
    const json = await res.json();
    events = [...events, ...json.items];
    cursor = json.next_cursor;
    addMarkers(json.items);
  }

  onMount(() => {
    const el = document.getElementById('map');
    if (el) {
      map = createMap(el);
      addMarkers(events);
    }
  });
</script>

<div id="map" style="height:300px;" class="mb-4"></div>

{#if events.length === 0}
  <p>No events found.</p>
{:else}
  <ul>
    {#each events as event}
      <li class="mb-4 border p-2 rounded">
        <a href={`/event/${event.id}`} class="text-lg font-semibold">{event.title}</a>
        <div class="text-sm text-gray-600">{new Date(event.start_time).toLocaleString()}</div>
        {#if event.city}<div class="text-sm">{event.city}</div>{/if}
        {#if event.price}<div class="text-sm">{event.price}</div>{/if}
        {#if event.verified}<span class="text-xs text-green-600">Verified</span>{/if}
      </li>
    {/each}
  </ul>
  {#if cursor}
    <button on:click={loadMore} class="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Load more</button>
  {/if}
{/if}

