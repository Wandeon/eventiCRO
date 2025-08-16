<script lang="ts">
  import { locale } from '../i18n';
  $: current = $locale;
  function toggle() {
    locale.set(current === 'en' ? 'hr' : 'en');
  }
</script>

<button on:click={toggle} aria-label="Toggle language">{current === 'en' ? 'HR' : 'EN'}</button>
