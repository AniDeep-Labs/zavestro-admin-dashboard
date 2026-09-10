/**
 * [CM-20-7] The QC checklist rules, defined once.
 *
 * `BrandQcPage` (QC-2, the brand layer) and `QcTemplatesPage` (QC-1, the house layer) each
 * carried their own copy of `blankCheck()` and the same five validation rules, verbatim.
 * Duplication matters more than usual here: the two layers are meant to be COMPARABLE, so a
 * rule drifting on one side silently changes what "the same check" means between them.
 *
 * Values only — no components — so `react-refresh/only-export-components` stays quiet and the
 * editor can be hot-replaced. See [CM-22-8] for what happens when that split is skipped.
 */
import type { QcCheck } from '../../../api/adminApi';

/** A new, empty row. Numeric-and-required is the common case for a measured check. */
export const blankCheck = (): QcCheck => ({
  key: '',
  label: '',
  type: 'numeric',
  required: true,
  min: null,
  max: null,
  unit: '',
});

/** Rows with a key or a label, trimmed. A wholly blank row is dropped, not rejected. */
export function cleanChecks(checks: QcCheck[]): QcCheck[] {
  return checks
    .map((c) => ({ ...c, key: c.key.trim(), label: c.label.trim() }))
    .filter((c) => c.key || c.label);
}

/**
 * The first thing wrong with a checklist, or null. Order is deliberate — it reports the most
 * basic problem first, so fixing one error does not reveal a more fundamental one underneath.
 */
export function checklistError(cleaned: QcCheck[]): string | null {
  if (cleaned.length === 0) return 'Add at least one check';
  if (cleaned.some((c) => !c.key || !c.label)) return 'Every check needs a key and a label';
  if (cleaned.some((c) => !/^[a-z0-9_]+$/.test(c.key)))
    return 'Check keys must be lower_snake_case';
  if (new Set(cleaned.map((c) => c.key)).size !== cleaned.length)
    return 'Check keys must be unique';
  if (cleaned.some((c) => c.type === 'numeric' && c.min == null && c.max == null))
    return 'A numeric check needs a min and/or max tolerance';
  return null;
}
