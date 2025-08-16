<script lang="ts">
  import SubmitForm from '../../lib/components/SubmitForm.svelte';
  import { t } from '../../lib/i18n';
</script>

<main>
  <h1>{$t.submit.title}</h1>
  <SubmitForm />
</main>
