import React from 'react';
import { readDraft, writeDraft, clearDraft, type StoredDraft } from './draftStorage';

export type { StoredDraft } from './draftStorage';
export { clearDraft, draftAge } from './draftStorage';

/**
 * A recoverable draft for a long form — [DSG-10-4].
 *
 * `useDirtyGuard` prevents SILENT loss: it warns on tab-close and refresh. Nothing
 * PRESERVED the work. A six-step wizard interrupted by a crash, by the 8-hour token
 * expiring ([SHL-1-8]), or by "Discard & leave" clicked in haste lost everything typed so
 * far — which is the ordinary back-office condition, not an edge case.
 *
 * Deliberately localStorage and not the server. A server draft is a different feature with
 * its own questions (who owns it, when is it garbage-collected, does it show in the list),
 * and the thing worth having today is that a browser crash stops costing an afternoon.
 *
 * ## Why a draft carries what it was BASED ON
 *
 * Restoring blindly is its own way to lose work. If someone else edited the design while a
 * draft sat in this browser, replaying the draft would silently overwrite their change with
 * a stale copy of the form. So the draft records the baseline it was taken against, and the
 * caller is told when that no longer matches — the choice is then a person's, with the facts
 * in front of them, rather than a default nobody chose.
 */
export interface DraftState {
  /** A draft worth offering, or null. Never the snapshot the form already holds. */
  found: StoredDraft | null;
  /** True when the design changed on the server since this draft was taken. */
  stale: boolean;
  /** Forget the stored draft (taken, or declined). */
  discard: () => void;
}

/**
 * @param key      stable per form instance — e.g. `design:<id>` or `design:new`
 * @param snapshot the CURRENT serialised form state
 * @param baseline the server-loaded state; '' while still loading
 * @param step     the wizard step to restore to
 * @param enabled  false while loading, or when the form is not open
 */
export function useLocalDraft(
  key: string,
  snapshot: string,
  baseline: string,
  step: number,
  enabled: boolean,
): DraftState {
  // Read ONCE per key, before the form starts writing — otherwise the first autosave
  // overwrites the very draft being offered.
  const [found, setFound] = React.useState<StoredDraft | null>(null);
  const [checked, setChecked] = React.useState('');

  React.useEffect(() => {
    if (!enabled || baseline === '' || checked === key) return;
    const d = readDraft(key);
    setChecked(key);
    // A draft identical to what the form already shows is not worth offering.
    setFound(d && d.snapshot !== baseline ? d : null);
  }, [enabled, baseline, key, checked]);

  React.useEffect(() => {
    // Only write once the baseline exists (so a half-loaded form cannot be saved as a
    // draft) and only when something has actually been typed.
    if (!enabled || baseline === '' || snapshot === baseline) return;
    const t = setTimeout(
      () => writeDraft(key, { snapshot, basedOn: baseline, savedAt: Date.now(), step }),
      600,
    );
    return () => clearTimeout(t);
  }, [enabled, key, snapshot, baseline, step]);

  const discard = React.useCallback(() => {
    clearDraft(key);
    setFound(null);
  }, [key]);

  return { found, stale: found !== null && found.basedOn !== baseline, discard };
}
