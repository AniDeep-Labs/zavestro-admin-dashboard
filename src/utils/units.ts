/**
 * Unit display for the design surface — [DSG-10-2].
 *
 * The fit engine works in INCHES (`body-first-resolve.ts`: "Finished measurements in
 * inches, the same shape the legacy engine returns"). Everything around it is metric:
 * `meters_per_garment`, fabric `width_cm`, hub stock in metres, the cutting calculator
 * ("All measurements in centimetres"), and the customer-facing measurement capture.
 *
 * So a designer authors and reads the garment spec in inches inside a system that stocks,
 * cuts and measures in centimetres. The audit records a live bug already produced by this
 * exact seam — the agent-capture ↔ engine cm/inch mismatch at T2-7, where a centimetre
 * chart was consumed as inches, a silent 2.54× error on every dimension.
 *
 * The chart said "(inches)" ONCE, in a caption above the table. A unit that appears once
 * per section is a unit you have already stopped reading by the third row.
 */

/** The one conversion factor. Defined here so no screen re-types 2.54. */
export const CM_PER_INCH = 2.54;

/** Inches → centimetres, to one decimal. `null` for anything not a finite number. */
export function inchesToCm(value: unknown): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(n * CM_PER_INCH * 10) / 10;
}

/**
 * A measurement rendered in both units: `38″ · 96.5 cm`.
 *
 * Returns `null` when the value is not a measurement at all — a size LABEL ("32", "M") is
 * a name, not a length, and converting it would invent a dimension the chart never had.
 * The caller decides what to render instead; this refuses to guess.
 */
export function inchesWithCm(value: unknown): { inches: string; cm: string } | null {
  const cm = inchesToCm(value);
  if (cm === null) return null;
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  // Trim a trailing .0 — "38″" reads better than "38.0″", and the cm side carries the
  // precision that matters for cutting.
  const inches = `${Number.isInteger(n) ? n : Math.round(n * 100) / 100}″`;
  return { inches, cm: `${cm} cm` };
}

/**
 * Columns that are NOT lengths, however numeric they look.
 *
 * A size label is the sharpest case: the chart sends `size: "30"`, and 30 is a perfectly
 * good number — so a value-level check ("is this numeric?") converts it and renders
 * `30″ · 76.2 cm`, inventing a dimension the chart never had. Caught by rendering the real
 * table, not by the unit tests, which had only tried the alphabetic label "M".
 *
 * Keyed on the column NAME because that is where the fact lives: `size` is an identifier
 * in every chart, whatever its values happen to look like.
 */
const NON_MEASUREMENT_COLUMNS = new Set(['size', 'size_label', 'label', 'name', 'fit', 'fit_preset']);

/** True when a chart column holds a LENGTH that may be shown in both units. */
export function isMeasurementColumn(column: string): boolean {
  return !NON_MEASUREMENT_COLUMNS.has(column.trim().toLowerCase());
}
