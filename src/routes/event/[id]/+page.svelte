<script lang="ts">
  import { onMount } from 'svelte';
  export let data: { event: any };

  const { event } = data;

  let shareUrl = '';
  onMount(() => {
    shareUrl = window.location.href;

    if (event?.lat && event?.lng) {
      // lazy load Leaflet only in the browser
      import('leaflet').then((L) => {
        const map = L.map('map').setView([event.lat, event.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        L.marker([event.lat, event.lng]).addTo(map);
      });
    }
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }
</script>

<main>
  <nav class="mb-4">
    <a href="/">&larr; Back to events</a>
  </nav>

  {#if event}
    <h1>{event.title}</h1>
    <p>{formatDate(event.start_time)}</p>

    {#if event.lat && event.lng}
      <div id="map" style="height: 300px; width: 100%;"></div>
    {:else if event.city}
      <p>{event.city}</p>
    {/if}

    {#if event.organizer_name || event.organizer?.name}
      <section>
        <h2>Organizer</h2>
        <p>{event.organizer_name ?? event.organizer?.name}</p>
      </section>
    {/if}

    <section class="mt-4">
      <h2>Share</h2>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(event.title)}`}
        target="_blank"
        rel="noopener"
        >Share on X</a
      >
      |
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener"
        >Share on Facebook</a
      >
    </section>
  {:else}
    <p>Event not found.</p>
  {/if}
</main>
