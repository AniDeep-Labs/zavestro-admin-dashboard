/* eslint-disable react-refresh/only-export-components -- this page also exports the
   reusable BannerHero renderer + layout helpers, shared by the collection studio. */
import React from 'react';
import { bannersApi, collectionsApi, categoriesAdminApi, uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import { istDayStart, istDayEnd } from '../../utils/dateWindow';
import type { Banner, BannerPayload, BannerLayout, BannerTextPosition, BannerTextColor, BannerImageFit, BannerMode, BannerCtaStyle, BannerComposeStyle } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Modal } from '../../components/Modal/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import styles from './PromoCodesPage.module.css';
import b from './BannersPage.module.css';
import { CanvasRender } from './canvas/CanvasRender';
import { CanvasEditor } from './canvas/CanvasEditor';
import { emptyCanvas, newId, DEFAULT_ELEMENT, type CanvasDoc } from './canvas/canvasTypes';
import { UilEye, UilEyeSlash, UilPen, UilPlus, UilTrashAlt } from "@iconscout/react-unicons";

// ─── Layout metadata + reusable hero renderer ───────────────────────────────────

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

/** Renders a banner exactly how the app hero composes it — reused by the live
 *  preview and the layout-gallery thumbnails. `frame` controls the aspect box. */
export function BannerHero({ data, frame, animate }: { data: HeroData; frame: 'mobile' | 'web' | 'fill'; animate?: boolean }) {
  const { layout, title, subtitle, tag, ctaText, imageUrl, bgColor1, bgColor2, textPosition, textColor, overlay, badgeText, focalX = 50, focalY = 50, imageFit = 'cover', imageZoom = 100,
    logoUrl, showAd, thumbUrls = [], pills = [], gradientAngle = 135, gradientSolid = false, ctaStyle = 'auto' } = data;
  const gradient = gradientSolid ? bgColor1 : `linear-gradient(${gradientAngle}deg, ${bgColor1}, ${bgColor2})`;
  // Directional scrim — darker on the text side, scaled by the overlay control.
  const o = Math.min(100, Math.max(0, overlay)) / 100;
  const scrim = textPosition === 'bottom'
    ? `linear-gradient(to top, rgba(0,0,0,${o}) 0%, rgba(0,0,0,${o * 0.4}) 45%, rgba(0,0,0,0) 78%)`
    : textPosition === 'center'
      ? `rgba(0,0,0,${o * 0.82})`
      : `linear-gradient(90deg, rgba(0,0,0,${o}) 0%, rgba(0,0,0,${o * 0.55}) 46%, rgba(0,0,0,${o * 0.1}) 100%)`;
  const posCls = textPosition === 'center' ? b.posCenter : textPosition === 'bottom' ? b.posBottom : b.posLeft;
  const colCls = textColor === 'dark' ? b.txtDark : b.txtLight;
  const isFill = frame === 'fill';
  // Aspect: thumbnails fill their box; previews use the manual aspect (w/h).
  const ar = data.aspectRatio ?? (frame === 'mobile' ? 0.8 : 2.667);
  const heroAR: React.CSSProperties = isFill ? {} : { aspectRatio: String(ar) };
  const heroCls = `${b.hero} ${isFill ? b.heroFill : ''} ${frame === 'web' ? b.web : ''} ${frame === 'mobile' ? b.stackable : ''}`;

  // Image art-direction — focal point, fit and zoom keep the subject framed
  // across every crop without re-uploading.
  const focalPos = `${focalX}% ${focalY}%`;
  const scaleT = imageZoom > 100 ? `scale(${imageZoom / 100})` : undefined;
  // Background-image layouts always cover (no letterbox bands); only the cut-out /
  // image-only layouts respect the Fit toggle (where "contain" is meaningful).
  const coverStyle: React.CSSProperties = { objectFit: 'cover', objectPosition: focalPos, transform: scaleT };
  const fitStyle: React.CSSProperties = { objectFit: imageFit, objectPosition: focalPos, transform: scaleT };
  const Img = imageUrl ? <img src={imageUrl} alt="" className={b.heroImg} style={coverStyle} /> : null;
  const FitImg = imageUrl ? <img src={imageUrl} alt="" className={b.heroImg} style={fitStyle} /> : null;

  const text = (withCta = true) => (
    <>
      {tag && <span className={b.heroTag}>{tag}</span>}
      <span className={b.heroTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
      {subtitle && <span className={b.heroSub}>{subtitle}</span>}
      {withCta && <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>}
    </>
  );

  // ── Free design mode ──
  const c = data.compose;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  // Canvas document (Canva-style multi-element design) takes precedence over the
  // legacy single-text free mode.
  const canvasDoc = data.canvasDoc ?? (c?.free ? (c.canvas as CanvasDoc | undefined) : undefined);
  if (canvasDoc && canvasDoc.elements) {
    return <CanvasRender doc={canvasDoc} aspect={ar} animate={animate} />;
  }
  if (c?.free) {
    const fontCls = c.font === 'serif' ? b.fontSerif : c.font === 'display' ? b.fontDisplay : b.fontSans;
    const tx = c.x ?? 8, ty = c.y ?? 66, align = c.align ?? 'left', scale = c.scale ?? 1;
    const alignItems = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
    const move = (clientX: number, clientY: number) => {
      const r = rootRef.current?.getBoundingClientRect(); if (!r || !data.onDragText) return;
      data.onDragText(
        Math.round(Math.min(96, Math.max(2, ((clientX - r.left) / r.width) * 100))),
        Math.round(Math.min(96, Math.max(2, ((clientY - r.top) / r.height) * 100))),
      );
    };
    const titleStyle: React.CSSProperties = {
      fontSize: `calc(8cqw * ${scale})`, color: c.headlineColor || (textColor === 'dark' ? '#141210' : '#fff'),
      fontWeight: c.weight ?? 800, letterSpacing: `${(c.tracking ?? -2) / 100}em`,
    };
    return (
      <div className={heroCls} ref={data.editable ? rootRef : undefined}
        style={{ background: gradient, ...heroAR }}
        onMouseDown={data.editable ? e => { dragging.current = true; move(e.clientX, e.clientY); } : undefined}
        onMouseMove={data.editable ? e => { if (dragging.current) move(e.clientX, e.clientY); } : undefined}
        onMouseUp={data.editable ? () => { dragging.current = false; } : undefined}
        onMouseLeave={data.editable ? () => { dragging.current = false; } : undefined}>
        {Img}
        {imageUrl && overlay > 0 && <div className={b.heroScrim} style={{ background: `rgba(0,0,0,${o * 0.72})` }} />}
        {showAd && <span className={b.adLabel}>AD</span>}
        <div className={`${b.freeText} ${fontCls} ${data.editable ? b.freeTextEditable : ''}`}
          style={{ left: `${tx}%`, top: `${ty}%`, alignItems, textAlign: align }}>
          {logoUrl ? <span className={b.brandChip}><img src={logoUrl} alt="" className={b.brandLogo} /></span>
            : tag ? <span className={b.brandChip}>{tag}</span> : null}
          <span className={b.freeTitle} style={titleStyle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
          {subtitle && <span className={b.freeSub} style={{ color: c.headlineColor || (textColor === 'dark' ? '#141210' : '#fff') }}>{subtitle}</span>}
          {ctaStyle !== 'none' && (
            <span className={b.freeCta} style={{ background: c.ctaBg || '#fff', color: c.ctaColor || '#141210' }}>{ctaText || 'Shop Now'} →</span>
          )}
        </div>
      </div>
    );
  }

  switch (layout) {
    // ── App-native: Myntra hero — full-bleed photo, brand chip, bold headline,
    //    circular arrow CTA bottom-right (refs: Mnow / G-Shock / Polo). ──
    case 'story':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          <div className={b.storyScrim} />
          {showAd && <span className={b.adLabel}>AD</span>}
          <div className={b.storyText}>
            {logoUrl ? <span className={b.brandChip}><img src={logoUrl} alt="" className={b.brandLogo} /></span>
              : tag ? <span className={b.brandChip}>{tag}</span> : null}
            <span className={b.storyTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
            {subtitle && <span className={b.storySub}>{subtitle}</span>}
            {ctaStyle === 'pill' && <span className={b.storyPill}>{ctaText || 'Shop Now'} →</span>}
          </div>
          {ctaStyle !== 'none' && ctaStyle !== 'pill' && <span className={b.circleArrow}>›</span>}
        </div>
      );
    // ── App-native: Myntra "Curated Looks" — gradient frame, corner ribbon,
    //    inner image card with uppercase headline, caption + arrow below. ──
    case 'curated':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          <div className={b.curWrap}>
            <div className={b.curRow}>
              <div className={b.curCard}>
                {Img ?? <div className={b.heroEmpty} style={{ background: 'var(--color-bg-secondary)' }} />}
                <div className={b.curRibbon}>{tag || 'CURATED LOOKS'}</div>
                {/* Floating product pills (refs: Grooming Essentials) */}
                {pills.length > 0 && (
                  <div className={b.curPills}>
                    {pills.slice(0, 3).map((p, i) => <span key={i} className={b.curPill}>{p}</span>)}
                  </div>
                )}
                <span className={b.curTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
              </div>
              {/* Shop-the-look thumbnail strip (refs: Everyday Cargos) */}
              {thumbUrls.length > 0 && (
                <div className={b.curThumbs}>
                  {thumbUrls.slice(0, 3).map((u, i) => <div key={i} className={b.curThumb}><img src={u} alt="" /></div>)}
                </div>
              )}
            </div>
            <div className={b.curFoot}>
              <span className={b.curCaption}>{subtitle || ctaText || 'Explore the edit'}</span>
              <span className={b.circleArrowDark}>›</span>
            </div>
          </div>
        </div>
      );
    // ── App-native: poster — colour headline band on top, image below ──
    case 'poster':
      return (
        <div className={heroCls} style={{ ...heroAR }}>
          <div className={b.posterWrap}>
            <div className={`${b.posterBand} ${colCls}`} style={{ background: gradient }}>
              {tag && <span className={b.heroTag}>{tag}</span>}
              <span className={b.posterTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
              <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>
            </div>
            <div className={b.posterImg} style={imageUrl ? undefined : { background: gradient }}>{Img}</div>
          </div>
        </div>
      );
    // ── App-native: diagonal split (image / colour divided by a slash) ──
    case 'diagonal':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          <div className={b.diagPanel} style={{ background: bgColor1 }} />
          <div className={`${b.diagText} ${colCls}`}>
            {tag && <span className={b.heroTag}>{tag}</span>}
            <span className={b.heroTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
            {subtitle && <span className={b.heroSub}>{subtitle}</span>}
            <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>
          </div>
        </div>
      );
    // ── App-native: framed editorial (thick colour frame + caption bar) ──
    case 'framed':
      return (
        <div className={heroCls} style={{ background: bgColor1, ...heroAR }}>
          <div className={b.frameInner}>
            {Img ?? <div className={b.heroEmpty} style={{ background: gradient }} />}
            <div className={b.frameCaption}>
              {tag && <span className={b.heroTag} style={{ color: bgColor1 }}>{tag}</span>}
              <span className={b.frameTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
            </div>
          </div>
          <span className={b.frameCta} style={{ color: bgColor1 }}>{ctaText || 'Shop Now'} →</span>
        </div>
      );
    case 'image_only':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {FitImg ?? <div className={b.heroEmpty}>Image-only — upload a creative</div>}
        </div>
      );
    case 'centered':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          {imageUrl && <div className={b.heroScrim} style={{ background: scrim }} />}
          <div className={`${b.heroTextCenter} ${colCls}`}>{text()}</div>
        </div>
      );
    // ── Web premium: Ajio-style showcase — image + light info panel, dark brand
    //    strip, price callout, black pill CTA. ──
    case 'showcase':
      return (
        <div className={heroCls} style={heroAR}>
          <div className={b.heroRow}>
            <div className={b.scImg} style={imageUrl ? undefined : { background: gradient }}>{Img}</div>
            <div className={b.scPanel}>
              {title && <span className={b.scTitle}>{(title).replace(/\\n/g, '\n')}</span>}
              {tag && <div className={b.scStrip} style={{ background: bgColor1 }}>{tag}</div>}
              {subtitle && <span className={b.scPrice}>{subtitle}</span>}
              <span className={b.scCta}>{ctaText || 'Shop Now'}</span>
            </div>
          </div>
        </div>
      );
    // ── Web premium: Myntra-style spotlight — big serif brand, soft image fade,
    //    price line, thin rule, ghost "Explore" link. ──
    case 'spotlight':
      return (
        <div className={heroCls} style={heroAR}>
          <div className={b.heroRow}>
            <div className={b.spImg} style={imageUrl ? undefined : { background: gradient }}>
              {Img}<div className={b.spFade} />
            </div>
            <div className={b.spPanel}>
              <span className={b.spBrand}>{(title || 'Brand').replace(/\\n/g, '\n')}</span>
              {subtitle && <span className={b.spOffer}>{subtitle}</span>}
              <span className={b.spRule} />
              <span className={b.spLink}>+ {ctaText || 'Explore'}</span>
            </div>
          </div>
        </div>
      );
    case 'split':
      return (
        <div className={heroCls} style={heroAR}>
          <div className={b.heroRow}>
            <div className={b.splitImg} style={imageUrl ? undefined : { background: gradient }}>{Img}</div>
            <div className={`${b.splitText} ${colCls}`} style={{ background: bgColor1 }}>{text()}</div>
          </div>
        </div>
      );
    case 'editorial':
      return (
        <div className={heroCls} style={heroAR}>
          <div className={b.heroRow}>
            <div className={b.splitImg} style={imageUrl ? undefined : { background: gradient }}>{Img}</div>
            <div className={`${b.splitText} ${colCls}`} style={{ background: bgColor1 }}>
              {tag && <span className={b.heroTag}>{tag}</span>}
              <span className={b.heroTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
              <span className={b.edRule} />
              {subtitle && <span className={b.heroSub}>{subtitle}</span>}
              <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>
            </div>
          </div>
        </div>
      );
    case 'text_cutout':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          <div className={b.heroRow}>
            <div className={`${b.tiText} ${colCls}`}>{text()}</div>
            <div className={b.tiImg}>{FitImg ?? <div className={b.heroEmpty}>Product →</div>}</div>
          </div>
        </div>
      );
    case 'offer_badge':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          {imageUrl && <div className={b.heroScrim} style={{ background: scrim }} />}
          <div className={`${b.heroText} ${posCls} ${colCls}`}>
            {badgeText && <span className={b.badge}>{badgeText}</span>}
            {tag && <span className={b.heroTag}>{tag}</span>}
            <span className={b.heroTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
            {subtitle && <span className={b.heroSub}>{subtitle}</span>}
            <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>
          </div>
        </div>
      );
    case 'minimal':
      return (
        <div className={heroCls} style={{ background: 'var(--color-bg-card)', ...heroAR }}>
          <div className={b.minWrap}>
            <div className={`${b.minText} ${b.txtDark}`}>
              <span className={b.minBand} style={{ background: bgColor1 }} />
              {tag && <span className={b.heroTag}>{tag}</span>}
              <span className={b.heroTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
              {subtitle && <span className={b.heroSub}>{subtitle}</span>}
              <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>
            </div>
            <div className={b.minImg} style={imageUrl ? undefined : { background: gradient }}>{Img}</div>
          </div>
        </div>
      );
    case 'bottom_bar':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          <div className={`${b.barWrap} ${colCls}`} style={{ background: bgColor1 }}>
            <div className={b.barText}>
              {tag && <span className={b.heroTag}>{tag}</span>}
              <span className={b.heroTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
            </div>
            <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>
          </div>
        </div>
      );
    case 'card':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          <div className={b.cardFloat}>
            <div className={`${b.cardInner} ${b.txtDark}`}>
              {tag && <span className={b.heroTag}>{tag}</span>}
              <span className={b.heroTitle}>{(title || 'Headline').replace(/\\n/g, '\n')}</span>
              {subtitle && <span className={b.heroSub}>{subtitle}</span>}
              <span className={b.heroCta}>{ctaText || 'Shop Now'}</span>
            </div>
          </div>
        </div>
      );
    case 'lookbook':
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          <div className={b.lookScrim} />
          <div className={`${b.lookText} ${b.txtLight}`}>{text()}</div>
        </div>
      );
    case 'full_image':
    default:
      return (
        <div className={heroCls} style={{ background: gradient, ...heroAR }}>
          {Img}
          {imageUrl && <div className={b.heroScrim} style={{ background: scrim }} />}
          <div className={`${b.heroText} ${posCls} ${colCls}`}>{text()}</div>
        </div>
      );
  }
}

// ─── Device chrome (phone / browser) wrapping a live hero — reused by the side
//     preview rail and the full-screen device preview modal (banner + collection
//     studios, so both share an identical preview shell). ───────────────────────
export function DeviceShell({ frame, hero, addr = 'zavestro.com' }: { frame: 'mobile' | 'web'; hero: React.ReactNode; addr?: string }) {
  if (frame === 'mobile') {
    return (
      <div className={b.phone}><div className={b.phoneScreen}>
        <div className={b.phoneNotch}><div className={b.phoneNotchPill} /></div>
        <div className={b.phoneAppbar}><span className={b.phoneLogo}>Zavestro</span><span className={b.phoneIcon} /></div>
        <div className={b.phoneHero}>{hero}</div>
        <div className={b.phoneDots}><span className={`${b.phoneDot} ${b.phoneDotOn}`} /><span className={b.phoneDot} /><span className={b.phoneDot} /></div>
        <div className={b.phoneContent}>
          <div className={b.phoneCircles}>{[0, 1, 2, 3].map(i => <div key={i} className={b.phoneCircle}><i /><span /></div>)}</div>
          <div className={b.phoneGrid}>{[0, 1, 2, 3].map(i => <div key={i} className={b.phoneCardImg} />)}</div>
        </div>
      </div></div>
    );
  }
  return (
    <div className={b.browser}>
      <div className={b.browserBar}><div className={b.browserDots}><span className={`${b.bDot} ${b.bDotR}`} /><span className={`${b.bDot} ${b.bDotY}`} /><span className={`${b.bDot} ${b.bDotG}`} /></div><div className={b.browserAddr}>{addr}</div></div>
      <div className={b.webNav}><span className={b.webNavLogo}>Zavestro</span><div className={b.webNavLinks}><span>New In</span><span>Men</span><span>Women</span><span>Occasion</span><span>Sale</span></div></div>
      <div className={b.webHeroStage}>{hero}</div>
      <div className={b.webBelow}>{[0, 1, 2, 3].map(i => <div key={i} className={b.webCardImg} />)}</div>
    </div>
  );
}

// ─── Banner studio (two-pane authoring + live phone preview) ─────────────────────

function BannerForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: BannerPayload & { id?: string };
  onSave: (data: BannerPayload) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [dev, setDev] = React.useState<'mobile' | 'web'>('mobile');
  const [showDevicePreview, setShowDevicePreview] = React.useState(false);
  const [replayKey, setReplayKey] = React.useState(0); // bump to replay entrance animations

  // Per-device creative + crop + mode
  const [modeMobile, setModeMobile] = React.useState<BannerMode>(initial.mode_mobile ?? 'upload');
  const [modeWeb, setModeWeb]       = React.useState<BannerMode>(initial.mode_web ?? 'upload');
  const [imageMobile, setImageMobile] = React.useState(initial.image_mobile ?? initial.image_key ?? '');
  const [imageWeb, setImageWeb]       = React.useState(initial.image_web ?? initial.image_key ?? '');
  const [fxM, setFxM] = React.useState<number>(initial.focal_x_mobile ?? 50);
  const [fyM, setFyM] = React.useState<number>(initial.focal_y_mobile ?? 50);
  const [fxW, setFxW] = React.useState<number>(initial.focal_x_web ?? 50);
  const [fyW, setFyW] = React.useState<number>(initial.focal_y_web ?? 50);

  // Shared composition (used when a device is in 'compose' mode)
  const [title, setTitle]       = React.useState(initial.title ?? '');
  const [subtitle, setSubtitle] = React.useState(initial.subtitle ?? '');
  const [tag, setTag]           = React.useState(initial.tag ?? '');
  const [ctaText, setCtaText]   = React.useState(initial.cta_text ?? 'Shop Now');
  const [bgColor1, setBgColor1] = React.useState(initial.bg_color_1 ?? '#1F6B4F');
  const [bgColor2, setBgColor2] = React.useState(initial.bg_color_2 ?? '#0D3D2C');
  const [layoutMobile, setLayoutMobile] = React.useState<BannerLayout>(initial.layout_mobile ?? initial.layout ?? 'story');
  const [layoutWeb, setLayoutWeb]       = React.useState<BannerLayout>(initial.layout_web ?? initial.layout ?? 'showcase');
  const [aspectMobile, setAspectMobile] = React.useState<number>(initial.aspect_mobile ?? 0.8);
  const [aspectWeb, setAspectWeb]       = React.useState<number>(initial.aspect_web ?? 2.667);
  const [textPosition, setTextPosition] = React.useState<BannerTextPosition>(initial.text_position ?? 'left');
  const [textColor, setTextColor]       = React.useState<BannerTextColor>(initial.text_color ?? 'light');
  const [overlay, setOverlay]   = React.useState<number>(initial.overlay ?? 40);
  const [badgeText, setBadgeText] = React.useState(initial.badge_text ?? '');

  // Studio v3: brand logo, AD, shoppable thumbs/pills, gradient + CTA
  const [logoKey, setLogoKey]   = React.useState(initial.logo_key ?? '');
  const [showAd, setShowAd]     = React.useState(initial.show_ad ?? false);
  const [thumbKeys, setThumbKeys] = React.useState<string[]>(initial.thumb_keys ?? []);
  const [pills, setPills]       = React.useState<string[]>(initial.pills ?? []);
  const [gradientAngle, setGradientAngle] = React.useState<number>(initial.gradient_angle ?? 135);
  const [gradientSolid, setGradientSolid] = React.useState(initial.gradient_solid ?? false);
  const [ctaStyle, setCtaStyle] = React.useState<BannerCtaStyle>(initial.cta_style ?? 'auto');
  const [cs, setCs] = React.useState<BannerComposeStyle>(initial.compose_style ?? {});
  const patchCs = (p: Partial<BannerComposeStyle>) => setCs(prev => ({ ...prev, ...p }));
  // Per-device canvas — mobile and web each get their own design; the legacy `canvas`
  // field is a read-fallback for records made before the split.
  const canvasKey: 'canvas_mobile' | 'canvas_web' = dev === 'mobile' ? 'canvas_mobile' : 'canvas_web';
  const otherCanvasKey: 'canvas_mobile' | 'canvas_web' = dev === 'mobile' ? 'canvas_web' : 'canvas_mobile';
  // Per-device canvas. Only Mobile (primary) inherits an old shared `canvas`; Web is
  // independent and never borrows it — designing mobile never bleeds into web.
  const canvasFor = (k: 'canvas_mobile' | 'canvas_web') => (k === 'canvas_mobile' ? (cs.canvas_mobile ?? cs.canvas) : cs.canvas_web) as CanvasDoc | undefined;
  const activeCanvas = canvasFor(canvasKey);
  // Two-way content ↔ canvas binding. The Headline/Subtitle field is shared, so a
  // field edit updates bound text in BOTH device canvases; guards avoid loops.
  const syncCanvasFromField = (bind: 'title' | 'subtitle', value: string) => {
    const patch: Partial<BannerComposeStyle> = {};
    for (const k of ['canvas_mobile', 'canvas_web'] as const) {
      const doc = cs[k] as CanvasDoc | undefined;
      if (!doc?.elements?.length) continue;
      let changed = false;
      const els = doc.elements.map(el => {
        if (el.type === 'text' && el.bind === bind && el.text !== value) { changed = true; return { ...el, text: value }; }
        return el;
      });
      if (changed) patch[k] = { ...doc, elements: els };
    }
    if (Object.keys(patch).length) patchCs(patch);
  };
  const syncFieldsFromCanvas = (doc: CanvasDoc) => {
    for (const el of doc.elements) {
      if (el.type !== 'text' || typeof el.text !== 'string') continue;
      if (el.bind === 'title' && el.text !== title) setTitle(el.text);
      else if (el.bind === 'subtitle' && el.text !== subtitle) setSubtitle(el.text);
    }
  };
  const updateTitle = (v: string) => { setTitle(v); syncCanvasFromField('title', v); };
  const updateSubtitle = (v: string) => { setSubtitle(v); syncCanvasFromField('subtitle', v); };
  const logoRef = React.useRef<HTMLInputElement>(null);
  const thumbRef = React.useRef<HTMLInputElement>(null);

  // Shared meta
  const [sortOrder, setSortOrder] = React.useState(String(initial.sort_order ?? 0));
  const [isActive, setIsActive]   = React.useState(initial.is_active ?? true);
  const [startsAt, setStartsAt]   = React.useState(initial.starts_at ? initial.starts_at.slice(0, 10) : '');
  const [endsAt, setEndsAt]       = React.useState(initial.ends_at ? initial.ends_at.slice(0, 10) : '');

  const [imageUploading, setImageUploading] = React.useState(false);
  const [imageError, setImageError] = React.useState('');
  const focalRef = React.useRef<HTMLDivElement>(null);
  const draggingFocal = React.useRef(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Smart CTA link. NOTE: on the storefront, collections render at /occasions/<slug>
  // (there is NO /collections route) — so a "collection" CTA must target /occasions, else
  // it 404s. We still detect legacy /collections/ links so old banners re-save correctly.
  const initLink = initial.cta_link ?? '/categories';
  const initType: 'collection' | 'category' | 'url' =
    initLink.startsWith('/occasions/') || initLink.startsWith('/collections/')
      ? 'collection'
      : initLink.startsWith('/categories') ? 'category' : 'url';
  const [linkType, setLinkType] = React.useState(initType);
  const [linkValue, setLinkValue] = React.useState(
    initType === 'collection' ? initLink.replace('/occasions/', '').replace('/collections/', '')
      : initType === 'category' ? initLink.replace('/categories/', '').replace('/categories', '')
        : initLink,
  );
  const ctaLink = linkType === 'collection' ? (linkValue.trim() ? `/occasions/${linkValue.trim()}` : '/occasions')
    : linkType === 'category' ? (linkValue.trim() ? `/categories/${linkValue.trim()}` : '/categories')
      : linkValue.trim();

  // CM-5: real collection/category slugs so a CTA can't typo its way to a 404. The 'url' type
  // keeps a free-text input for arbitrary paths.
  const [collOpts, setCollOpts] = React.useState<{ slug: string; name: string }[]>([]);
  const [catOpts, setCatOpts] = React.useState<{ slug: string; name: string }[]>([]);
  React.useEffect(() => {
    collectionsApi.list({ status: 'active' })
      .then((r) => setCollOpts(r.collections.filter((c) => c.slug).map((c) => ({ slug: c.slug, name: c.name }))))
      .catch(() => {});
    categoriesAdminApi.list()
      .then((cs) => setCatOpts(cs.filter((c) => c.is_active && c.slug).map((c) => ({ slug: c.slug, name: c.name }))))
      .catch(() => {});
  }, []);
  // The CTA-destination control: a real-slug picker for collection/category, free text for url.
  // The unknown current slug (e.g. an archived collection) is preserved as an extra option so
  // editing an old banner never silently drops its link.
  const linkValueControl = (() => {
    if (linkType === 'url') {
      return <input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} className={b.input} placeholder="/categories" />;
    }
    const opts = linkType === 'collection' ? collOpts : catOpts;
    const known = opts.some((o) => o.slug === linkValue);
    return (
      <select className={b.input} value={linkValue} onChange={(e) => setLinkValue(e.target.value)}>
        <option value="">{linkType === 'category' ? 'All categories' : 'Select a collection…'}</option>
        {!known && linkValue && <option value={linkValue}>{linkValue} (current)</option>}
        {opts.map((o) => <option key={o.slug} value={o.slug}>{o.name} · {o.slug}</option>)}
      </select>
    );
  })();

  // Active-device accessors
  const mode = dev === 'mobile' ? modeMobile : modeWeb;
  const setMode = dev === 'mobile' ? setModeMobile : setModeWeb;
  const imageKey = dev === 'mobile' ? imageMobile : imageWeb;
  const setImageKey = dev === 'mobile' ? setImageMobile : setImageWeb;
  const fx = dev === 'mobile' ? fxM : fxW;
  const fy = dev === 'mobile' ? fyM : fyW;
  const setFx = dev === 'mobile' ? setFxM : setFxW;
  const setFy = dev === 'mobile' ? setFyM : setFyW;
  const layout = dev === 'mobile' ? layoutMobile : layoutWeb;
  const setLayout = dev === 'mobile' ? setLayoutMobile : setLayoutWeb;
  const aspect = dev === 'mobile' ? aspectMobile : aspectWeb;
  const setAspect = dev === 'mobile' ? setAspectMobile : setAspectWeb;
  const previewUrl = imageKey ? (imageKey.startsWith('http') ? imageKey : `${R2_PUBLIC_URL}/${imageKey}`) : '';

  const setFocalFromPoint = (clientX: number, clientY: number) => {
    const el = focalRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setFx(Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))));
    setFy(Math.round(Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100))));
  };

  const handleImageFile = async (file: File) => {
    setImageError(''); setImageUploading(true);
    try { setImageKey(await uploadToR2(file, 'banners')); }
    catch { setImageError('Upload failed. Please try again.'); }
    finally { setImageUploading(false); }
  };
  const handleLogoFile = async (file: File) => {
    try { setLogoKey(await uploadToR2(file, 'banners')); }
    catch { setImageError('Logo upload failed.'); }
  };
  const handleThumbFile = async (file: File) => {
    try { const k = await uploadToR2(file, 'banners'); setThumbKeys(prev => [...prev, k].slice(0, 3)); }
    catch { setImageError('Thumbnail upload failed.'); }
  };
  const logoUrl = logoKey ? (logoKey.startsWith('http') ? logoKey : `${R2_PUBLIC_URL}/${logoKey}`) : '';
  const thumbUrls = thumbKeys.map(k => k.startsWith('http') ? k : `${R2_PUBLIC_URL}/${k}`);

  // A banner is saveable with a per-device image OR a canvas design OR a composed device.
  const hasCanvas = (['canvas_mobile', 'canvas_web', 'canvas'] as const).some(k => !!(cs[k] as CanvasDoc | undefined)?.elements?.length);
  const composed = modeMobile === 'compose' || modeWeb === 'compose' || modeMobile === 'canvas' || modeWeb === 'canvas';
  const canSave = !!title.trim() && (!!imageMobile || !!imageWeb || hasCanvas || composed);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      tag: tag.trim() || undefined,
      cta_text: ctaText.trim() || 'Shop Now',
      cta_link: ctaLink || '/categories',
      bg_color_1: bgColor1, bg_color_2: bgColor2,
      sort_order: parseInt(sortOrder, 10) || 0,
      is_active: isActive,
      starts_at: istDayStart(startsAt), // T1-22: IST day boundaries
      ends_at: istDayEnd(endsAt),
      layout: layoutWeb, text_position: textPosition, text_color: textColor, overlay,
      badge_text: (layoutMobile === 'offer_badge' || layoutWeb === 'offer_badge') ? (badgeText.trim() || undefined) : undefined,
      mode_mobile: modeMobile, mode_web: modeWeb,
      image_mobile: imageMobile || undefined,
      image_web: imageWeb || undefined,
      focal_x_mobile: fxM, focal_y_mobile: fyM, focal_x_web: fxW, focal_y_web: fyW,
      layout_mobile: layoutMobile, layout_web: layoutWeb,
      aspect_mobile: aspectMobile, aspect_web: aspectWeb,
      logo_key: logoKey || undefined,
      show_ad: showAd,
      thumb_keys: thumbKeys,
      pills: pills.map(p => p.trim()).filter(Boolean),
      gradient_angle: gradientAngle,
      gradient_solid: gradientSolid,
      cta_style: ctaStyle,
      compose_style: cs,
      image_key: (imageWeb || imageMobile) || undefined, // legacy back-compat
      image_only: false,
    });
  };

  // status chip
  const now = Date.now();
  const status = !isActive ? { label: 'Draft', cls: b.statusDraft }
    : startsAt && new Date(startsAt).getTime() > now ? { label: 'Scheduled', cls: b.statusScheduled }
      : endsAt && new Date(endsAt + 'T23:59:59').getTime() < now ? { label: 'Expired', cls: b.statusExpired }
        : { label: 'Active', cls: b.statusActive };

  // Recommended creative dimensions follow the chosen aspect for that device.
  const dimFor = (ratio: number, base: number) => `${base}×${Math.round(base / ratio)}`;
  const aspectHint = dev === 'mobile'
    ? `Mobile creative — design around ${dimFor(aspectMobile, 1200)} (${aspect.toFixed(2)}:1). Separate from web.`
    : `Web creative — design around ${dimFor(aspectWeb, 1920)} (${aspect.toFixed(2)}:1). Separate, wider.`;

  // Renders a device hero in the preview — uploaded creative or composed.
  const deviceHero = (frame: 'mobile' | 'web', animate?: boolean) => {
    const isM = frame === 'mobile';
    const m = isM ? modeMobile : modeWeb;
    const key = isM ? imageMobile : imageWeb;
    const ux = isM ? fxM : fxW;
    const uy = isM ? fyM : fyW;
    const lay = isM ? layoutMobile : layoutWeb;
    const ratio = isM ? aspectMobile : aspectWeb;
    const url = key ? (key.startsWith('http') ? key : `${R2_PUBLIC_URL}/${key}`) : '';
    if (m === 'upload') {
      return (
        <div className={`${b.hero} ${frame === 'mobile' ? b.stackable : b.web}`} style={{ background: 'var(--color-bg-secondary)', aspectRatio: String(ratio) }}>
          {url ? <img src={url} alt="" className={b.heroImg} style={{ objectFit: 'cover', objectPosition: `${ux}% ${uy}%` }} />
            : <div className={b.heroEmpty}>Upload {isM ? 'mobile' : 'web'} creative</div>}
        </div>
      );
    }
    if (m === 'canvas') {
      const doc = canvasFor(isM ? 'canvas_mobile' : 'canvas_web');
      return doc && doc.elements
        ? <CanvasRender doc={doc} aspect={ratio} animate={animate} />
        : <div className={`${b.hero}`} style={{ aspectRatio: String(ratio), background: 'var(--color-bg-secondary)' }}><div className={b.heroEmpty}>Add elements in the canvas →</div></div>;
    }
    // Compose: template render (no canvas/free).
    return <BannerHero frame={frame} data={{ layout: lay, aspectRatio: ratio, title, subtitle, tag, ctaText, imageUrl: url, focalX: ux, focalY: uy, imageFit: 'cover', imageZoom: 100, bgColor1, bgColor2, textPosition, textColor, overlay, badgeText: badgeText || '50% OFF',
      logoUrl, showAd, thumbUrls, pills, gradientAngle, gradientSolid, ctaStyle }} />;
  };

  return (
    <form onSubmit={submit}>
      <div className={b.studio}>
        <div className={`${b.studioPanes} ${mode === 'canvas' ? b.studioPanesCanvas : ''}`}>
          <div className={b.formPane}>
            {/* Device tabs — edit + preview that device */}
            <div className={b.deviceTabs}>
              <button type="button" className={`${b.deviceTab} ${dev === 'mobile' ? b.deviceTabOn : ''}`} onClick={() => setDev('mobile')}>📱 Mobile</button>
              <button type="button" className={`${b.deviceTab} ${dev === 'web' ? b.deviceTabOn : ''}`} onClick={() => setDev('web')}>🖥 Web</button>
            </div>

            {/* Mode for the active device */}
            <div className={b.section}>
              <p className={b.sectionHead}>{dev === 'mobile' ? 'Mobile banner' : 'Web banner'}</p>
              <div className={b.segmented}>
                <button type="button" className={`${b.seg} ${mode === 'upload' ? b.segActive : ''}`} onClick={() => setMode('upload')}>Upload creative</button>
                <button type="button" className={`${b.seg} ${mode === 'compose' ? b.segActive : ''}`} onClick={() => setMode('compose')}>Compose</button>
                <button type="button" className={`${b.seg} ${mode === 'canvas' ? b.segActive : ''}`} onClick={() => {
                  setMode('canvas');
                  const existing = activeCanvas;
                  if (!existing || !existing.elements?.length) {
                    const seed = emptyCanvas({ color1: bgColor1, color2: bgColor2, angle: gradientAngle });
                    seed.elements.push(
                      { id: newId(), ...DEFAULT_ELEMENT.text(), text: title || 'Your headline', y: 30, bind: 'title' },
                      { id: newId(), ...DEFAULT_ELEMENT.text(), text: subtitle || 'Add a supporting line', y: 52, size: 3.4, weight: 500, bind: 'subtitle' },
                      { id: newId(), ...DEFAULT_ELEMENT.button(), text: ctaText || 'Shop Now', link: ctaLink, linkType, y: 70 },
                    );
                    patchCs({ free: true, [canvasKey]: seed });
                  } else { patchCs({ free: true }); }
                }}>✎ Design canvas</button>
              </div>
              <span className={b.hint}>{mode === 'upload' ? 'Upload a finished, designed banner (text baked into the artwork) — the premium path.' : mode === 'canvas' ? 'Design freely on a canvas — add text, images, shapes & buttons (Canva-style).' : 'Build it from text + image + a layout, in the CMS.'}</span>
            </div>

            {/* Image + focal (upload + compose; canvas manages its own background) */}
            {mode !== 'canvas' && (
            <div className={b.section}>
              <p className={b.sectionHead}>{dev === 'mobile' ? 'Mobile' : 'Web'} image *</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className={b.hidden}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />
              {imageKey && previewUrl ? (
                <div className={b.imgControls}>
                  <div className={b.focalBox} ref={focalRef}
                    onMouseDown={e => { draggingFocal.current = true; setFocalFromPoint(e.clientX, e.clientY); }}
                    onMouseMove={e => { if (draggingFocal.current) setFocalFromPoint(e.clientX, e.clientY); }}
                    onMouseUp={() => { draggingFocal.current = false; }}
                    onMouseLeave={() => { draggingFocal.current = false; }}>
                    <img src={previewUrl} alt="" className={b.focalImg} style={{ objectPosition: `${fx}% ${fy}%` }} />
                    <span className={b.focalDot} style={{ left: `${fx}%`, top: `${fy}%` }} />
                  </div>
                  <span className={b.focalHint}>Drag the dot to set the focus — kept in frame when cropped.</span>
                  <div className={b.imgRow}>
                    <span className={b.imgKey}>{imageKey.split('/').pop()}</span>
                    <button type="button" onClick={() => fileRef.current?.click()} className={b.imgRemove}>Replace</button>
                    <button type="button" onClick={() => setImageKey('')} className={b.imgRemove}>Remove</button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={imageUploading} onClick={() => fileRef.current?.click()} className={`${b.input} ${b.chooseBtn}`}>
                  {imageUploading ? 'Uploading…' : `＋ Upload ${dev} creative`}
                </button>
              )}
              {imageError && <span className={`${b.hint} ${b.hintError}`}>{imageError}</span>}
              <span className={b.hint}>{aspectHint}</span>
            </div>
            )}

            {/* Size / ratio — always available (upload, compose, canvas) */}
            <div className={b.section}>
              <p className={b.sectionHead}>{dev === 'mobile' ? 'Mobile' : 'Web'} size &amp; ratio</p>
              <div className={b.fieldRowS}>
                <label className={b.label}>Ratio — {aspect < 1 ? `tall ${aspect.toFixed(2)} : 1` : `${aspect.toFixed(2)} : 1`}</label>
                <input type="range"
                  min={dev === 'mobile' ? 0.5 : 1.8} max={dev === 'mobile' ? 1.6 : 4} step={0.01}
                  value={aspect} onChange={e => setAspect(Number(e.target.value))} className={b.slider} />
                <div className={b.sizePresets}>
                  {(dev === 'mobile'
                    ? [['Tall', 0.66], ['Portrait', 0.8], ['Square', 1], ['Wide', 1.4]]
                    : [['Banner', 4], ['Wide', 2.667], ['Short', 2], ['Tall', 1.8]]).map(([lbl, v]) => (
                    <button type="button" key={lbl as string} className={`${b.sizePreset} ${Math.abs(aspect - (v as number)) < 0.02 ? b.sizePresetOn : ''}`} onClick={() => setAspect(v as number)}>{lbl}</button>
                  ))}
                </div>
                <span className={b.hint}>How tall/short this device's banner is.</span>
              </div>
            </div>

            {/* Design canvas mode — full editor (this device's own canvas) */}
            {mode === 'canvas' && (<>
              <CanvasEditor
                key={canvasKey}
                doc={activeCanvas ?? emptyCanvas({ color1: bgColor1, color2: bgColor2, angle: gradientAngle })}
                onChange={d => { patchCs({ [canvasKey]: d }); syncFieldsFromCanvas(d); }}
                aspect={aspect}
                defaultLink={ctaLink}
                content={{ title, subtitle }}
              />
              <div className={b.section}>
                <button type="button" className={b.devicePreviewBtn} disabled={!(cs[otherCanvasKey] as CanvasDoc | undefined)?.elements?.length}
                  onClick={() => { const o = cs[otherCanvasKey] as CanvasDoc | undefined; if (o) patchCs({ [canvasKey]: JSON.parse(JSON.stringify(o)) }); }}>
                  ⧉ Copy from {dev === 'mobile' ? 'Web' : 'Mobile'}
                </button>
                <span className={b.hint}>Mobile &amp; Web have separate designs. “Copy from” duplicates the other device here.</span>
              </div>
              <div className={b.section}>
                <p className={b.sectionHead}>Link &amp; schedule</p>
                <span className={b.hint}>Tapping this banner opens <code>{ctaLink || '/categories'}</code>. New Button elements inherit this link (change per-button in its properties).</span>
                <div className={b.grid2}>
                  <div className={b.fieldRowS}><label className={b.label}>Links to</label>
                    <select className={b.input} value={linkType} onChange={e => setLinkType(e.target.value as typeof linkType)}>
                      <option value="category">Category</option><option value="collection">Collection</option><option value="url">Custom path</option></select></div>
                  <div className={b.fieldRowS}><label className={b.label}>{linkType === 'collection' ? 'Collection' : linkType === 'category' ? 'Category' : 'Path'}</label>
                    {linkValueControl}</div>
                </div>
              </div>
            </>)}

            {/* Compose-only */}
            {mode === 'compose' && (<>
              <div className={b.section}>
                <p className={b.sectionHead}>{dev === 'mobile' ? 'Mobile layout' : 'Web layout'}</p>
                <div className={b.layoutGallery}>
                  {layoutsFor(dev).map(l => (
                    <button type="button" key={l.id} className={`${b.layoutCard} ${layout === l.id ? b.layoutCardActive : ''}`} onClick={() => setLayout(l.id)}>
                      {/* Thumbnail renders at the SAME device shape as the live preview (WYSIWYG) */}
                      <BannerHero frame={dev} data={{ layout: l.id, aspectRatio: aspect, title: title || 'Headline', subtitle: subtitle || 'Subtitle', tag: tag || 'TAG', ctaText: ctaText || 'Shop', imageUrl: previewUrl, bgColor1, bgColor2, textPosition, textColor, overlay, badgeText: badgeText || '50% OFF', focalX: fx, focalY: fy, imageFit: 'cover', imageZoom: 100, logoUrl, showAd, thumbUrls, pills, gradientAngle, gradientSolid, ctaStyle }} />
                      <span className={b.layoutCardLabel}>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={b.section}>
                <p className={b.sectionHead}>Content</p>
                <div className={b.fieldRowS}><label className={b.label}>Headline *</label>
                  <textarea value={title} onChange={e => updateTitle(e.target.value)} rows={2} className={b.input} placeholder={'Made to\nMeasure.'} /></div>
                <div className={b.fieldRowS}><label className={b.label}>Subtitle</label>
                  <input value={subtitle} onChange={e => updateSubtitle(e.target.value)} className={b.input} /></div>
                <div className={b.fieldRowS}><label className={b.label}>{layout === 'curated' ? 'Ribbon label' : 'Tag chip'}</label>
                  <input value={tag} onChange={e => setTag(e.target.value)} className={b.input} placeholder={layout === 'curated' ? 'CURATED LOOKS' : 'New Arrivals'} /></div>
                {layout === 'offer_badge' && <div className={b.fieldRowS}><label className={b.label}>Offer badge</label>
                  <input value={badgeText} onChange={e => setBadgeText(e.target.value)} className={b.input} placeholder="50% OFF" /></div>}
                {layout === 'story' && (
                  <div className={b.fieldRowS}>
                    <label className={b.label}>Brand logo (optional)</label>
                    <input ref={logoRef} type="file" accept="image/png,image/webp,image/svg+xml" className={b.hidden}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ''; }} />
                    {logoKey ? (
                      <div className={b.imgRow}>{logoUrl && <img src={logoUrl} alt="logo" className={b.logoThumb} />}<span className={b.imgKey}>{logoKey.split('/').pop()}</span><button type="button" onClick={() => setLogoKey('')} className={b.imgRemove}>Remove</button></div>
                    ) : <button type="button" onClick={() => logoRef.current?.click()} className={`${b.input} ${b.chooseBtn}`}>＋ Upload logo (transparent PNG)</button>}
                    <span className={b.hint}>Shown in the white chip; falls back to the tag text.</span>
                  </div>
                )}
                {(layout === 'curated' || layout === 'triptych') && (<>
                  <div className={b.fieldRowS}>
                    <label className={b.label}>{layout === 'triptych' ? 'Side panel images' : 'Shop-the-look thumbnails'} ({thumbKeys.length}/3)</label>
                    <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" className={b.hidden}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbFile(f); e.target.value = ''; }} />
                    <div className={b.thumbStrip}>
                      {thumbUrls.map((u, i) => <div key={i} className={b.thumbStripItem}><img src={u} alt="" /><button type="button" onClick={() => setThumbKeys(prev => prev.filter((_, j) => j !== i))}>×</button></div>)}
                      {thumbKeys.length < 3 && <button type="button" className={b.thumbAdd} onClick={() => thumbRef.current?.click()}>＋</button>}
                    </div>
                  </div>
                  {layout === 'curated' && (
                    <div className={b.fieldRowS}>
                      <label className={b.label}>Floating pills (optional)</label>
                      {pills.map((p, i) => <div key={i} className={b.pillRow}><input value={p} onChange={e => setPills(prev => prev.map((x, j) => j === i ? e.target.value : x))} className={b.input} placeholder="e.g. Grooming Set" /><button type="button" onClick={() => setPills(prev => prev.filter((_, j) => j !== i))} className={b.imgRemove}>×</button></div>)}
                      {pills.length < 3 && <button type="button" className={`${b.input} ${b.chooseBtn}`} onClick={() => setPills(prev => [...prev, ''])}>＋ Add pill</button>}
                    </div>
                  )}
                </>)}
                <span className={b.hint}>For full freeform design, switch this device to the <strong>Design canvas</strong> mode above.</span>
              </div>

              <div className={b.section}>
                <p className={b.sectionHead}>Style</p>
                <div className={b.grid2}>
                  <div className={b.fieldRowS}><label className={b.label}>{layout === 'split' ? 'Block colour' : 'Colour 1'}</label>
                    <div className={b.colorRow}><input type="color" value={bgColor1} onChange={e => setBgColor1(e.target.value)} className={b.colorSwatch} /><input value={bgColor1} onChange={e => setBgColor1(e.target.value)} className={`${b.input} ${b.colorInput}`} /></div></div>
                  <div className={b.fieldRowS}><label className={b.label}>Colour 2</label>
                    <div className={b.colorRow}><input type="color" value={bgColor2} onChange={e => setBgColor2(e.target.value)} className={b.colorSwatch} /><input value={bgColor2} onChange={e => setBgColor2(e.target.value)} className={`${b.input} ${b.colorInput}`} /></div></div>
                </div>
                <div className={b.fieldRowS}><label className={b.label}>Background fill</label>
                  <div className={b.segmented}>
                    <button type="button" className={`${b.seg} ${!gradientSolid ? b.segActive : ''}`} onClick={() => setGradientSolid(false)}>Gradient</button>
                    <button type="button" className={`${b.seg} ${gradientSolid ? b.segActive : ''}`} onClick={() => setGradientSolid(true)}>Solid</button>
                  </div></div>
                {!gradientSolid && <div className={b.fieldRowS}><label className={b.label}>Gradient angle — {gradientAngle}°</label>
                  <input type="range" min={0} max={360} value={gradientAngle} onChange={e => setGradientAngle(Number(e.target.value))} className={b.slider} /></div>}
                {!cs.free && (<>
                  <div className={b.fieldRowS}><label className={b.label}>Text position</label>
                    <div className={b.segmented}>{(['left', 'center', 'bottom'] as BannerTextPosition[]).map(p => <button type="button" key={p} onClick={() => setTextPosition(p)} className={`${b.seg} ${textPosition === p ? b.segActive : ''}`}>{p}</button>)}</div></div>
                  <div className={b.fieldRowS}><label className={b.label}>Text colour</label>
                    <div className={b.segmented}>{(['light', 'dark'] as BannerTextColor[]).map(c => <button type="button" key={c} onClick={() => setTextColor(c)} className={`${b.seg} ${textColor === c ? b.segActive : ''}`}>{c}</button>)}</div></div>
                </>)}
                {previewUrl && <div className={b.fieldRowS}><label className={b.label}>Image overlay — {overlay}%</label>
                  <input type="range" min={0} max={80} value={overlay} onChange={e => setOverlay(Number(e.target.value))} className={b.slider} /></div>}
                <div className={b.fieldRowS}><label className={b.label}>CTA style</label>
                  <div className={b.segmented}>{(['auto', 'arrow', 'pill', 'none'] as BannerCtaStyle[]).map(c => <button type="button" key={c} className={`${b.seg} ${ctaStyle === c ? b.segActive : ''}`} onClick={() => setCtaStyle(c)}>{c}</button>)}</div></div>
                <label className={`${b.checkRow} ${b.checkRowSpaced}`}><input type="checkbox" checked={showAd} onChange={e => setShowAd(e.target.checked)} /> Show “AD / Sponsored” label</label>
              </div>
            </>)}

            {/* Shared: link + schedule */}
            <div className={b.section}>
              <p className={b.sectionHead}>Link &amp; details</p>
              <div className={b.fieldRowS}><label className={b.label}>Internal name *</label>
                <input value={title} onChange={e => updateTitle(e.target.value)} className={b.input} placeholder="e.g. Wedding Season Hero" />
                <span className={b.hint}>Shown in the banner list; also the headline when composing.</span></div>
              <div className={b.grid2}>
                <div className={b.fieldRowS}><label className={b.label}>CTA text</label><input value={ctaText} onChange={e => setCtaText(e.target.value)} className={b.input} /></div>
                <div className={b.fieldRowS}><label className={b.label}>Links to</label>
                  <select className={b.input} value={linkType} onChange={e => setLinkType(e.target.value as typeof linkType)}>
                    <option value="category">Category</option><option value="collection">Collection</option><option value="url">Custom path</option></select></div>
              </div>
              <div className={b.fieldRowS}><label className={b.label}>{linkType === 'collection' ? 'Collection' : linkType === 'category' ? 'Category (blank = all)' : 'Path'}</label>
                {linkValueControl}
                <span className={b.hint}>Resolves to <code>{ctaLink || '/categories'}</code></span></div>
              <div className={b.grid3}>
                <div className={b.fieldRowS}><label className={b.label}>Start date</label><input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} className={b.input} /></div>
                <div className={b.fieldRowS}><label className={b.label}>End date</label><input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} className={b.input} /></div>
                <div className={b.fieldRowS}><label className={b.label}>Order</label><input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={b.input} min={0} /></div>
              </div>
              <div className={b.fieldRowS}><label className={b.label}>Carousel transition</label>
                <div className={b.segmented}>{(['fade', 'slide', 'zoom'] as const).map(t => <button type="button" key={t} className={`${b.seg} ${(cs.transition ?? 'fade') === t ? b.segActive : ''}`} onClick={() => patchCs({ transition: t })}>{t}</button>)}</div>
                <span className={b.hint}>How this banner enters when it rotates into view in the home carousel.</span></div>
              <label className={`${b.checkRow} ${b.checkRowLg}`}><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active (visible in app)</label>
            </div>
          </div>

          {/* Live preview rail — shown in every mode (incl. canvas). */}
          <div className={b.previewPane}>
            <div className={b.previewLabelRow}>
              <span className={`${b.statusChip} ${status.cls}`}>{status.label}</span>
              <span className={b.previewDevLabel}>{dev === 'mobile' ? 'Mobile preview' : 'Web preview'}</span>
            </div>
            <DeviceShell frame={dev} hero={deviceHero(dev)} />
            <button type="button" className={b.devicePreviewBtn} onClick={() => { setReplayKey(k => k + 1); setShowDevicePreview(true); }}>
              ◱ Preview on device
            </button>
            <span className={b.hint}>
              {dev === 'web' && !imageWeb ? 'No web image yet — it falls back to the mobile image.' : 'Opens both devices full-size; plays entrance & ambient motion.'}
            </span>
          </div>
        </div>

        {/* Full-size device preview — both phones + browser, with replay */}
        {showDevicePreview && (
          <div className={b.devModal} onMouseDown={() => setShowDevicePreview(false)}>
            <div className={b.devModalCard} onMouseDown={e => e.stopPropagation()}>
              <div className={b.devModalHead}>
                <strong>Device preview</strong>
                <div className={b.devModalActions}>
                  <button type="button" className={b.devicePreviewBtn} onClick={() => setReplayKey(k => k + 1)}>▶ Replay motion</button>
                  <button type="button" className={b.devModalClose} onClick={() => setShowDevicePreview(false)} aria-label="Close preview">×</button>
                </div>
              </div>
              <div className={b.devFrames} key={replayKey}>
                <div className={b.devFrameCol}><DeviceShell frame="mobile" hero={deviceHero('mobile', true)} /><span className={b.devFrameLabel}>Mobile app</span></div>
                <div className={b.devFrameCol}><DeviceShell frame="web" hero={deviceHero('web', true)} /><span className={b.devFrameLabel}>Web</span></div>
              </div>
            </div>
          </div>
        )}

        <div className={b.studioActions}>
          <button type="button" onClick={onCancel} className={styles.cancelModalBtn}>Cancel</button>
          <button type="submit" disabled={saving || !canSave} className={styles.saveModalBtn}>{saving ? 'Saving…' : (initial.id ? 'Save Changes' : 'Create Banner')}</button>
        </div>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const BannersPage: React.FC = () => {
  const [banners, setBanners]     = React.useState<Banner[]>([]);
  const [loading, setLoading]     = React.useState(true);
  const [modal, setModal]         = React.useState<Banner | 'new' | null>(null);
  const [saving, setSaving]       = React.useState(false);
  const [deleting, setDeleting]   = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Banner | null>(null);
  const [toasts, setToasts]       = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const load = () => {
    setLoading(true);
    bannersApi.list()
      .then(data => setBanners(Array.isArray(data) ? data : []))
      .catch(() => showToast('error', 'Failed to load banners'))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const handleSave = async (data: BannerPayload) => {
    setSaving(true);
    try {
      if (modal === 'new') {
        await bannersApi.create(data);
        showToast('success', 'Banner created');
      } else if (modal) {
        await bannersApi.update(modal.id, data);
        showToast('success', 'Banner updated');
      }
      setModal(null);
      load();
    } catch (e) {
      // T3-9 (§5.4): surface the server's actual reason (e.g. which field failed validation)
      // instead of a generic message the CM can't act on.
      showToast('error', 'Failed to save banner', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    try {
      await bannersApi.delete(deleteTarget.id);
      showToast('success', 'Banner deleted');
      setDeleteTarget(null);
      load();
    } catch (e) {
      showToast('error', 'Failed to delete banner', e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (bn: Banner) => {
    try {
      await bannersApi.update(bn.id, { is_active: !bn.is_active });
      setBanners(prev => prev.map(x => x.id === bn.id ? { ...x, is_active: !x.is_active } : x));
    } catch {
      showToast('error', 'Failed to update banner');
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Hero Banners</h1>
        <button className={styles.addBtn} onClick={() => setModal('new')}>
          <UilPlus size={16} /> Add Banner
        </button>
      </div>

      <p className={b.intro}>
        Banners appear as the auto-scrolling hero carousel on the app home screen. Ordered by sort order (lowest first).
      </p>

      <div className={styles.card}>
        {loading ? (
          <p className={b.placeholder}>Loading…</p>
        ) : banners.length === 0 ? (
          <p className={b.placeholder}>No banners yet. Add one to get started.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Preview</th>
                <th>Headline</th>
                <th>CTA</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((bn) => (
                <tr key={bn.id}>
                  <td className={b.orderCell}>
                    <span className={b.orderNum}>{bn.sort_order}</span>
                  </td>
                  <td>
                    <div className={b.thumb}>
                      {(() => {
                        const k = bn.image_mobile || bn.image_web || bn.image_key;
                        const u = k && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${k}` : '';
                        return u
                          ? <img src={u} alt="" className={b.heroImg} style={{ objectPosition: `${bn.focal_x_mobile ?? 50}% ${bn.focal_y_mobile ?? 50}%` }} />
                          : <div className={b.miniHero}><BannerHero frame="fill" data={{ layout: bn.layout_mobile ?? bn.layout ?? 'full_image', title: bn.title, ctaText: bn.cta_text, imageUrl: '', bgColor1: bn.bg_color_1 || '#1F6B4F', bgColor2: bn.bg_color_2 || '#0D3D2C', textPosition: 'left', textColor: 'light', overlay: 40 }} /></div>;
                      })()}
                    </div>
                  </td>
                  <td>
                    <div className={b.hlTitle}>{bn.title}</div>
                    {bn.subtitle && <div className={b.hlSub}>{bn.subtitle}</div>}
                    {bn.tag && <span className={b.hlTag}>{bn.tag}</span>}
                    <div className={b.layoutName}>{(bn.layout_mobile ?? bn.layout ?? 'full_image').replace(/_/g, ' ')} · {(bn.layout_web ?? bn.layout ?? 'full_image').replace(/_/g, ' ')}</div>
                  </td>
                  <td className={b.ctaCell}>
                    <div>{bn.cta_text}</div>
                    <div className={b.ctaLink}>{bn.cta_link}</div>
                  </td>
                  <td className={b.schedCell}>
                    {bn.starts_at ? new Date(bn.starts_at).toLocaleDateString('en-IN') : '—'} →{' '}
                    {bn.ends_at   ? new Date(bn.ends_at).toLocaleDateString('en-IN')   : 'always'}
                  </td>
                  <td>
                    <button onClick={() => handleToggle(bn)} aria-label={bn.is_active ? 'Hide banner' : 'Show banner'} className={`${b.statusBtn} ${bn.is_active ? b.statusActive : b.statusHidden}`}>
                      {bn.is_active ? <UilEye size={16} /> : <UilEyeSlash size={16} />}
                      <span className={b.statusLabel}>{bn.is_active ? 'Active' : 'Hidden'}</span>
                    </button>
                  </td>
                  <td>
                    <div className={b.actions}>
                      <button onClick={() => setModal(bn)} className={b.iconBtn} title="Edit" aria-label="Edit banner">
                        <UilPen size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(bn)} disabled={deleting === bn.id} className={`${b.iconBtn} ${b.iconBtnDanger}`} title="Delete" aria-label="Delete banner">
                        <UilTrashAlt size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'new' ? 'Add Banner' : 'Edit Banner'}
        size="lg"
        className={b.studioModal}
      >
        {modal !== null && (
          <BannerForm
            initial={modal === 'new' ? {} : modal}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            saving={saving}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this banner?"
        message={deleteTarget ? `Delete the banner “${deleteTarget.title}”? This removes it from the home carousel and can't be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting === deleteTarget?.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
