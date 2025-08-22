<script lang="ts">
  import SearchBar from "$lib/newui/components/SearchBar.svelte";
  import CategoryChips from "$lib/newui/components/CategoryChips.svelte";
  const chips = [
    { label: "Free Events" },
    { label: "Nightclub" },
    { label: "Bar" },
    { label: "Pub" },
    { label: "Rooftop" },
    { label: "Lounge" },
  ];
</script>

<div class="container" style="padding-top:24px">
  <SearchBar />
  <div style="height:10px"></div>
  <CategoryChips items={chips} />
</div>

<div class="container" style="margin-top:10px">
  <div
    class="card"
    style="height:60vh; border-radius:16px; overflow:hidden; position:relative"
  >
    <!-- Replace this container with actual MapLibre/Google Maps later -->
    <div
      style="position:absolute;inset:0;background:linear-gradient(180deg,#0f0f13,#121216)"
    ></div>
    <div style="position:absolute;left:16px;bottom:16px" class="badge">
      Map placeholder
    </div>
  </div>
</div>
