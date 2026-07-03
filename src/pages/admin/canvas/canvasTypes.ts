/**
 * Canvas design document — a free-form, multi-element banner/collection design
 * (Canva/Figma-style). Stored as JSON in compose_style.canvas; the same document
 * is drawn by the editor (admin) and the storefront renderer (WYSIWYG).
 *
 * Geometry is percentage-based (0–100 of the art-board), so a design scales to any
 * rendered width. Font sizes are in cqw (% of container width) for the same reason.
 */

export type CanvasElementType = 'text' | 'button' | 'rect' | 'ellipse' | 'image';

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number; y: number;      // top-left, % of board
  w: number; h: number;      // size, % of board
  rotation: number;          // degrees
  opacity: number;           // 0–1
  locked?: boolean;          // can't be moved/edited
  hidden?: boolean;          // not rendered
  // text / button
  text?: string;
  font?: 'sans' | 'serif' | 'display' | 'mono';
  size?: number;             // cqw
  weight?: number;           // 300–900
  color?: string;
  align?: 'left' | 'center' | 'right';
  letterSpacing?: number;    // em ×100
  lineHeight?: number;       // ×100
  shadow?: number;           // 0–100 drop-shadow intensity (text/button/shape/image)
  // shape / button
  fill?: string;
  fillType?: 'solid' | 'gradient';
  fill2?: string;            // gradient end colour
  fillAngle?: number;        // gradient angle (deg)
  stroke?: string;
  strokeW?: number;          // cqw (shape border; text outline)
  radius?: number;           // cqw (button/rect corner)
  // image
  imageKey?: string;
  fit?: 'cover' | 'contain';
  focalX?: number; focalY?: number;
  // button link — `link` is the resolved path; `linkType` remembers how it was authored
  link?: string;
  linkType?: LinkType;
  // content binding — a bound text element mirrors the banner/collection Headline
  // or Subtitle field (two-way in the banner studio).
  bind?: 'title' | 'subtitle';
  // entrance animation (played in preview + on the storefront, not while editing)
  anim?: AnimType;
  animDelay?: number;        // ms before it starts
  animDuration?: number;     // ms
}

export type LinkType = 'category' | 'collection' | 'url';

/** Build a destination path from a link type + slug/path (mirrors the banner CTA). */
export const resolveLink = (type: LinkType, value: string): string => {
  const v = value.trim();
  return type === 'collection' ? (v ? `/collections/${v}` : '/collections')
    : type === 'category' ? (v ? `/categories/${v}` : '/categories')
      : v;
};
/** Best-guess the link type from an existing resolved path. */
export const linkTypeOf = (link?: string): LinkType => {
  const l = (link ?? '').trim();
  if (l.startsWith('/collections')) return 'collection';
  if (l.startsWith('/categories')) return 'category';
  return 'url';
};
/** Recover the slug/path from a resolved link, given its (stored) type. */
export const linkValueOf = (type: LinkType, link?: string): string => {
  const l = (link ?? '').trim();
  if (type === 'collection') return l.replace(/^\/collections\/?/, '');
  if (type === 'category') return l.replace(/^\/categories\/?/, '');
  return l;
};

export type AnimType = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom' | 'rise' | 'pop';
export type KenBurns = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';

/** Maps an animation type to its global keyframe name (defined in Canvas.module.css). */
export const ANIM_KEYFRAME: Record<AnimType, string | null> = {
  none: null, fade: 'cnvFade', 'slide-up': 'cnvSlideUp', 'slide-down': 'cnvSlideDown',
  'slide-left': 'cnvSlideLeft', 'slide-right': 'cnvSlideRight', zoom: 'cnvZoom', rise: 'cnvRise', pop: 'cnvPop',
};
export const KENBURNS_KEYFRAME: Record<KenBurns, string | null> = {
  none: null, 'zoom-in': 'cnvKenZoomIn', 'zoom-out': 'cnvKenZoomOut', 'pan-left': 'cnvKenPanLeft', 'pan-right': 'cnvKenPanRight',
};

export interface CanvasBackground {
  type: 'gradient' | 'solid' | 'image';
  color1: string;
  color2: string;
  angle: number;
  imageKey?: string;
  fit?: 'cover' | 'contain';
  focalX?: number; focalY?: number;
  overlay?: number;          // 0–100 dark scrim over a bg image
  kenBurns?: KenBurns;       // slow ambient motion on the bg image
}

export interface CanvasDoc {
  version: 1;
  background: CanvasBackground;
  elements: CanvasElement[];
}

export const emptyCanvas = (bg: Partial<CanvasBackground> = {}): CanvasDoc => ({
  version: 1,
  background: { type: 'gradient', color1: '#1F6B4F', color2: '#0D3D2C', angle: 135, fit: 'cover', focalX: 50, focalY: 50, overlay: 0, ...bg },
  elements: [],
});

let _n = 0;
export const newId = () => `el_${Date.now().toString(36)}_${(_n++).toString(36)}`;

export const DEFAULT_ELEMENT: Record<CanvasElementType, () => Omit<CanvasElement, 'id'>> = {
  text: () => ({ type: 'text', x: 8, y: 40, w: 60, h: 16, rotation: 0, opacity: 1, text: 'Your headline', font: 'sans', size: 7, weight: 800, color: '#ffffff', align: 'left', letterSpacing: -2, lineHeight: 105 }),
  button: () => ({ type: 'button', x: 8, y: 72, w: 26, h: 10, rotation: 0, opacity: 1, text: 'Shop Now', font: 'sans', size: 3, weight: 700, color: '#141210', fill: '#ffffff', radius: 50, link: '/categories', align: 'center' }),
  rect: () => ({ type: 'rect', x: 10, y: 10, w: 30, h: 18, rotation: 0, opacity: 1, fill: '#ffffff', radius: 2 }),
  ellipse: () => ({ type: 'ellipse', x: 10, y: 10, w: 24, h: 24, rotation: 0, opacity: 1, fill: '#C9995E' }),
  image: () => ({ type: 'image', x: 55, y: 12, w: 38, h: 76, rotation: 0, opacity: 1, imageKey: '', fit: 'cover', focalX: 50, focalY: 50, radius: 2 }),
};
