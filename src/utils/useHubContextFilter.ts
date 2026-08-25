import React from 'react';
import { getAdminHubContext, subscribeAdminHubContext } from './hubContext';

/**
 * [SHL-3-8] The header's hub switcher, actually connected to something.
 *
 * The switcher wrote the chosen hub to `localStorage` and **nothing read it**. `AdminLayout` was
 * the only importer of `getAdminHubContext`, and it used it to seed the switcher's own value —
 * so the control's entire effect was to remember what you last picked. Meanwhile the comment
 * above it said *"Pages read the selection via getAdminHubContext() as their default hub filter"*,
 * which is the part that makes this a 🔴 rather than a missing feature: an operator switching to
 * "Bengaluru" and reading a page of Pune rows has been told something false by the UI.
 *
 * This is the page half. Eight pages keep a `hubFilter`, all of them defaulting to '' (All hubs).
 * They default to the switcher's hub instead, and follow it when it changes — which is what the
 * comment always claimed and is the least surprising reading of a global context control.
 *
 * The filter stays a real filter: choosing a different hub on the page still works and does NOT
 * write back to the global context. A per-page look at another hub should not silently re-point
 * every other page.
 */
export function useHubContextFilter(): [string, React.Dispatch<React.SetStateAction<string>>] {
  const [hubFilter, setHubFilter] = React.useState<string>(getAdminHubContext);

  React.useEffect(() => subscribeAdminHubContext(setHubFilter), []);

  return [hubFilter, setHubFilter];
}
