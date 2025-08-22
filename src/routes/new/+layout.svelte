<script lang="ts">
  import "$lib/styles/newui.css";
  import TabBar from "$lib/newui/components/TabBar.svelte";
  export let data;
</script>

<div class="newui">
  <div class="main">
    <slot />
  </div>
  <TabBar />
</div>
