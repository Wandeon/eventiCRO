<script lang="ts">
  let dark = true;
  if (typeof window !== "undefined") {
    dark = (localStorage.getItem("newui-theme") ?? "dark") !== "light";
    document.documentElement.toggleAttribute("data-newui-dark", dark);
  }
  function toggleTheme() {
    dark = !dark;
    localStorage.setItem("newui-theme", dark ? "dark" : "light");
    document.documentElement.toggleAttribute("data-newui-dark", dark);
  }
</script>

<div class="container" style="padding-top:24px">
  <h1 style="font-weight:800">Account</h1>
</div>

<div class="container" style="margin-top:16px">
  <div class="card" style="padding:14px;border-radius:16px">
    <div class="row spread" style="padding:10px 6px">
      <div>Profile</div>
      <div>›</div>
    </div>
    <hr />
    <div class="row spread" style="padding:10px 6px">
      <div>Liked organizations</div>
      <div>›</div>
    </div>
    <hr />
    <div class="row spread" style="padding:10px 6px">
      <div>My events</div>
      <div>›</div>
    </div>
    <hr />
    <div class="row spread" style="padding:10px 6px">
      <div>Select theme mode</div>
      <label style="display:inline-flex;align-items:center;gap:8px">
        <input type="checkbox" on:change={toggleTheme} checked={dark} />
      </label>
    </div>
  </div>
</div>
