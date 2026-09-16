import React from 'react';
import { hubsApi } from '../api/adminApi';
import type { Hub } from '../api/adminApi';

/**
 * [RC-3] The hub picker, in one place.
 *
 * `hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {})` was duplicated verbatim
 * across six consoles — the shell, Dead Stock, Design Overview, Hub Constraints, Listings
 * Overview and Service Areas. Every copy swallowed its failure, so a refused or failed hub
 * read rendered an empty picker, and an empty hub picker reads as "there are no hubs" on a
 * dark-store product whose entire model is hubs.
 *
 * A FILTER is the worse case: the reader keeps "All hubs" selected and believes they are
 * looking at the whole business when they may be looking at part of it.
 *
 * Fixing it six times would have left six things to drift. Pair with `<PickerNote error>`
 * at the call site to say which of denied / failed / genuinely empty happened.
 */
export function useHubOptions(enabled = true): {
  hubs: Hub[];
  error: unknown;
  retry: () => void;
} {
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [error, setError] = React.useState<unknown>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    hubsApi
      .list()
      .then((r) => {
        if (!alive) return;
        setHubs(r.hubs);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(e);
      });
    return () => {
      alive = false;
    };
  }, [enabled, nonce]);

  return { hubs, error, retry: () => setNonce((n) => n + 1) };
}
