<script lang="ts">
  export let items: { label: string; icon?: string }[] = [];
</script>

<div class="scroll-x" style="padding-top:10px">
  {#each items as it}
    <div
      class="card"
      style="border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;align-items:center;min-width:90px;background:var(--chip)"
    >
      <div style="width:28px;height:28px;color:var(--text)">
        {@html it.icon ?? "🎉"}
      </div>
      <div class="small" style="margin-top:6px;color:var(--text)">
        {it.label}
      </div>
    </div>
  {/each}
</div>
