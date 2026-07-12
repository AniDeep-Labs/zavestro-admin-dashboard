// T1-22 (P-15 / CM-4): a date-only input (<input type="date"> → "2026-07-31") turned into
// `new Date(str).toISOString()` becomes UTC-midnight, so a promo/banner "valid until July 31"
// expired ~18.5h early. Anchor window boundaries to IST (India-only, +05:30, no DST) so a
// chosen date covers the whole calendar day regardless of the admin's browser timezone.
const IST = '+05:30';

/** Start of the given calendar day in IST, as a UTC ISO string. Empty → undefined. */
export function istDayStart(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T00:00:00.000${IST}`).toISOString();
}

/** End of the given calendar day in IST, as a UTC ISO string. Empty → undefined. */
export function istDayEnd(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  return new Date(`${dateStr}T23:59:59.999${IST}`).toISOString();
}
