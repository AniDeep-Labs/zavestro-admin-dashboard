import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

/**
 * Datadog RUM + browser logs — [SCA-44-5].
 *
 * Deliberately a SEPARATE module from `instrument.ts` so that its 201 KB is not a static
 * dependency of the entry. Vite `modulepreload`s everything the entry statically imports,
 * which put `vendor-datadog` (the single largest preloaded chunk — larger than the app's
 * own vendor bundle) ahead of the first page chunk on every cold load, for an internal
 * console with nine users on Indian mobile networks in hub back-offices.
 *
 * RUM is worth having. It is not worth having before the login form paints: it measures
 * the load it is delaying.
 *
 * Sentry stays synchronous in `instrument.ts` — it is the error reporter, and an error
 * reporter that arrives after first paint cannot report what happened during it.
 */
export function initRum(opts: {
  appId: string;
  clientToken: string;
  site: string;
  env: string;
  version: string;
}) {
  datadogRum.init({
    applicationId: opts.appId,
    clientToken: opts.clientToken,
    site: opts.site,
    service: 'zavestro-admin',
    env: opts.env,
    version: opts.version,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  });

  datadogLogs.init({
    clientToken: opts.clientToken,
    site: opts.site,
    service: 'zavestro-admin',
    env: opts.env,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  });
}
