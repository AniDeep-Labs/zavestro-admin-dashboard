// [SUP-30-5] Reading ORDER for the measurement panel — not a filter.
//
// Body measurements are read top-down; alphabetical order would scatter them. So the
// familiar sequence is kept as a preference, and every key NOT named here is appended
// rather than dropped. Adding a measurement to the engine can no longer make it
// invisible to support: worst case it sorts last.
const MEASUREMENT_ORDER = [
  "chest",
  "waist",
  "hips",
  "shoulders",
  "shoulder",
  "sleeve_length",
  "neck",
  "inseam",
  "thigh",
  "knee",
  "calf",
  "bicep",
  "wrist",
  "shirt_length",
  "kurta_length",
  "trouser_length",
];

export function orderedMeasurementKeys(
  m: Record<string, number | null>,
): string[] {
  const present = Object.keys(m).filter((k) => m[k] != null);
  const rank = (k: string) => {
    const i = MEASUREMENT_ORDER.indexOf(k);
    return i === -1 ? MEASUREMENT_ORDER.length : i;
  };
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
