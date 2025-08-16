import * as Sentry from '@sentry/sveltekit';
import { writable } from 'svelte/store';
import type { HandleClientError } from '@sveltejs/kit';

// Initialise Sentry for client-side error and performance monitoring
Sentry.init({
  // `VITE_SENTRY_DSN` is exposed by the build step and safe for the client
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.2
});

// Store that reflects the current online/offline status of the app.
// Components can subscribe to react to connectivity changes.
export const online = writable(
  typeof navigator === 'undefined' ? true : navigator.onLine
);

if (typeof window !== 'undefined') {
  const update = () => online.set(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

// Forward client-side errors to Sentry and surface a generic message to the UI
export const handleError: HandleClientError = ({ error }) => {
  Sentry.captureException(error);
  return { message: 'An unexpected error occurred' };
};
