<script lang="ts">
  export let placeholder = "Where to ?";
</script>

<div class="row" style="gap:10px">
  <div
    style="flex:1;display:flex;align-items:center;gap:10px;background:var(--chip);border:1px solid var(--stroke);border-radius:999px;padding:10px 14px;"
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      ><circle cx="11" cy="11" r="7" stroke-width="2" /><path
        d="M20 20l-3.5-3.5"
        stroke-width="2"
      /></svg
    >
    <input class="input" {placeholder} />
  </div>
  <button class="btn icon" title="Filters">
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      ><path
        d="M4 6h16M7 12h10M10 18h4"
        stroke-width="2"
        stroke-linecap="round"
      /></svg
    >
  </button>
</div>
