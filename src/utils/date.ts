/**
 * ACP-6 — ONE date formatter for the admin. [KA11-6] [KA7-7]
 *
 * Measured across the pages: six shapes of the same thing —
 * `toLocaleDateString('en-IN')` (numeric), `{day, month:'short', year:'numeric'}`,
 * the same with `year:'2-digit'`, the same with no year, and both quote styles.
 * A reader comparing two screens cannot tell whether `1/8/2026` and `1 Aug 2026`
 * came from the same field.
 *
 * **Every function here names its timezone.** The admin renders dates for a
 * business that runs on IST, and a browser in another timezone would otherwise
 * shift a date by a day — the client-side twin of [UNI-43-1], which had exactly
 * that effect on the server and put a statutory invoice in the wrong month.
 *
 * `—` for an absent date, never a fabricated one or an empty cell that reads as
 * a value (RC-3 in a date column).
 */

const IST = 'Asia/Kolkata';

/** `1 Aug 2026` — the default. Use this unless there is a reason not to. */
export function fmtDate(value?: string | number | Date | null, fallback = '—'): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** `1 Aug, 2:30 pm` — when the time of day is part of the fact. */
export function fmtDateTime(value?: string | number | Date | null, fallback = '—'): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** `1 Aug` — dense contexts (chart axes, compact rows) where the year is implied. */
export function fmtDateShort(value?: string | number | Date | null, fallback = '—'): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short' });
}

/**
 * `2026-08-03` — the value an `<input type="date">` needs, as the IST calendar date.
 *
 * [KA7-7] The order Delivery card stored `estimated_delivery_date` straight into the
 * input and printed it straight to the screen, so a saved date rendered as the raw
 * `2026-08-02T18:30:00.000Z` directly beneath a correctly formatted `Created 28/7/2026`.
 * That string is also the timezone bug made visible: 18:30Z IS 00:00 IST the next day, so
 * the operator reading it to a customer was a day behind the promise the customer was
 * given. Slicing the ISO string would keep that error; this converts to the IST calendar
 * date, so what the input shows and what fmtDate() prints are the same day.
 */
export function toDateInput(value?: string | number | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // en-CA gives ISO-ordered y-m-d, which is exactly the input's required format.
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

/**
 * [SHL-5-8] An elapsed duration, in units a person can hold in their head.
 *
 * The hub-constraints table rendered raw hours: `494.6h`, `564.8h`, `582.3h`, in a column
 * sat next to `SLA 24h`. Nobody reads 582.3h as "twenty-four days" at a glance, which is
 * the one comparison the column exists to support — so the page's most alarming number was
 * also its least legible.
 *
 * Rules, in the order they matter for this table:
 *  - under a day, hours with one decimal (`6.4h`) — the precision is meaningful at SLA scale
 *  - a day or more, whole days and hours (`24d 6h`) — the decimal is noise at that size
 *  - under an hour, minutes (`18m`) — "0.3h" is not how anyone says it
 *
 * Returns the fallback for null/undefined/NaN, so a missing measurement never renders as
 * "0m", which would read as "instant" rather than "not known".
 */
export function fmtDuration(hours?: number | null, fallback = '—'): string {
  if (hours == null || !Number.isFinite(hours)) return fallback;
  if (hours < 0) return fallback;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Number(hours.toFixed(1))}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  // 47.7h would otherwise render "1d 24h".
  if (h === 24) return `${d + 1}d`;
  return h ? `${d}d ${h}h` : `${d}d`;
}
