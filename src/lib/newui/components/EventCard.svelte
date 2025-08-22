<script lang="ts">
  export let title = "Event title";
  export let subtitle = "Venue • City";
  export let date = "14 Dec";
  export let image = "https://picsum.photos/seed/event/600/400";
  export let color = "#5C0D2A"; // band color
</script>

<div class="card" style="min-width:260px">
  <div style="position:relative">
    <img
      src={image}
      alt={title}
      style="width:100%;height:160px;object-fit:cover"
    />
    <div style="position:absolute;right:10px;top:10px">
      <span class="badge" style="background:var(--bg-elev)">{date}</span>
    </div>
    <div
      style="position:absolute;left:0;right:0;bottom:0;height:50px;background:{color};opacity:.9;border-bottom-left-radius:20px;border-bottom-right-radius:20px"
    ></div>
  </div>
  <div class="card-pad">
    <div style="font-weight:800;letter-spacing:.3px">{title}</div>
    <div class="subtitle" style="margin-top:4px">{subtitle}</div>
  </div>
</div>
