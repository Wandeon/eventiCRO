<script lang="ts">
  import 'leaflet/dist/leaflet.css';
</script>

<header class="header">
  <nav>
    <a href="/">EventiCRO</a>
    <a href="/about">About</a>
  </nav>
</header>

<main class="content">
  <slot />
</main>

<style>
  .header {
    background: #2563eb;
    color: white;
    padding: 1rem;
  }
  .header a {
    color: white;
    margin-right: 1rem;
    text-decoration: none;
  }
  .content {
    padding: 1rem;
  }
</style>

