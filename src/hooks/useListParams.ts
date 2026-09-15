import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List filters that live in the URL — [SCA-44-4].
 *
 * The audit drove this in a browser and found the two lists the **phone seat** lives in —
 * customers and support tickets — losing their filter on reload, while happily *reading* a
 * `?search=` they could never produce. So the product supports arriving at a filtered list
 * and not leaving with one: an agent mid-call who refreshes loses the caller, and cannot
 * paste a colleague a link to what they are looking at.
 *
 * Only 2 of ~80 pages called `setSearchParams` at all, against the repo's own convention
 * that "back must preserve list filters (URL-synced state)". OrdersListPage had the correct
 * implementation and the others had none, so this is that implementation extracted rather
 * than a third hand-rolled copy — the shape the long tail of lists should adopt.
 *
 * Two behaviours worth keeping, both inherited from the orders list:
 *
 * - **`replace: true`.** Typing into a search box must not push a history entry per
 *   keystroke; otherwise Back walks the user letter-by-letter out of their own query
 *   instead of returning them to the page they came from.
 * - **Changing any filter clears `page`.** Page 4 of an old result set is not page 4 of a
 *   new one, and the usual symptom is an empty list that looks like "no matches".
 *
 * The URL is the single source of truth — there is no mirrored `useState`, so there is no
 * second copy to drift.
 */
export function useListParams<K extends string>(defaults: Partial<Record<K, string>> = {}) {
  const [sp, setSp] = useSearchParams();

  const get = React.useCallback(
    (key: K) => sp.get(key) ?? defaults[key] ?? '',
    // `defaults` is a fresh object literal on most renders; depending on it would rebuild
    // `get` every render and defeat every consumer's memo. The VALUES are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp, JSON.stringify(defaults)],
  );

  const set = React.useCallback(
    (key: K, value: string) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          // An empty value means "no filter", which is an ABSENT param rather than `key=`.
          // A trailing `?search=` in a shared link reads as a filter that matches nothing.
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== ('page' as K)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  /** Drop every filter this list owns, keeping anything else already on the URL. */
  const clear = React.useCallback(
    (keys: K[]) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const k of keys) next.delete(k);
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  const page = Math.max(1, Number(sp.get('page')) || 1);
  const setPage = React.useCallback((p: number) => set('page' as K, String(p)), [set]);

  return { get, set, clear, page, setPage };
}
