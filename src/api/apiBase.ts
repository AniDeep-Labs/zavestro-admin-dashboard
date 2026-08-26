/**
 * [SHL-2-2] Where this admin sends its writes — and why the default is localhost.
 *
 * Every API module used to fall back to **`https://api.zavestro.in`** when `VITE_API_URL` was
 * unset. `.gitignore` excludes `.env` and `.env.*`, so **a fresh clone has no env file at all** —
 * which means `npm run dev` on a clean checkout pointed the admin at the **live business**, with a
 * working login form and every write enabled: prices, refunds, credits, stage overrides, DPDP
 * erasure. `.env.example` documented the same production URL, so the documented setup path
 * (`cp .env.example .env`) produced it too.
 *
 * Nothing on screen distinguished the two. The UI is identical.
 *
 * The safe default is the one that FAILS when it is wrong. Pointing at localhost with no backend
 * running gives a connection error in the corner of the screen; pointing at production gives a
 * working console attached to real customers' money. Production is now something you have to ask
 * for, by setting `VITE_API_URL` — which every real deployment already does.
 */
export const DEFAULT_API_BASE = 'http://localhost:8080';

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || DEFAULT_API_BASE;

/** Hosts that are the real business. Used to warn when a non-production build attaches to one. */
const PRODUCTION_HOSTS = ['api.zavestro.in', 'api.zavestro.com'];

export function isProductionApi(base: string = API_BASE): boolean {
  try {
    return PRODUCTION_HOSTS.includes(new URL(base).host);
  } catch {
    return false;
  }
}

/** Just the host, for the environment banner — the operator needs to read it at a glance. */
export function apiHost(base: string = API_BASE): string {
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}
