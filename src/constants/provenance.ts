/**
 * Mirrors `src/shared/provenance-copy.ts` in the backend. [DSG-11-19]
 *
 * A trouser chart carries two columns (waist, hip); the preview returns seven fields. The
 * other five come from constants the editor never showed — `hip ≈ waist + 2.76"`, thigh and
 * knee as India waist-ratios, `rise` defaulting to 10.5, `leg_opening = knee + hem_vs_knee`.
 * The engine code calls these "placeholder priors until the sew-test run" and tags each
 * field, but the tag never reached the screen, so a placeholder-driven spec was presented
 * with exactly the same confidence as a calibrated one.
 *
 * Parity with the backend copy is covered by a test there.
 */
export type AuthorityTag =
  | 'measured'
  | 'observed'
  | 'geometric_derived'
  | 'defaulted_final'
  | 'defaulted_provisional'
  | 'declined';

export interface ProvenanceCopy {
  label: string;
  detail: string;
  provisional: boolean;
}

export const PROVENANCE_COPY: Record<AuthorityTag, ProvenanceCopy> = {
  measured: {
    label: 'measured',
    detail: 'Taped on the customer at the visit. The strongest claim the system can make.',
    provisional: false,
  },
  observed: {
    label: 'observed',
    detail: 'From a fitting observation or a confirmed alteration delta, not a tape reading.',
    provisional: false,
  },
  geometric_derived: {
    label: 'derived',
    detail: 'Computed from other MEASURED numbers on this customer, not from a population average.',
    provisional: false,
  },
  defaulted_final: {
    label: 'from chart',
    detail: 'Read from this garment type’s size chart — a model of a body, but one you calibrated.',
    provisional: false,
  },
  defaulted_provisional: {
    label: 'engine default',
    detail:
      'Not in your chart. Filled from a national-average relation with a ±4cm residual, and marked provisional until the sew-test run. Add this column to the chart to replace it.',
    provisional: true,
  },
  declined: {
    label: 'declined',
    detail: 'The customer declined this measurement; the order proceeds on a derived value.',
    provisional: true,
  },
};

/**
 * A field the engine returned with NO tag at all. Saying "not stated" is the honest
 * rendering — the alternative is leaving the cell blank, which reads as "fine".
 */
export const UNTAGGED: ProvenanceCopy = {
  label: 'not stated',
  detail:
    'The engine returned this number without recording where it came from. Treat it as uncalibrated until the engine tags it.',
  provisional: true,
};

export function provenanceFor(tag: string | undefined | null): ProvenanceCopy {
  if (!tag) return UNTAGGED;
  return PROVENANCE_COPY[tag as AuthorityTag] ?? UNTAGGED;
}

/**
 * A value the caller supplied and the engine echoed back. The engine does not tag these —
 * it has nothing to say about a number it was handed — but rendering an operator's own
 * input as "not stated" would be its own small lie. [DSG-11-19]
 */
export const ENTERED: ProvenanceCopy = {
  label: 'you entered',
  detail: 'You supplied this value on this run; the engine used it as given.',
  provisional: false,
};
