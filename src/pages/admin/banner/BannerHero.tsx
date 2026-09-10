/**
 * [CM-22-8] The shared banner renderer, in its own module.
 *
 * `BannerHero`, `DeviceShell` and the layout catalogue lived inside BannersPage.tsx — a
 * 1,400-line page component that also held the editor modal, the list and the canvas
 * integration. The Collection Studio imported the renderer FROM THE PAGE, so a merchandising
 * surface depended on a page file, and the mixing needed an
 * `eslint-disable react-refresh/only-export-components` at the top to stay quiet.
 *
 * Nothing here touches page state: it is a pure renderer over `HeroData` plus the layout
 * metadata that describes which layouts each device offers. Both consumers now import the
 * module rather than one importing the other's page.
 */
import React from 'react';
import { SafeImg } from '../../../components/Image/SafeImg';
import { CanvasRender } from '../canvas/CanvasRender';
import type { HeroData } from './layouts';
import type { CanvasDoc } from '../canvas/canvasTypes';
import b from '../BannersPage.module.css';

// ─── Layout metadata + reusable hero renderer ───────────────────────────────────


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
  // A cover key can outlive the object in R2. Without onError the browser paints its own
  // broken-image glyph INSIDE the card the merchandiser is judging — and this renderer
  // feeds the layout gallery, the live card/hero preview and the full-size device preview,
  // so one dead key breaks the whole studio at once and reads as "the tool is broken"
  // rather than "this image is missing". Falling back to null lets the gradient show, which
  // is already the design's background and is what the card looks like with no image.
  // Same defect class as [DSG-12-12] on the sample review surfaces.
  const [imgBroken, setImgBroken] = React.useState(false);
  React.useEffect(() => { setImgBroken(false); }, [imageUrl]);
  const usableImage = imageUrl && !imgBroken ? imageUrl : '';
  const onImgError = () => setImgBroken(true);
  const Img = usableImage ? (
    <img src={usableImage} alt="" className={b.heroImg} style={coverStyle} onError={onImgError} />
  ) : null;
  const FitImg = usableImage ? (
    <img src={usableImage} alt="" className={b.heroImg} style={fitStyle} onError={onImgError} />
  ) : null;

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
          {logoUrl ? <span className={b.brandChip}><SafeImg src={logoUrl} alt="" className={b.brandLogo} /></span>
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
            {logoUrl ? <span className={b.brandChip}><SafeImg src={logoUrl} alt="" className={b.brandLogo} /></span>
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
                  {thumbUrls.slice(0, 3).map((u, i) => <div key={i} className={b.curThumb}><SafeImg src={u} alt="" /></div>)}
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
