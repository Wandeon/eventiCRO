<script lang="ts">
  import { onMount } from 'svelte';

  onMount(async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
</script>

<slot />
