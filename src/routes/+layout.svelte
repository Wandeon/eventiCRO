<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';

  onMount(async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
</script>

<div class="min-h-screen flex flex-col">
  <Header />
  <slot />
  <Footer />
</div>

