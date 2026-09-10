/**
 * [CM-22-8] Layout metadata and the hero's data shape — deliberately NOT in BannerHero.tsx.
 *
 * `react-refresh/only-export-components` is the reason, and it is a real one rather than
 * lint pedantry: a module that exports both components and plain values cannot be hot-
 * replaced, so editing a layout constant would blow away the editor's in-progress state.
 * Extracting the renderer out of BannersPage without this split simply MOVED the violation —
 * it went from one suppressed error to two live ones.
 */
import type {
  BannerLayout,
  BannerTextPosition,
  BannerTextColor,
  BannerImageFit,
  BannerCtaStyle,
  BannerComposeStyle,
} from '../../../api/adminApi';
import type { CanvasDoc } from '../canvas/canvasTypes';

type LayoutMeta = { id: BannerLayout; label: string; on: ('mobile' | 'web')[] };
// App and web get purpose-built layout families. Mobile = immersive, app-native
// hero styles (story, poster, diagonal, framed…). Web = wide editorial billboards.
export const LAYOUTS: LayoutMeta[] = [
  // ── App-native (mobile-first, matched to Myntra app heroes) ──
  { id: 'story',       label: 'Hero story',      on: ['mobile'] },
  { id: 'curated',     label: 'Curated looks',   on: ['mobile'] },
  { id: 'poster',      label: 'Poster',          on: ['mobile'] },
  { id: 'diagonal',    label: 'Diagonal',        on: ['mobile', 'web'] },
  { id: 'framed',      label: 'Framed editorial',on: ['mobile'] },
  { id: 'card',        label: 'Floating card',   on: ['mobile'] },
  { id: 'lookbook',    label: 'Lookbook',        on: ['mobile'] },
  { id: 'offer_badge', label: 'Offer badge',     on: ['mobile', 'web'] },
  { id: 'centered',    label: 'Centered',        on: ['mobile', 'web'] },
  { id: 'full_image',  label: 'Full-image',      on: ['mobile', 'web'] },
  { id: 'image_only',  label: 'Image only',      on: ['mobile', 'web'] },
  // ── Web editorial (wide) — Myntra/Ajio-style premium ──
  { id: 'showcase',    label: 'Showcase',        on: ['web'] },
  { id: 'spotlight',   label: 'Brand spotlight', on: ['web'] },
  { id: 'split',       label: 'Split',           on: ['web'] },
  { id: 'editorial',   label: 'Editorial',       on: ['web'] },
  { id: 'text_cutout', label: 'Text + product',  on: ['web'] },
  { id: 'bottom_bar',  label: 'Bottom bar',      on: ['web'] },
  { id: 'minimal',     label: 'Minimal banded',  on: ['web'] },
];
export const layoutsFor = (dev: 'mobile' | 'web') => LAYOUTS.filter(l => l.on.includes(dev));

export interface HeroData {
  layout: BannerLayout;
  title: string;
  subtitle?: string;
  tag?: string;
  ctaText?: string;
  imageUrl?: string;
  bgColor1: string;
  bgColor2: string;
  textPosition: BannerTextPosition;
  textColor: BannerTextColor;
  overlay: number;
  badgeText?: string;
  focalX?: number;
  focalY?: number;
  imageFit?: BannerImageFit;
  imageZoom?: number;
  aspectRatio?: number; // manual width/height override
  logoUrl?: string;
  showAd?: boolean;
  thumbUrls?: string[];
  pills?: string[];
  gradientAngle?: number;
  gradientSolid?: boolean;
  ctaStyle?: BannerCtaStyle;
  compose?: BannerComposeStyle;
  /** Explicit canvas doc to render (per-surface); overrides compose.canvas. */
  canvasDoc?: CanvasDoc;
  editable?: boolean;
  onDragText?: (x: number, y: number) => void;
}
