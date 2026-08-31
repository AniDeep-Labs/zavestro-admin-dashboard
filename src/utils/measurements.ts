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

/**
 * [DSG-13-13] A measurement key as a person says it.
 *
 * The engine's finished spec is keyed by snake_case (`leg_opening`, `bust_dart`), and the
 * Engine Tester rendered those keys raw while every other surface humanises them. The few
 * that do not survive a mechanical title-case get an explicit entry; everything else falls
 * through, so a new engine field shows up readable rather than not at all.
 */
const MEASUREMENT_LABELS: Record<string, string> = {
  leg_opening: 'Leg opening',
  bust_dart: 'Bust dart',
  shirt_length: 'Garment length',
  height_cm: 'Height (cm)',
  usual_size: 'Usual size',
  hip: 'Hip',
  rise: 'Rise',
};

export function measurementLabel(key: string): string {
  return (
    MEASUREMENT_LABELS[key] ??
    key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}
