<script lang="ts">
  import { locale } from '$lib/stores/locale';
  import en from '$lib/i18n/en.json';
  import hr from '$lib/i18n/hr.json';

  const REPO_URL = 'https://github.com/eventiCRO/eventiCRO';
  const OSM_URL = 'https://www.openstreetmap.org/';

  const translations = { en, hr } as const;

  $: t = translations[$locale].footer;
  $: mapData = t.map_data.replace(
    '{osm}',
    `<a href="${OSM_URL}" target="_blank" rel="noopener noreferrer" class="underline focus:outline-none focus-visible:ring">OpenStreetMap</a>`
  );
</script>

<footer class="mt-auto bg-gray-100 dark:bg-gray-800 text-sm">
  <div class="max-w-5xl mx-auto p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
      <span>{t.copyright}</span>
      <span>{@html mapData}</span>
    </div>

    <nav aria-label="Footer navigation">
      <ul class="flex gap-4">
        <li>
          <a href="/about" class="underline focus:outline-none focus-visible:ring">{t.about}</a>
        </li>
        <li>
          <a href="/privacy" class="underline focus:outline-none focus-visible:ring">{t.privacy}</a>
        </li>
        <li>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="underline focus:outline-none focus-visible:ring"
            >{t.repo}</a
          >
        </li>
      </ul>
    </nav>
  </div>
</footer>

