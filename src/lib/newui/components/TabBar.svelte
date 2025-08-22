<script lang="ts">
  import { page } from "$app/stores";
  $: path = $page.url.pathname;
  const is = (p: string) => path === p;
  export const icons = {
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke-width="2"/></svg>`,
    org: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="7" width="18" height="13" rx="2" stroke-width="2"/><path d="M7 7V4h10v3" stroke-width="2"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M2 12h20M12 2c3 4 3 16 0 20M12 2c-3 4-3 16 0 20" stroke-width="2"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="7" width="18" height="12" rx="2" stroke-width="2"/><path d="M15 11h4v4h-4z" stroke-width="2"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4" stroke-width="2"/><path d="M4 20c2-4 14-4 16 0" stroke-width="2"/></svg>`,
  };
</script>

<nav class="tabbar">
  <a class="tab {is('/new/explore') ? 'active' : ''}" href="/new/explore">
    {@html icons.search}<span>Explore</span>
  </a>
  <a class="tab {is('/new/organizers') ? 'active' : ''}" href="/new/organizers">
    {@html icons.org}<span>Organizers</span>
  </a>
  <a class="tab {is('/new/map') ? 'active' : ''}" href="/new/map">
    {@html icons.globe}<span>Map</span>
  </a>
  <a class="tab {is('/new/wallet') ? 'active' : ''}" href="/new/wallet">
    {@html icons.wallet}<span>Wallet</span>
  </a>
  <a class="tab {is('/new/more') ? 'active' : ''}" href="/new/more">
    {@html icons.user}<span>More</span>
  </a>
</nav>
