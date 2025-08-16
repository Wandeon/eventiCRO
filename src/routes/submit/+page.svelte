<script lang="ts">
  import { z } from 'zod';

  const schema = z
    .object({
      title: z.string().min(3).max(140),
      description: z.string().max(2000).optional(),
      start_time: z
        .string()
        .refine((v) => {
          const d = Date.parse(v);
          return !Number.isNaN(d) && d >= Date.now() - 86400000;
        }, { message: 'Invalid start time' }),
      end_time: z.string().optional(),
      venue_name: z.string().optional(),
      address: z.string().optional(),
      city: z.string().min(2).max(80).optional(),
      lat: z
        .preprocess((v) => (v === '' ? undefined : Number(v)),
          z.number().min(-90).max(90).optional()),
      lng: z
        .preprocess((v) => (v === '' ? undefined : Number(v)),
          z.number().min(-180).max(180).optional()),
      organizer_name: z.string().optional(),
      url: z.string().url().startsWith('https://').optional(),
      image_url: z.string().url().startsWith('https://').optional(),
      price: z.string().optional(),
      captcha_token: z.string(),
      honeypot: z.string().max(0)
    })
    .refine(
      (data) => !data.end_time || Date.parse(data.end_time) > Date.parse(data.start_time),
      { path: ['end_time'], message: 'End must be after start' }
    );

  let form = {
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    venue_name: '',
    address: '',
    city: '',
    lat: '',
    lng: '',
    organizer_name: '',
    url: '',
    image_url: '',
    price: '',
    honeypot: ''
  };

  let errors: Record<string, string> = {};
  let referenceId = '';
  let status: 'idle' | 'success' | 'error' = 'idle';
  let errorKey: 'error' | 'captcha_failed' | 'rate_limited' = 'error';

  const sitekey = import.meta.env.PUBLIC_FRIENDLY_CAPTCHA_SITEKEY || '';

  async function submitForm(event: SubmitEvent) {
    const formEl = event.target as HTMLFormElement;
    const captchaInput = formEl.querySelector<HTMLInputElement>('input[name="frc-captcha-solution"]');
    const data = { ...form, captcha_token: captchaInput?.value || '' };
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      errors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors)
          .filter(([_, v]) => v && v[0])
          .map(([k, v]) => [k, v![0]])
      );
      return;
    }
    errors = {};
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data)
      });
      if (res.status === 202) {
        const body = await res.json();
        referenceId = body.submission_id;
        status = 'success';
      } else if (res.status === 403) {
        errorKey = 'captcha_failed';
        status = 'error';
      } else if (res.status === 429) {
        errorKey = 'rate_limited';
        status = 'error';
      } else if (res.status === 400) {
        const body = await res.json();
        errors = body.fieldErrors || {};
        status = 'error';
      } else {
        errorKey = 'error';
        status = 'error';
      }
    } catch (err) {
      errorKey = 'error';
      status = 'error';
    }
  }
</script>

<svelte:head>
  <script src="https://cdn.jsdelivr.net/npm/friendly-challenge@0.9.1/widget.min.js" async defer></script>
</svelte:head>

<main>
  {#if status === 'success'}
    <p>Thanks! Your event was submitted for review.</p>
    <p>Your reference ID is {referenceId}.</p>
  {:else}
    <h1>Submit an event</h1>
    <p>Please submit public events in Croatia. No ads or unrelated content.</p>
    {#if status === 'error'}
      <p class="error">
        {#if errorKey === 'captcha_failed'}Captcha verification failed. Please try again.{/if}
        {#if errorKey === 'rate_limited'}Too many submissions. Please wait a bit and try again.{/if}
        {#if errorKey === 'error'}Submission failed.{/if}
      </p>
    {/if}
    <form on:submit|preventDefault={submitForm}>
      <input type="text" bind:value={form.honeypot} name="honeypot" style="display:none" autocomplete="off" />
      <div>
        <label>
          Title
          <input bind:value={form.title} required />
        </label>
        {#if errors.title}<span class="error">{errors.title}</span>{/if}
      </div>
      <div>
        <label>
          Description
          <textarea bind:value={form.description} maxlength="2000"></textarea>
        </label>
        {#if errors.description}<span class="error">{errors.description}</span>{/if}
      </div>
      <div>
        <label>
          Start Time
          <input type="datetime-local" bind:value={form.start_time} required />
        </label>
        {#if errors.start_time}<span class="error">{errors.start_time}</span>{/if}
      </div>
      <div>
        <label>
          End Time
          <input type="datetime-local" bind:value={form.end_time} />
        </label>
        {#if errors.end_time}<span class="error">{errors.end_time}</span>{/if}
      </div>
      <div>
        <label>
          Venue Name
          <input bind:value={form.venue_name} />
        </label>
      </div>
      <div>
        <label>
          Address
          <input bind:value={form.address} />
        </label>
      </div>
      <div>
        <label>
          City
          <input bind:value={form.city} />
        </label>
        {#if errors.city}<span class="error">{errors.city}</span>{/if}
      </div>
      <div>
        <label>
          Latitude
          <input type="number" step="any" bind:value={form.lat} />
        </label>
        {#if errors.lat}<span class="error">{errors.lat}</span>{/if}
      </div>
      <div>
        <label>
          Longitude
          <input type="number" step="any" bind:value={form.lng} />
        </label>
        {#if errors.lng}<span class="error">{errors.lng}</span>{/if}
      </div>
      <div>
        <label>
          Organizer
          <input bind:value={form.organizer_name} />
        </label>
      </div>
      <div>
        <label>
          URL
          <input type="url" bind:value={form.url} />
        </label>
        {#if errors.url}<span class="error">{errors.url}</span>{/if}
      </div>
      <div>
        <label>
          Image URL
          <input type="url" bind:value={form.image_url} />
        </label>
        {#if errors.image_url}<span class="error">{errors.image_url}</span>{/if}
      </div>
      <div>
        <label>
          Price
          <input bind:value={form.price} />
        </label>
      </div>
      <div class="frc-captcha" data-sitekey={sitekey}></div>
      <button type="submit">Submit</button>
    </form>
  {/if}
</main>

<style>
  .error {
    color: red;
    font-size: 0.9em;
  }
</style>

