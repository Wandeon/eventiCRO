<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n';
  import LangToggle from '../lib/components/LangToggle.svelte';
  import { goto } from '$app/navigation';
  let search = '';
  function submitSearch(e: Event) {
    e.preventDefault();
    goto('/?q=' + encodeURIComponent(search));
  }
  onMount(async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
</script>

<header class="p-4 shadow sticky top-0 bg-white flex justify-between items-center">
  <a href="/">EventiCRO</a>
  <form on:submit|preventDefault={submitSearch} class="flex-1 mx-4">
    <input type="search" placeholder={$t.nav.search} bind:value={search} class="border p-1 w-full" />
  </form>
  <nav class="flex gap-2 items-center">
    <a href="/submit">{$t.nav.submit}</a>
    <LangToggle />
  </nav>
</header>

<slot />

<footer class="p-4 text-center text-sm text-gray-500">
  <p>© OpenStreetMap contributors</p>
  <a href="/about">{$t.about.privacy}</a>
</footer>
