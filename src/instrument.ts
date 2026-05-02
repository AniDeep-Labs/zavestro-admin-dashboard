import * as Sentry from '@sentry/react';
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

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

if (DD_APP_ID && DD_CLIENT_TOKEN) {
  datadogRum.init({
    applicationId: DD_APP_ID,
    clientToken: DD_CLIENT_TOKEN,
    site: DD_SITE,
    service: 'zavestro-admin',
    env: ENV,
    version: import.meta.env.VITE_COMMIT_SHA ?? 'unknown',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  });

  datadogLogs.init({
    clientToken: DD_CLIENT_TOKEN,
    site: DD_SITE,
    service: 'zavestro-admin',
    env: ENV,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  });
}
