<script lang="ts">
  import { onMount } from 'svelte';
  export let lat: number | null = null;
  export let lng: number | null = null;
  export let address: string | null = null;
  let mapEl: HTMLDivElement;
  onMount(async () => {
    if (lat != null && lng != null) {
      const L = await import('leaflet');
      const map = L.map(mapEl).setView([lat, lng], 13);
      L.tileLayer(`${import.meta.env.VITE_TILESERVER_URL}/{z}/{x}/{y}.png`, { maxZoom: 19 }).addTo(map);
      L.marker([lat, lng]).addTo(map);
    }
  });
</script>

{#if lat != null && lng != null}
  <div bind:this={mapEl} style="height:300px"></div>
{:else if address}
  <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank">Open in Maps</a>
{/if}
