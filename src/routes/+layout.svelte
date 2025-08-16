<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import '../app.css';

  onMount(async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
</script>

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-white dark:bg-gray-800 p-2">Skip to content</a>
<div class="flex min-h-screen flex-col">
  <Header />
  <main id="main" class="flex-1">
    <slot />
  </main>
  <Footer />
</div>
