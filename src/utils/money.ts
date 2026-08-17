/**
 * ACP-2 — ONE money formatter for the whole admin. [KA7-8] [KA8-3] [KA6-5] [KA8-15]
 *
 * The audit measured **four shapes of the same amount coexisting product-wide**,
 * two of them *in the same table row* on order detail: `₹2750.00` (no separator,
 * two decimals) beside `₹2,750` (separator, none). Across the finance console 37
 * money strings appeared on the P&L with exactly three carrying paise, and
 * `10.00%` sat beside `₹200.00` — two decimals on a whole percentage.
 *
 * Five pages each declared their own `const fmtINR`, every one different. That is
 * not a formatting nit: money that changes shape between two cells makes an
 * operator check whether it is the same number, and a page that shows paise in
 * three places out of thirty-seven looks like it is hiding something in the other
 * thirty-four.
 *
 * **The house rule, in one place:**
 *  - Indian digit grouping (`en-IN` → 2,49,999), always.
 *  - **No paise by default.** Rupees are what the business transacts in; paise
 *    appear only where the underlying record genuinely has them (a GST line, a
 *    tax total), and then via `money(n, { paise: true })`.
 *  - Never a bare number: `—` for null/undefined, so an absent amount cannot be
 *    mistaken for zero. (RC-3 in a money cell.)
 *
 * Right-alignment is the other half of this fix and lives in CSS: `.moneyCell`
 * in `styles/global.css`. Nine tables aligned money left and one right; the eye
 * cannot compare a column of magnitudes that do not share a decimal position.
 */

export interface MoneyOptions {
  /** Show paise. Default false — see the note above. */
  paise?: boolean;
  /** What to render when the value is absent. Default `—`. */
  fallback?: string;
  /** Omit the ₹ symbol (for a column already headed "Amount (₹)"). */
  bare?: boolean;
}

export function money(value: number | string | null | undefined, opts: MoneyOptions = {}): string {
  const { paise = false, fallback = '—', bare = false } = opts;
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return fallback;
  const digits = paise ? 2 : 0;
  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return bare ? formatted : `₹${formatted}`;
}

/**
 * Compact form for a KPI tile where the full number would not fit — and ONLY
 * there. [KA1-12]: the dashboard rendered GMV as `₹0.0L` where analytics rendered
 * the same figure as `₹2,499`, so the two pages disagreed about the same money by
 * appearing to disagree about its magnitude. Lakh notation below ₹1,00,000 is
 * strictly worse than the number it replaces.
 */
export function moneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 100000) return money(value);
  return `₹${(value / 100000).toFixed(1)}L`;
}

/**
 * [KA6-5] A percentage carries decimals only when it has them. `10.00%` beside
 * `₹200.00` was two decimals on a whole number, which reads as false precision.
 */
export function percent(value: number | null | undefined, maxDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-IN', { maximumFractionDigits: maxDigits })}%`;
}
