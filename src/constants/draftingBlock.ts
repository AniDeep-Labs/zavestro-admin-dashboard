/**
 * Mirrors `src/shared/drafting-block.ts` in the backend. [DSG-11-7]
 *
 * Which block a garment is drafted on used to be a hardcoded set in the backend service
 * (`new Set(['saree-blouse','salwar-kameez'])`), so a womenswear type created from this
 * console could never reach the engine's women's path and was silently drafted on the men's
 * block. It is a column now, and this file is the admin's copy of the vocabulary.
 */
export const DRAFTING_BLOCKS = ['mens_upper', 'womens_upper', 'lower'] as const;
export type DraftingBlock = (typeof DRAFTING_BLOCKS)[number];

export const DRAFTING_BLOCK_LABELS: Record<DraftingBlock, string> = {
  mens_upper: 'Upper — men’s block',
  womens_upper: 'Upper — women’s block',
  lower: 'Lower body',
};

export const DRAFTING_BLOCK_HINTS: Record<DraftingBlock, string> = {
  mens_upper: 'Drafted from chest, with waist suppression and a hem. Shirts, kurtas, blazers.',
  womens_upper:
    'Drafted from bust, with a bust dart and a silhouette (suppress / straight / flare). Saree blouses, salwar kameez, kurtis.',
  lower: 'Drafted from waist and hip, with a rise and an inseam. Trousers, jeans, palazzos.',
};

/**
 * FIRST entry is the engine's implicit default — what buildWomensUpper does when the mode is
 * absent (it falls through to the straight waist / chest hem branch). The editor writes the
 * first entry when the author leaves the field alone, so an untouched preset saves as what
 * the engine would already have done. [DSG-11-7]
 */
export const WAIST_MODES = ['straight', 'suppress', 'flare'] as const;
export const HEM_MODES = ['chest', 'hip', 'flare'] as const;

/** The block a loaded template is on, tolerating a row written before the column existed. */
export function blockOf(tpl: { drafting_block?: string | null; body_region?: string | null } | null | undefined): DraftingBlock {
  const stored = tpl?.drafting_block;
  if (stored && (DRAFTING_BLOCKS as readonly string[]).includes(stored)) {
    return stored as DraftingBlock;
  }
  return tpl?.body_region === 'lower' ? 'lower' : 'mens_upper';
}

/** The two params whose value is an enum rather than a measurement. */
export const MODE_PARAMS = ['waist_mode', 'hem_mode'] as const;

export function isModeParam(key: string): boolean {
  return (MODE_PARAMS as readonly string[]).includes(key);
}
