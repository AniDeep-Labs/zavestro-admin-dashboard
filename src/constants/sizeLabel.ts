/**
 * Mirrors `src/shared/size-label.ts` in the backend. [DSG-11-14]
 *
 * The engine keys its size chart by number: a letter label is silently dropped by
 * `rowsToChart`, and used to make the preview return 400 "Invalid ID format" because the
 * ordering cast `size_label::int` raised 22P02. This page invited exactly that — its cell
 * placeholder read "e.g. M / 32" and the import example was S / M / L.
 *
 * The backend refuses a bad label with the same rule; this copy exists so the author is
 * told while typing rather than on save. If you change one, change both — the parity is
 * covered by `tests/unit/size-label-parity.test.ts` in the backend.
 */
export const SIZE_LABEL_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

export function isValidSizeLabel(label: string): boolean {
  return SIZE_LABEL_PATTERN.test(label.trim());
}

export function sizeLabelError(label: string): string {
  const trimmed = label.trim();
  if (/[a-z]/i.test(trimmed)) {
    return `Size "${trimmed}" is not a number. Sizes are numeric (32, 32.5) because the fit engine interpolates between them — a letter size has no position to interpolate from. Put the letter in the storefront size guide instead.`;
  }
  return `Size "${trimmed}" is not a valid size label. Use a number like 32 or 32.5.`;
}
