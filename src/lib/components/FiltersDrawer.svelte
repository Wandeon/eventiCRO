<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../i18n';
  export let filters = { q: '', city: '', category: '', from: '', to: '', radius_km: '', verified: false };
  const dispatch = createEventDispatcher();
  function apply() {
    dispatch('change', filters);
  }
</script>

<form on:submit|preventDefault={apply} class="mb-4 flex flex-wrap gap-2">
  <input type="search" class="border p-2" placeholder={$t.nav.search} bind:value={filters.q} />
  <input type="text" class="border p-2" placeholder={$t.filters.city} bind:value={filters.city} />
  <input type="text" class="border p-2" placeholder={$t.filters.category} bind:value={filters.category} />
  <input type="date" class="border p-2" aria-label={$t.filters.date_from} bind:value={filters.from} />
  <input type="date" class="border p-2" aria-label={$t.filters.date_to} bind:value={filters.to} />
  <input type="number" class="border p-2" placeholder={$t.filters.radius} bind:value={filters.radius_km} />
  <label class="flex items-center gap-1"><input type="checkbox" bind:checked={filters.verified} />{$t.filters.verified}</label>
  <button type="submit" class="p-2 bg-blue-500 text-white rounded">{$t.filters.title}</button>
</form>
