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
