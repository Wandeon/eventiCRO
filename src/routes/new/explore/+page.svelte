<script lang="ts">
  import SearchBar from "$lib/newui/components/SearchBar.svelte";
  import CategoryChips from "$lib/newui/components/CategoryChips.svelte";
  import EventCard from "$lib/newui/components/EventCard.svelte";
  import SectionHeader from "$lib/newui/components/SectionHeader.svelte";

  const chips = [
    { label: "Free Events" },
    { label: "Rock" },
    { label: "Festival" },
    { label: "Nightlife" },
    { label: "Live Performance" },
  ];
</script>

<div class="container" style="padding-top:24px">
  <h1 style="font-weight:800;letter-spacing:.4px">EUFORIA</h1>
  <div style="height:14px"></div>
  <SearchBar />
  <div style="height:18px"></div>
  <CategoryChips items={chips} />
</div>

<div class="container" style="margin-top:18px">
  <div class="card" style="overflow:hidden">
    <div style="position:relative">
      <img
        src="https://picsum.photos/seed/hero/1200/800"
        alt="Hero"
        style="width:100%;aspect-ratio:16/9;object-fit:cover"
      />
      <div style="position:absolute;inset:0;display:flex;align-items:flex-end">
        <div style="width:100%;height:68px;background:#5C0D2A;opacity:.9"></div>
      </div>
      <div style="position:absolute;bottom:14px;left:14px;font-weight:800">
        JASNA ZLOKIĆ @ PORAT
      </div>
      <div style="position:absolute;top:10px;right:10px">
        <span class="badge">14 Dec</span>
      </div>
    </div>
  </div>
</div>

<SectionHeader title="This Weekend Events" href="/new/explore" />

<div class="scroll-x container">
  <EventCard
    title="The Garden..."
    subtitle="The Garden Bre..."
    date="16 Mar"
    image="https://picsum.photos/seed/a/600/400"
  />
  <EventCard
    title="Brunch & lu..."
    subtitle="Maredo Zagreb"
    date="31 May"
    image="https://picsum.photos/seed/b/600/400"
  />
  <EventCard
    title="Feeling..."
    subtitle="SquareOne"
    date="02 Jun"
    image="https://picsum.photos/seed/c/600/400"
  />
</div>

<SectionHeader title="Live Performance" href="/new/explore" />
<div class="scroll-x container">
  <EventCard
    title="JASNA ZLOKI..."
    subtitle="Porat Club Split"
    date="14 Dec"
    image="https://picsum.photos/seed/d/600/400"
  />
  <EventCard
    title="Acoustic Eve"
    subtitle="Cafe Bar XX"
    date="18 Dec"
    image="https://picsum.photos/seed/e/600/400"
  />
</div>
