<script lang="ts">
  export let title = "";
  export let href: string | null = null;
</script>

<div class="spread container" style="margin-top:var(--space-6)">
  <h2 class="section-title" style="margin:0">{title}</h2>
  {#if href}<a class="small" {href} style="color:var(--text)">View All</a>{/if}
</div>
