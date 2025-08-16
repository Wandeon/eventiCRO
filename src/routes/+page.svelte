<script lang="ts">
  import { onMount } from 'svelte';
  import EventCard from '../lib/components/EventCard.svelte';
  import FiltersDrawer from '../lib/components/FiltersDrawer.svelte';
  import { t } from '../lib/i18n';
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
  let events: any[] = [];
  let cursor: string | null = null;
  let loading = false;
  let filters = { q: '', city: '', category: '', from: '', to: '', radius_km: '', verified: false };

  async function loadMore() {
    if (loading) return;
    loading = true;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, String(v)); });
    if (cursor) params.append('cursor', cursor);
    const res = await fetch(`${API_BASE}/events?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      events = [...events, ...data.items];
      cursor = data.next_cursor;
    }
    loading = false;
  }
  function applyFilters(e: CustomEvent) {
    filters = e.detail;
    events = [];
    cursor = null;
    loadMore();
  }
  let sentinel: HTMLDivElement;
  function handleIntersect(entries: IntersectionObserverEntry[]) {
    if (entries[0].isIntersecting && cursor) loadMore();
  }
  onMount(() => {
    const observer = new IntersectionObserver(handleIntersect);
    observer.observe(sentinel);
    loadMore();
  });
</script>

<main>
  <h1>{$t.home.title}</h1>
  <FiltersDrawer {filters} on:change={applyFilters} />
  {#if events.length === 0 && !loading}<p>{$t.home.empty}</p>{/if}
  {#each events as event}<EventCard {event} />{/each}
  <div bind:this={sentinel}></div>
  {#if loading}<p>Loading...</p>{/if}
  {#if cursor}<button on:click={loadMore}>{$t.home.load_more}</button>{/if}
</main>
