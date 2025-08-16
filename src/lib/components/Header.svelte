<script lang="ts">
  import { locale } from '$lib/stores/locale';

  let query = '';
  let drawerOpen = false;
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === 'Escape') drawerOpen = false;
  }}
/>

<header class="sticky top-0 z-10 bg-white border-b shadow-sm dark:bg-gray-900">
  <div class="max-w-5xl mx-auto flex items-center justify-between p-4">
    <a href="/" class="text-xl font-bold focus:outline-none focus-visible:ring">EventiCRO</a>

    <form role="search" class="flex-1 mx-4">
      <label for="search" class="sr-only">Search events</label>
      <input
        id="search"
        type="search"
        bind:value={query}
        placeholder="Search events"
        class="w-full border rounded px-2 py-1 focus:outline-none focus-visible:ring"
      />
    </form>

    <div class="flex items-center gap-4">
      <div class="hidden md:flex items-center gap-2" aria-label="Language toggle">
        <button
          on:click={() => locale.set('hr')}
          aria-pressed={$locale === 'hr'}
          class="focus:outline-none focus-visible:ring font-medium {$locale === 'hr' ? 'underline' : ''}"
        >
          HR
        </button>
        <span aria-hidden="true">/</span>
        <button
          on:click={() => locale.set('en')}
          aria-pressed={$locale === 'en'}
          class="focus:outline-none focus-visible:ring font-medium {$locale === 'en' ? 'underline' : ''}"
        >
          EN
        </button>
      </div>

      <nav class="hidden md:block" aria-label="Main navigation">
        <ul class="flex gap-4">
          <li>
            <a href="/submit" class="hover:underline focus:outline-none focus-visible:ring">Submit</a>
          </li>
          <li>
            <a href="/about" class="hover:underline focus:outline-none focus-visible:ring">About</a>
          </li>
        </ul>
      </nav>

      <button
        class="md:hidden focus:outline-none focus-visible:ring"
        aria-controls="mobile-menu"
        aria-expanded={drawerOpen}
        on:click={() => (drawerOpen = !drawerOpen)}
      >
        <span class="sr-only">Open menu</span>
        <svg
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  </div>

  {#if drawerOpen}
    <div class="md:hidden">
      <div class="fixed inset-0 bg-black/50" tabindex="-1" on:click={() => (drawerOpen = false)}></div>
      <nav
        id="mobile-menu"
        class="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 shadow p-4"
        aria-label="Mobile navigation"
      >
        <button
          class="mb-4 focus:outline-none focus-visible:ring"
          on:click={() => (drawerOpen = false)}
          aria-label="Close menu"
        >
          &times;
        </button>
        <ul class="flex flex-col gap-4">
          <li>
            <a href="/submit" class="hover:underline focus:outline-none focus-visible:ring">Submit</a>
          </li>
          <li>
            <a href="/about" class="hover:underline focus:outline-none focus-visible:ring">About</a>
          </li>
        </ul>
        <div class="mt-4 flex items-center gap-2" aria-label="Language toggle">
          <button
            on:click={() => locale.set('hr')}
            aria-pressed={$locale === 'hr'}
            class="focus:outline-none focus-visible:ring font-medium {$locale === 'hr' ? 'underline' : ''}"
          >
            HR
          </button>
          <span aria-hidden="true">/</span>
          <button
            on:click={() => locale.set('en')}
            aria-pressed={$locale === 'en'}
            class="focus:outline-none focus-visible:ring font-medium {$locale === 'en' ? 'underline' : ''}"
          >
            EN
          </button>
        </div>
      </nav>
    </div>
  {/if}
</header>
