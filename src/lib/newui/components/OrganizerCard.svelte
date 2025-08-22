<script lang="ts">
  export let title = "Organizer";
  export let image = "https://picsum.photos/seed/org/400/400";
</script>

<div class="card" style="overflow:hidden">
  <img
    src={image}
    alt={title}
    style="width:100%;aspect-ratio:1/1;object-fit:cover"
  />
  <div class="card-pad" style="padding:10px 8px">
    <div style="font-weight:600">{title}</div>
  </div>
</div>
