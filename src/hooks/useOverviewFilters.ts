import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminHubContext, subscribeAdminHubContext } from '../utils/hubContext';

/**
 * [SHL-5-2] Overview filters live in the URL, not in component state.
 *
 * The oversight overviews held hub, date range and active tab in `React.useState`, so the
 * address bar stayed bare no matter what you selected. Three consequences, and the third
 * is the one that matters:
 *
 *   - refresh reset the page to "All hubs";
 *   - browser-back out of a drilled-in record returned to an UNFILTERED list, losing the
 *     operator's place;
 *   - an oversight view could not be SHARED. A founder could not send "look at HM-CAP2's
 *     awaiting-procurement queue" as a link — which is most of the point of an oversight
 *     console.
 *
 * It also contradicted the repo's own stated convention (CLAUDE.md): "Deep-links carry
 * context; back must preserve list filters (URL-synced state)." The pattern here is the
 * one OrdersListPage already uses.
 *
 * `replace: true` so that changing a filter does not push a history entry per keystroke —
 * back should leave the page, not walk back through every date you tried.
 */
export interface OverviewFilters {
  hubId: string;
  startDate: string;
  endDate: string;
  /** Patch any subset; an empty string clears that filter. */
  applyFilter: (patch: { hubId?: string; startDate?: string; endDate?: string }) => void;
}

const PARAMS = { hubId: 'hub_id', startDate: 'from', endDate: 'to' } as const;

export function useOverviewFilters(): OverviewFilters {
  const [sp, setSp] = useSearchParams();
  const urlHub = sp.get(PARAMS.hubId) ?? '';

  const applyFilter = React.useCallback(
    (patch: { hubId?: string; startDate?: string; endDate?: string }) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, param] of Object.entries(PARAMS)) {
            const value = patch[key as keyof typeof PARAMS];
            if (value === undefined) continue;
            if (value) next.set(param, value);
            else next.delete(param);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  // [SHL-5-11] The header's global hub switcher and this page's own hub filter sat on the
  // same screen showing DIFFERENT values — the page read "Demo Hub" while the header read
  // "All hubs" — with nothing on screen saying which governed the rows below.
  //
  // The mechanism to reconcile them already existed: `useHubContextFilter` (SHL-3-8) makes
  // a page default to the switcher's hub and follow it when it changes, and eight pages
  // use it. The overview shell was simply not among them. Same rules here, so there is one
  // answer in the product rather than two:
  //
  //   - a hub in the URL WINS, always. A shared link must show what its sender saw, and
  //     must not be re-pointed by whatever the recipient last picked in their own header;
  //   - otherwise the switcher seeds the page, and the page follows it when it changes;
  //   - choosing a hub on the PAGE never writes back to the global context — a local look
  //     at another hub should not silently re-point every other page.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const contextHub = getAdminHubContext();
    if (contextHub && !urlHub) applyFilter({ hubId: contextHub });
  }, [urlHub, applyFilter]);

  React.useEffect(
    () => subscribeAdminHubContext((id) => applyFilter({ hubId: id })),
    [applyFilter],
  );

  return {
    hubId: urlHub,
    startDate: sp.get(PARAMS.startDate) ?? '',
    endDate: sp.get(PARAMS.endDate) ?? '',
    applyFilter,
  };
}

/**
 * [SHL-5-2] The active tab, also in the URL — a shared link should land on the tab the
 * sender was looking at, not on the first one.
 *
 * `valid` guards against a hand-edited or stale link naming a tab this page does not have:
 * an unknown key falls back to the first tab rather than rendering nothing.
 */
export function useUrlTab(valid: string[], param = 'tab'): [string | undefined, (k: string) => void] {
  const [sp, setSp] = useSearchParams();
  const fromUrl = sp.get(param);
  const active = fromUrl && valid.includes(fromUrl) ? fromUrl : valid[0];
  const setActive = React.useCallback(
    (key: string) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(param, key);
          return next;
        },
        { replace: true },
      );
    },
    [setSp, param],
  );
  return [active, setActive];
}

/**
 * [CM-21-10 / CM-22-10] One URL-backed string of page state, with the same semantics as
 * `React.useState('')` so a page can adopt it by changing one line.
 *
 * The CMS list pages held search, status filter and *which record is open in the editor*
 * in component state. The editor is a MODAL, so "the collection I'm editing" had no
 * address: a CM could not link a colleague to it, and browser-back from the modal left the
 * list entirely rather than closing the modal — the [DSG-10-3] pattern.
 *
 * The empty string clears the parameter rather than writing `?q=`, so a default-state page
 * has a clean URL and two identical views never produce two different links.
 */
export function useUrlParam(
  key: string,
  fallback = '',
): [string, (next: string) => void] {
  const [sp, setSp] = useSearchParams();
  const set = React.useCallback(
    (next: string) => {
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next && next !== fallback) p.set(key, next);
          else p.delete(key);
          return p;
        },
        { replace: true },
      );
    },
    [setSp, key, fallback],
  );
  return [sp.get(key) ?? fallback, set];
}

/**
 * The record open in a modal editor, as a URL parameter. `null` = closed, `'new'` = the
 * create form — the same shape the pages already keep in state.
 *
 * NOT `replace: true`: opening an editor is a place you can be, so Back should CLOSE it
 * rather than leave the page. That is the actual complaint in both findings.
 */
export function useUrlEditor(
  key = 'edit',
): [string | null, (next: string | null) => void] {
  const [sp, setSp] = useSearchParams();
  const set = React.useCallback(
    (next: string | null) => {
      setSp((prev) => {
        const p = new URLSearchParams(prev);
        if (next) p.set(key, next);
        else p.delete(key);
        return p;
      });
    },
    [setSp, key],
  );
  return [sp.get(key), set];
}

/**
 * [DSG-9-3] A boolean filter in the URL. Present (`?dead=1`) = on, absent = off.
 *
 * Absent rather than `=0` for the off state, so the default view has a clean address and
 * two identical screens cannot produce two different links.
 */
export function useUrlFlag(key: string): [boolean, (next: boolean) => void] {
  const [sp, setSp] = useSearchParams();
  const set = React.useCallback(
    (next: boolean) => {
      setSp(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next) p.set(key, '1');
          else p.delete(key);
          return p;
        },
        { replace: true },
      );
    },
    [setSp, key],
  );
  return [sp.get(key) === '1', set];
}
