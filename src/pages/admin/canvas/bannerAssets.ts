/**
 * [CM-22-9] Reuse and asset provenance for banner canvases.
 *
 * The canvas had no library beyond the built-in starters, no way to carry a composition from
 * one banner to another, and no record of which uploaded creative came from where — the same
 * provenance gap [CM-18-6] names on listings.
 *
 * All three answers are already in the banner list the page loads. There is no table here and
 * no new column: the banners that exist ARE the library, and they ARE the record of where a
 * piece of creative is used. Pure functions, extracted from BannersPage so they can be
 * exercised by scripts/verify-banner-reuse.mjs — the page component is 1,400 lines and
 * nothing in it was testable ([CM-22-8]).
 */
import type { CanvasDoc } from './canvasTypes';

/** The subset of a banner these derivations need. */
export interface BannerAssetSource {
  id: string;
  title?: string;
  image_key?: string | null;
  logo_key?: string | null;
  compose_style?: {
    canvas?: unknown;
    canvas_mobile?: unknown;
    canvas_web?: unknown;
  } | null;
}

export type CanvasSlot = 'canvas_mobile' | 'canvas_web';

/**
 * The canvas a banner uses for one device. `canvas` is the pre-split shared field and is a
 * read-fallback for MOBILE only — web never borrows it, so designing mobile never bleeds
 * into web. That asymmetry is deliberate and mirrors BannersPage's own `canvasFor`.
 */
export function canvasForSlot(bn: BannerAssetSource, slot: CanvasSlot): CanvasDoc | undefined {
  const cs = bn.compose_style ?? {};
  const doc = slot === 'canvas_mobile' ? (cs.canvas_mobile ?? cs.canvas) : cs.canvas_web;
  return doc as CanvasDoc | undefined;
}

/**
 * Every image key a banner references: its own creative, its logo, and any image element in
 * any of its canvases (both devices and the legacy shared one — a key still referenced by the
 * web design is still in use, whichever device you happen to be editing).
 */
export function assetKeysOf(bn: BannerAssetSource): string[] {
  const out: string[] = [];
  const push = (k?: string | null) => {
    if (k) out.push(k);
  };
  push(bn.image_key);
  push(bn.logo_key);
  const cs = bn.compose_style ?? {};
  for (const slot of ['canvas_mobile', 'canvas_web', 'canvas'] as const) {
    const doc = cs[slot] as CanvasDoc | undefined;
    for (const el of doc?.elements ?? []) push(el.imageKey);
  }
  return out;
}

/**
 * Other banners holding a composition worth starting from, for this device. A banner with no
 * elements for this device is not offered — picking it would blank the canvas, which reads as
 * a bug rather than as a choice.
 */
export function startableFrom(
  library: BannerAssetSource[],
  selfId: string | undefined,
  slot: CanvasSlot,
): { bn: BannerAssetSource; doc: CanvasDoc }[] {
  const out: { bn: BannerAssetSource; doc: CanvasDoc }[] = [];
  for (const bn of library) {
    if (bn.id === selfId) continue;
    const doc = canvasForSlot(bn, slot);
    if (doc?.elements?.length) out.push({ bn, doc });
  }
  return out;
}

/**
 * For each asset THIS banner uses, the other banners that also use it. Reused creative is not
 * wrong — but replacing the file behind a key changes every banner showing it at once, so it
 * should be a decision rather than a discovery. Assets used nowhere else are omitted: the
 * point is the sharing, not an inventory.
 */
export function assetReuse(
  self: BannerAssetSource,
  library: BannerAssetSource[],
): { key: string; others: BannerAssetSource[] }[] {
  const mine = Array.from(new Set(assetKeysOf(self)));
  const out: { key: string; others: BannerAssetSource[] }[] = [];
  for (const key of mine) {
    const others = library.filter((bn) => bn.id !== self.id && assetKeysOf(bn).includes(key));
    if (others.length) out.push({ key, others });
  }
  return out;
}
