/* eslint-disable react-refresh/only-export-components -- this module also exports the
   CollectionDesign type + DEFAULT_DESIGN constant used by the collection edit page. */
import React from 'react';
import { uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import type { BannerLayout, BannerTextPosition, BannerTextColor, BannerComposeStyle } from '../../api/adminApi';
import { BannerHero, DeviceShell, layoutsFor } from './BannersPage';
import { CanvasEditor } from './canvas/CanvasEditor';
import { emptyCanvas, newId, DEFAULT_ELEMENT, type CanvasDoc } from './canvas/canvasTypes';
import b from './BannersPage.module.css';
import csm from './CollectionStudio.module.css';

/** All collection design fields the studio owns (mirrors the banner studio). */
export interface CollectionDesign {
  card_layout: BannerLayout;
  hero_layout: BannerLayout;
  card_aspect: number;
  hero_aspect: number;
  card_focal_x: number; card_focal_y: number;
  hero_focal_x: number; hero_focal_y: number;
  image_fit: 'cover' | 'contain';
  image_zoom: number;
  text_position: BannerTextPosition;
  text_color: BannerTextColor;
  overlay: number;
  gradient_angle: number;
  gradient_solid: boolean;
  logo_key: string;
  cta_text: string;
  compose_style: BannerComposeStyle;
}

/** Layouts that need fields collections don't have (product thumbnails, pills, badge). */
const COLLECTION_EXCLUDED = new Set<BannerLayout>(['curated', 'triptych', 'offer_badge']);

export const DEFAULT_DESIGN: CollectionDesign = {
  card_layout: 'full_image', hero_layout: 'showcase',
  card_aspect: 0.8, hero_aspect: 2.4,
  card_focal_x: 50, card_focal_y: 50, hero_focal_x: 50, hero_focal_y: 50,
  image_fit: 'cover', image_zoom: 100,
  text_position: 'bottom', text_color: 'light', overlay: 40,
  gradient_angle: 135, gradient_solid: false,
  logo_key: '', cta_text: 'Explore', compose_style: {},
};

export function CollectionStudio({
  design, onChange, name, subtitle, season, coverUrl, bgColor1, bgColor2, onContent,
}: {
  design: CollectionDesign;
  onChange: (d: CollectionDesign) => void;
  name: string;
  subtitle: string;
  season: string;
  coverUrl: string;
  bgColor1: string;
  bgColor2: string;
  /** Write bound canvas text back to the collection Name/Subtitle (two-way sync). */
  onContent?: (p: { title?: string; subtitle?: string }) => void;
}) {
  const [surface, setSurface] = React.useState<'card' | 'hero'>('card');
  const [showDevicePreview, setShowDevicePreview] = React.useState(false);
  const [replayKey, setReplayKey] = React.useState(0); // bump to replay entrance motion
  const set = (p: Partial<CollectionDesign>) => onChange({ ...design, ...p });
  const patchCs = (p: Partial<BannerComposeStyle>) => set({ compose_style: { ...design.compose_style, ...p } });

  const isCard = surface === 'card';
  const dev = isCard ? 'mobile' : 'web';
  const layout = isCard ? design.card_layout : design.hero_layout;
  const setLayout = (l: BannerLayout) => set(isCard ? { card_layout: l } : { hero_layout: l });
  const aspect = isCard ? design.card_aspect : design.hero_aspect;
  const setAspect = (v: number) => set(isCard ? { card_aspect: v } : { hero_aspect: v });
  const fx = isCard ? design.card_focal_x : design.hero_focal_x;
  const fy = isCard ? design.card_focal_y : design.hero_focal_y;
  const setFocal = (x: number, y: number) => set(isCard ? { card_focal_x: x, card_focal_y: y } : { hero_focal_x: x, hero_focal_y: y });

  const logoUrl = design.logo_key ? (design.logo_key.startsWith('http') ? design.logo_key : `${R2_PUBLIC_URL}/${design.logo_key}`) : '';
  const cs = design.compose_style;
  // Per-surface canvas — Card and Hero are independent. Only the Card (primary surface)
  // inherits an old shared `canvas`; the Hero never borrows it, so designing the Card
  // never bleeds into the Hero.
  const canvasKey: 'canvas_card' | 'canvas_hero' = isCard ? 'canvas_card' : 'canvas_hero';
  const otherCanvasKey: 'canvas_card' | 'canvas_hero' = isCard ? 'canvas_hero' : 'canvas_card';
  const canvasFor = (k: 'canvas_card' | 'canvas_hero') => (k === 'canvas_card' ? (cs.canvas_card ?? cs.canvas) : cs.canvas_hero) as CanvasDoc | undefined;
  const activeCanvas = canvasFor(canvasKey);

  // [DSG-12-12 class] A cover key can outlive the object in R2. The focal picker is a
  // control for aiming a crop, so over a missing image it is not just ugly — it is a
  // widget that cannot do anything, and the broken glyph reads as a broken tool.
  const [coverBroken, setCoverBroken] = React.useState(false);
  React.useEffect(() => { setCoverBroken(false); }, [coverUrl]);

  // Collections own name/subtitle outside the studio. Field→canvas: editing the
  // name/subtitle updates bound text in BOTH surface canvases.
  React.useEffect(() => {
    const patch: Partial<BannerComposeStyle> = {};
    for (const k of ['canvas_card', 'canvas_hero'] as const) {
      const doc = cs[k] as CanvasDoc | undefined;
      if (!doc?.elements?.length) continue;
      let changed = false;
      const els = doc.elements.map(el => {
        if (el.type === 'text' && el.bind === 'title' && el.text !== (name || '')) { changed = true; return { ...el, text: name || '' }; }
        if (el.type === 'text' && el.bind === 'subtitle' && el.text !== (subtitle || '')) { changed = true; return { ...el, text: subtitle || '' }; }
        return el;
      });
      if (changed) patch[k] = { ...doc, elements: els };
    }
    if (Object.keys(patch).length) patchCs(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, subtitle]);

  // Reverse direction (canvas → fields): editing bound text writes back to the
  // collection Name/Subtitle, completing the two-way binding.
  const syncFieldsFromCanvas = (doc: CanvasDoc) => {
    if (!onContent) return;
    const out: { title?: string; subtitle?: string } = {};
    for (const el of doc.elements) {
      if (el.type !== 'text' || typeof el.text !== 'string') continue;
      if (el.bind === 'title' && el.text !== name) out.title = el.text;
      else if (el.bind === 'subtitle' && el.text !== (subtitle || '')) out.subtitle = el.text;
    }
    if (out.title !== undefined || out.subtitle !== undefined) onContent(out);
  };

  const focalRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const logoRef = React.useRef<HTMLInputElement>(null);
  const setFocalFromPoint = (clientX: number, clientY: number) => {
    const r = focalRef.current?.getBoundingClientRect(); if (!r) return;
    setFocal(
      Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))),
      Math.round(Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100))),
    );
  };
  const onLogoFile = async (file: File) => { try { set({ logo_key: await uploadToR2(file, 'collections') }); } catch { /* ignore */ } };

  // BannerHero data for a given surface (card / hero) — used by the live preview,
  // the layout gallery, and the full-size device preview modal.
  const dataFor = (s: 'card' | 'hero') => {
    const cardS = s === 'card';
    return {
      layout: cardS ? design.card_layout : design.hero_layout,
      aspectRatio: cardS ? design.card_aspect : design.hero_aspect,
      title: name || 'Collection name', subtitle: subtitle || undefined,
      tag: season || undefined, ctaText: design.cta_text, imageUrl: coverUrl,
      focalX: cardS ? design.card_focal_x : design.hero_focal_x,
      focalY: cardS ? design.card_focal_y : design.hero_focal_y,
      imageFit: design.image_fit, imageZoom: design.image_zoom,
      bgColor1, bgColor2, textPosition: design.text_position, textColor: design.text_color, overlay: design.overlay,
      logoUrl, gradientAngle: design.gradient_angle, gradientSolid: design.gradient_solid,
      compose: cs, canvasDoc: cs.free ? canvasFor(cardS ? 'canvas_card' : 'canvas_hero') : undefined,
    };
  };
  const addr = `zavestro.com/occasions/${name ? name.toLowerCase().replace(/\s+/g, '-') : 'collection'}`;
  // Enter canvas (free-design) mode, seeding bound headline/subtitle on first use.
  const enterCanvas = () => {
    if (!activeCanvas || !activeCanvas.elements?.length) {
      const seed = emptyCanvas({ color1: bgColor1, color2: bgColor2 });
      seed.elements.push(
        { id: newId(), ...DEFAULT_ELEMENT.text(), text: name || 'Collection name', y: 38, bind: 'title' },
        { id: newId(), ...DEFAULT_ELEMENT.text(), text: subtitle || 'Add a supporting line', y: 60, size: 3.4, weight: 500, bind: 'subtitle' },
      );
      patchCs({ free: true, [canvasKey]: seed });
    } else patchCs({ free: true });
  };

  return (
    <div className={csm.root}>
      <div className={`${csm.panes} ${cs.free ? csm.panesCanvas : ''}`}>
        <div className={csm.formPane}>
          {/* Surface tabs — same pattern as the banner studio's device tabs */}
          <div className={b.deviceTabs}>
            <button type="button" className={`${b.deviceTab} ${isCard ? b.deviceTabOn : ''}`} onClick={() => setSurface('card')}>🃏 Card</button>
            <button type="button" className={`${b.deviceTab} ${!isCard ? b.deviceTabOn : ''}`} onClick={() => setSurface('hero')}>🖥 Landing hero</button>
          </div>

          {/* Mode for the active surface — mirrors the banner studio's mode segmented */}
          <div className={b.section}>
            <p className={b.sectionHead}>{isCard ? 'Card' : 'Landing hero'} design</p>
            <div className={b.segmented}>
              <button type="button" className={`${b.seg} ${!cs.free ? b.segActive : ''}`} onClick={() => patchCs({ free: false })}>Compose</button>
              <button type="button" className={`${b.seg} ${cs.free ? b.segActive : ''}`} onClick={enterCanvas}>✎ Design canvas</button>
            </div>
            <span className={b.hint}>{cs.free ? 'Design freely on a canvas — add text, images, shapes &amp; buttons (Canva-style).' : 'Build it from a layout + your cover image & text.'}</span>
          </div>

          {/* Compose — layout gallery (canvas mode replaces this) */}
          {!cs.free && (
            <div className={b.section}>
              <p className={b.sectionHead}>{isCard ? 'Card layout' : 'Hero layout'}</p>
              <div className={b.layoutGallery}>
                {/* Collections have name + subtitle + cover only — exclude layouts that
                    need per-product thumbnails / pills / offer badges. */}
                {layoutsFor(dev).filter(l => !COLLECTION_EXCLUDED.has(l.id)).map(l => (
                  <button type="button" key={l.id} className={`${b.layoutCard} ${layout === l.id ? b.layoutCardActive : ''}`} onClick={() => setLayout(l.id)}>
                    <BannerHero frame={dev} data={{ ...dataFor(surface), layout: l.id }} />
                    <span className={b.layoutCardLabel}>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size / ratio — always available */}
          <div className={b.section}>
            <p className={b.sectionHead}>{isCard ? 'Card' : 'Hero'} size &amp; ratio</p>
            <div className={b.fieldRowS}>
              <label className={b.label}>Ratio — {aspect < 1 ? `tall ${aspect.toFixed(2)} : 1` : `${aspect.toFixed(2)} : 1`}</label>
              <input type="range" min={isCard ? 0.5 : 1.6} max={isCard ? 1.5 : 4} step={0.01} value={aspect} onChange={e => setAspect(Number(e.target.value))} className={b.slider} />
              <div className={b.sizePresets}>
                {(isCard
                  ? [['Tall', 0.66], ['Portrait', 0.8], ['Square', 1], ['Wide', 1.4]]
                  : [['Banner', 4], ['Wide', 2.4], ['Short', 2], ['Tall', 1.7]]).map(([lbl, v]) => (
                  <button type="button" key={lbl as string} className={`${b.sizePreset} ${Math.abs(aspect - (v as number)) < 0.02 ? b.sizePresetOn : ''}`} onClick={() => setAspect(v as number)}>{lbl}</button>
                ))}
              </div>
              <span className={b.hint}>How tall/short this surface is. Applies even without a cover image.</span>
            </div>
          </div>

          {/* Cover image focal — compose only (canvas manages its own background) */}
          {!cs.free && coverUrl && (
            <div className={b.section}>
              <p className={b.sectionHead}>Cover image — {isCard ? 'card' : 'hero'} crop</p>
              <div className={b.imgControls}>
                <div className={b.focalBox} ref={focalRef}
                  onMouseDown={e => { dragging.current = true; setFocalFromPoint(e.clientX, e.clientY); }}
                  onMouseMove={e => { if (dragging.current) setFocalFromPoint(e.clientX, e.clientY); }}
                  onMouseUp={() => { dragging.current = false; }} onMouseLeave={() => { dragging.current = false; }}>
                  {!coverBroken && (
                    <img
                      src={coverUrl}
                      alt=""
                      className={b.focalImg}
                      style={{ objectPosition: `${fx}% ${fy}%` }}
                      onError={() => setCoverBroken(true)}
                    />
                  )}
                  {!coverBroken && <span className={b.focalDot} style={{ left: `${fx}%`, top: `${fy}%` }} />}
                </div>
                <span className={b.focalHint}>
                  {coverBroken
                    ? 'The cover image is recorded but could not be loaded, so there is nothing to aim a crop at. Re-upload it above.'
                    : 'Drag the focus — kept in frame for this surface’s crop.'}
                </span>
              </div>
            </div>
          )}

          {/* Canvas mode — full-width editor (this surface's own canvas) */}
          {cs.free && (<>
            <CanvasEditor
              key={canvasKey}
              doc={activeCanvas ?? emptyCanvas({ color1: bgColor1, color2: bgColor2 })}
              onChange={d => { patchCs({ [canvasKey]: d }); syncFieldsFromCanvas(d); }}
              aspect={aspect}
              content={{ title: name, subtitle }}
            />
            <div className={b.section}>
              <button type="button" className={b.devicePreviewBtn} disabled={!canvasFor(otherCanvasKey)?.elements?.length}
                onClick={() => { const o = canvasFor(otherCanvasKey); if (o) patchCs({ [canvasKey]: JSON.parse(JSON.stringify(o)) }); }}>
                ⧉ Copy from {isCard ? 'Landing hero' : 'Card'}
              </button>
              <span className={b.hint}>Card &amp; Landing hero have separate designs. “Copy from” duplicates the other surface here.</span>
            </div>
          </>)}

          {/* Style */}
          <div className={b.section}>
            <p className={b.sectionHead}>Style</p>
            <div className={b.fieldRowS}><label className={b.label}>Background fill</label>
              <div className={b.segmented}>
                <button type="button" className={`${b.seg} ${!design.gradient_solid ? b.segActive : ''}`} onClick={() => set({ gradient_solid: false })}>Gradient</button>
                <button type="button" className={`${b.seg} ${design.gradient_solid ? b.segActive : ''}`} onClick={() => set({ gradient_solid: true })}>Solid</button>
              </div></div>
            {!design.gradient_solid && <div className={b.fieldRowS}><label className={b.label}>Gradient angle — {design.gradient_angle}°</label>
              <input type="range" min={0} max={360} value={design.gradient_angle} onChange={e => set({ gradient_angle: Number(e.target.value) })} className={b.slider} /></div>}
            {!cs.free && (<>
              <div className={b.fieldRowS}><label className={b.label}>Text position</label>
                <div className={b.segmented}>{(['left', 'center', 'bottom'] as BannerTextPosition[]).map(p => <button type="button" key={p} onClick={() => set({ text_position: p })} className={`${b.seg} ${design.text_position === p ? b.segActive : ''}`}>{p}</button>)}</div></div>
              <div className={b.fieldRowS}><label className={b.label}>Text colour</label>
                <div className={b.segmented}>{(['light', 'dark'] as BannerTextColor[]).map(c => <button type="button" key={c} onClick={() => set({ text_color: c })} className={`${b.seg} ${design.text_color === c ? b.segActive : ''}`}>{c}</button>)}</div></div>
              {coverUrl && <div className={b.fieldRowS}><label className={b.label}>Image overlay — {design.overlay}%</label>
                <input type="range" min={0} max={80} value={design.overlay} onChange={e => set({ overlay: Number(e.target.value) })} className={b.slider} /></div>}
            </>)}
            <div className={b.fieldRowS}><label className={b.label}>CTA text</label>
              <input value={design.cta_text} onChange={e => set({ cta_text: e.target.value })} className={b.input} placeholder="Explore" /></div>
            <div className={b.fieldRowS}><label className={b.label}>Brand logo (optional)</label>
              <input ref={logoRef} type="file" accept="image/png,image/webp,image/svg+xml" className={b.hidden} onChange={e => { const f = e.target.files?.[0]; if (f) onLogoFile(f); e.target.value = ''; }} />
              {design.logo_key ? <div className={b.imgRow}>{logoUrl && <img src={logoUrl} alt="logo" className={b.logoThumb} />}<button type="button" onClick={() => set({ logo_key: '' })} className={b.imgRemove}>Remove</button></div>
                : <button type="button" onClick={() => logoRef.current?.click()} className={`${b.input} ${b.chooseBtn}`}>＋ Upload logo</button>}</div>
          </div>
        </div>

        {/* Live preview rail — shown in every mode (incl. canvas). */}
        <div className={csm.previewPane}>
          <div className={b.previewLabelRow}><span className={b.previewDevLabel}>{isCard ? 'Card preview' : 'Landing hero preview'}</span></div>
          <DeviceShell frame={dev} hero={<BannerHero frame={dev} data={dataFor(surface)} />} addr={addr} />
          <button type="button" className={b.devicePreviewBtn} onClick={() => { setReplayKey(k => k + 1); setShowDevicePreview(true); }}>
            ◱ Preview on device
          </button>
          <span className={b.hint}>Opens the Card and Landing hero together, full-size — plays entrance &amp; ambient motion.</span>
        </div>
      </div>

      {/* Full-size device preview — Card (app) + Landing hero (web), with replay */}
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
              <div className={b.devFrameCol}><DeviceShell frame="mobile" hero={<BannerHero frame="mobile" data={dataFor('card')} animate />} /><span className={b.devFrameLabel}>Card · in app rails</span></div>
              <div className={b.devFrameCol}><DeviceShell frame="web" hero={<BannerHero frame="web" data={dataFor('hero')} animate />} addr={addr} /><span className={b.devFrameLabel}>Landing hero · web</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
