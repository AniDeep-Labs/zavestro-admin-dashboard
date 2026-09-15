import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const DD_APP_ID = import.meta.env.VITE_DD_APPLICATION_ID as string | undefined;
const DD_CLIENT_TOKEN = import.meta.env.VITE_DD_CLIENT_TOKEN as string | undefined;
const DD_SITE = (import.meta.env.VITE_DD_SITE as string | undefined) ?? 'us5.datadoghq.com';
const ENV = (import.meta.env.VITE_ENV as string | undefined) ?? 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: ENV === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// [SCA-44-5] RUM loads AFTER first paint, not before it. See instrument-rum.ts for why.
if (DD_APP_ID && DD_CLIENT_TOKEN) {
  const start = () =>
    import('./instrument-rum')
      .then(({ initRum }) =>
        initRum({
          appId: DD_APP_ID,
          clientToken: DD_CLIENT_TOKEN,
          site: DD_SITE,
          env: ENV,
          version: (import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? 'unknown',
        }),
      )
      // Monitoring must never be the reason the console fails to load — but [RC-3] says
      // a discarded error is not allowed either, and it is right: a chunk that stops
      // loading would mean RUM silently goes dark and the graphs just flatten. Sentry is
      // already up by this point (it is the synchronous half above), so the failure is
      // reported there, and to the console when Sentry is not configured.
      .catch((err: unknown) => {
        if (SENTRY_DSN) Sentry.captureException(err);
        else console.warn('[instrument] RUM failed to load', err);
      });

  // requestIdleCallback where it exists (not Safari <16.4), otherwise a timeout after the
  // load event. Either way the import is issued once the page is usable, and the module is
  // not in the entry's static graph, so it is never preloaded.
  const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  const idle = (cb: () => void) =>
    ric ? ric.call(window, cb, { timeout: 4000 }) : window.setTimeout(cb, 1500);

  if (document.readyState === 'complete') idle(start);
  else window.addEventListener('load', () => idle(start), { once: true });
}
