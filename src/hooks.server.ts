import type { Handle, HandleServerError } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import jwt from 'jsonwebtoken';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.ENVIRONMENT,
  release: process.env.RELEASE
});

const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
const jwtSecret = process.env.JWT_SECRET;

function getSentryOrigin() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return '';
  try {
    return new URL(dsn).origin;
  } catch {
    return '';
  }
}

const csp = (() => {
  const connectSrc = [
    "'self'",
    process.env.API_BASE_URL,
    getSentryOrigin(),
    process.env.TILESERVER_URL
  ]
    .filter(Boolean)
    .join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `img-src 'self' data: blob: ${process.env.TILESERVER_URL ?? ''}`.trim(),
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    `connect-src ${connectSrc}`.trim(),
    "media-src 'self' data: blob:",
    "form-action 'self'",
    'upgrade-insecure-requests'
  ].join('; ');
})();

export const handle: Handle = async ({ event, resolve }) => {
  const { method } = event.request;
  const { pathname } = event.url;
  const start = Date.now();

  const auth = event.request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    let payload: unknown;
    if (supabaseSecret) {
      try {
        payload = jwt.verify(token, supabaseSecret);
      } catch {
        /* noop */
      }
    }
    if (!payload && jwtSecret) {
      try {
        payload = jwt.verify(token, jwtSecret);
      } catch {
        /* noop */
      }
    }
    if (payload) {
      // expose user information to the rest of the app
      event.locals.user = payload;
    }
  }

  const response = await resolve(event);

  const duration = Date.now() - start;
  console.log(`${method} ${pathname} -> ${response.status} ${duration}ms`);

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '0');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), fullscreen=(self), payment=(), usb=(), interest-cohort=()'
  );
  response.headers.delete('Server');

  return response;
};

export const handleError: HandleServerError = ({ error }) => {
  Sentry.captureException(error);
  return {
    message: 'Internal error'
  };
};

