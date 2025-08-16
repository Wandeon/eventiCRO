<script lang="ts">
  import { onMount } from 'svelte';
  import EventMap from '../../lib/components/EventMap.svelte';
  import { t } from '../../lib/i18n';
  export let params: { id: string };
  let event: any = null;
  onMount(async () => {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/events/${params.id}`);
    if (res.ok) event = await res.json();
  });
</script>

{#if event}
  <article>
    <h1>{event.title}</h1>
    <p>{$t.event.when}: {new Date(event.start_time).toLocaleString()}</p>
    <p>{$t.event.where}: {event.venue_name} {event.city}</p>
    <EventMap lat={event.lat} lng={event.lng} address={event.address} />
  </article>
{:else}
  <p>Loading...</p>
{/if}

<svelte:head>
  {#if event}
    <script type="application/ld+json">
      {JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.title,
        startDate: event.start_time,
        endDate: event.end_time,
        location: {
          '@type': 'Place',
          name: event.venue_name,
          address: event.address,
          geo: event.lat && event.lng ? { '@type': 'GeoCoordinates', latitude: event.lat, longitude: event.lng } : undefined
        }
      })}
    </script>
  {/if}
</svelte:head>
