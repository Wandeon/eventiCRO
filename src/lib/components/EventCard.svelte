<script lang="ts">
  export let event: any;
  import { t } from '../i18n';
</script>

<article class="rounded-2xl shadow p-4 mb-4">
  <h2 class="text-lg font-semibold">{event.title}</h2>
  <p>{new Date(event.start_time).toLocaleString()}</p>
  <p>{event.city}</p>
  {#if event.price}
    <p>{event.price}</p>
  {:else}
    <p>{$t.event.free}</p>
  {/if}
</article>
