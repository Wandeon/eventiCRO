<script lang="ts">
  import SearchBar from "$lib/newui/components/SearchBar.svelte";
  import OrganizerCard from "$lib/newui/components/OrganizerCard.svelte";
</script>

<div class="container" style="padding-top:24px">
  <h1 style="font-weight:800">Organizers</h1>
  <div style="height:14px"></div>
  <SearchBar placeholder="Search organizer" />
</div>

<div
  class="container"
  style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px"
>
  <OrganizerCard
    title="Osjećaj"
    image="https://picsum.photos/seed/o1/600/600"
  />
  <OrganizerCard
    title="Like Zadar"
    image="https://picsum.photos/seed/o2/600/600"
  />
  <OrganizerCard
    title="Zagreb Beer Fest"
    image="https://picsum.photos/seed/o3/600/600"
  />
  <OrganizerCard
    title="Zadar Wine Festival"
    image="https://picsum.photos/seed/o4/600/600"
  />
</div>
