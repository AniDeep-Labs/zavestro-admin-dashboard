/**
 * Chart palette — a PLAIN module (no components), so react-refresh stays happy.
 * Same reason as StatusBadge/vocab.ts and EmptyState/asyncState.ts.
 */
export const STAGE_COLORS = ['#1F6B4F', '#4B8DC8', '#D4A574', '#E4952A', '#9B7FB8', '#5BAE8E', '#C98B6B', '#7C8B57'];

/**
 * [KA8-19] A sequential ramp for the Production Funnel, replacing eight arbitrary
 * hues used with no legend.
 *
 * Measured on STAGE_COLORS: **13 of 28 pairs fall under 1.30:1 luminance
 * contrast**, with blue/violet (#4B8DC8 / #9B7FB8) at **1.03:1** — indistinguishable
 * to anyone with a colour-vision deficiency, in greyscale, or on a projector.
 *
 * The deeper problem is not the palette, it is the claim: on a bar chart whose X
 * axis already names every stage, **hue carries no information at all**. It was
 * decoration wearing the costume of an encoding, and a legend would have
 * legitimised the costume rather than removed it.
 *
 * A funnel does have one real ordinal dimension — position in the pipeline — so
 * this encodes THAT, as monotonic lightness of a single hue. Adjacent bars are
 * then always distinguishable by luminance alone, which is the property the eight
 * hues never had.
 */
export function stageRamp(n: number): string[] {
  if (n <= 0) return [];
  // Brand green, lightened along the pipeline. L 26% → 66% keeps every step
  // above the ~1.2:1 adjacent contrast the old palette failed.
  return Array.from({ length: n }, (_, i) => {
    const l = 26 + (n === 1 ? 0 : (i / (n - 1)) * 40);
    return `hsl(157 55% ${l.toFixed(1)}%)`;
  });
}