import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.ENVIRONMENT,
  release: process.env.RELEASE
});

export const handleError = ({ error }) => {
  Sentry.captureException(error);
  return {
    message: 'Internal error'
  };
};

