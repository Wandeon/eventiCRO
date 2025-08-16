<script lang="ts">
  import { z } from 'zod';
  import { t, translate } from '../i18n';
  import { onMount } from 'svelte';
  let form: any = { title: '', description: '', start_time: '', end_time: '', venue_name: '', address: '', city: '', captcha_token: '', honeypot: '' };
  let errors: Record<string, string[]> = {};
  let success = '';
  const schema = z.object({
    title: z.string().min(3).max(140),
    description: z.string().max(2000).optional(),
    start_time: z.string().min(1),
    end_time: z.string().optional(),
    venue_name: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    captcha_token: z.string().min(1),
    honeypot: z.string().max(0)
  });
  async function submit() {
    errors = {};
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      errors = parsed.error.flatten().fieldErrors;
      return;
    }
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data)
    });
    if (res.status === 202) {
      const data = await res.json();
      success = data.submission_id;
    } else if (res.status === 403) {
      errors.captcha_token = [translate('submit.captcha_failed')];
    } else if (res.status === 429) {
      errors.general = [translate('submit.rate_limited')];
    } else {
      errors.general = [translate('submit.error')];
    }
  }
  onMount(async () => {
    const { WidgetInstance } = await import('friendly-challenge');
    new WidgetInstance(document.getElementById('captcha'), {
      sitekey: import.meta.env.VITE_FRIENDLY_CAPTCHA_SITEKEY,
      callback: (solution: string) => { form.captcha_token = solution; }
    });
  });
</script>

<p>{$t.submit.guidelines}</p>
<form on:submit|preventDefault={submit} class="flex flex-col gap-2">
  <input type="text" bind:value={form.title} placeholder="Title" />
  {#if errors.title}<span class="text-red-500">{errors.title[0]}</span>{/if}
  <textarea bind:value={form.description} placeholder="Description"></textarea>
  <label>{$t.filters.date_from}<input type="datetime-local" bind:value={form.start_time} /></label>
  {#if errors.start_time}<span class="text-red-500">{errors.start_time[0]}</span>{/if}
  <label>{$t.filters.date_to}<input type="datetime-local" bind:value={form.end_time} /></label>
  <input type="text" placeholder={$t.filters.city} bind:value={form.city} />
  <input type="text" placeholder="Venue" bind:value={form.venue_name} />
  <input type="text" placeholder="Address" bind:value={form.address} />
  <div id="captcha"></div>
  <input type="text" bind:value={form.honeypot} style="display:none" autocomplete="off" />
  {#if errors.captcha_token}<span class="text-red-500">{errors.captcha_token[0]}</span>{/if}
  {#if errors.general}<span class="text-red-500">{errors.general[0]}</span>{/if}
  <button type="submit" class="p-2 bg-blue-500 text-white rounded">{$t.nav.submit}</button>
</form>
{#if success}<p>{$t.submit.success} {$t.submit.reference.replace('{id}', success)}</p>{/if}
