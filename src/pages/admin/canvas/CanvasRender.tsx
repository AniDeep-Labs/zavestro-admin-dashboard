import React from 'react';
import { R2_PUBLIC_URL } from '../../../api/adminApi';
import type { CanvasDoc, CanvasElement } from './canvasTypes';
import { ANIM_KEYFRAME, KENBURNS_KEYFRAME } from './canvasTypes';
import c from './Canvas.module.css';

const url = (k?: string) => (k && R2_PUBLIC_URL ? (k.startsWith('http') ? k : `${R2_PUBLIC_URL}/${k}`) : '');
const fontFam = (f?: string) => f === 'serif' ? 'Georgia, "Times New Roman", serif'
  : f === 'display' ? '"Cormorant Garamond", Georgia, serif'
    : f === 'mono' ? '"SF Mono", ui-monospace, "Cascadia Code", monospace'
      : 'inherit';
// Shape/button fill — solid or gradient.
const fillOf = (el: CanvasElement) => el.fillType === 'gradient'
  ? `linear-gradient(${el.fillAngle ?? 135}deg, ${el.fill || '#ffffff'}, ${el.fill2 || '#000000'})`
  : (el.fill || '#ffffff');
// Drop-shadow from a 0–100 intensity → box-shadow string.
const boxShadow = (s?: number) => s ? `0 ${(s / 100 * 0.8).toFixed(2)}cqw ${(s / 100 * 3.2).toFixed(2)}cqw rgba(0,0,0,${(s / 100 * 0.45).toFixed(2)})` : undefined;
// Text drop-shadow (defaults to a soft shadow for legacy docs without the field).
const textShadow = (s?: number) => { const v = s ?? 28; return v ? `0 ${(v / 100 * 0.7).toFixed(2)}cqw ${(v / 100 * 5).toFixed(2)}cqw rgba(0,0,0,${(v / 100 * 1).toFixed(2)})` : 'none'; };

/** The type-specific visual (fills the rotation wrapper). */
function elementInner(el: CanvasElement): React.ReactNode {
  const fill: React.CSSProperties = { position: 'absolute', inset: 0 };
  if (el.type === 'text') {
    return (
      <div style={{ ...fill, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        fontFamily: fontFam(el.font), fontSize: `${el.size}cqw`, fontWeight: el.weight, color: el.color,
        textAlign: el.align, letterSpacing: `${(el.letterSpacing ?? 0) / 100}em`, lineHeight: (el.lineHeight ?? 110) / 100,
        whiteSpace: 'pre-line', textShadow: textShadow(el.shadow),
        WebkitTextStroke: el.strokeW ? `${el.strokeW}cqw ${el.stroke || '#000'}` : undefined }}>
        {el.text}
      </div>
    );
  }
  if (el.type === 'button') {
    return (
      <div style={{ ...fill, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: fillOf(el), color: el.color, borderRadius: `${el.radius}cqw`, fontFamily: fontFam(el.font),
        fontSize: `${el.size}cqw`, fontWeight: el.weight,
        letterSpacing: `${(el.letterSpacing ?? 0) / 100}em`,
        border: el.strokeW ? `${el.strokeW}cqw solid ${el.stroke || '#000'}` : undefined,
        boxShadow: boxShadow(el.shadow ?? 24) }}>
        {el.text}
      </div>
    );
  }
  if (el.type === 'rect' || el.type === 'ellipse') {
    return <div style={{ ...fill, background: fillOf(el), borderRadius: el.type === 'ellipse' ? '50%' : `${el.radius ?? 0}cqw`,
      border: el.strokeW ? `${el.strokeW}cqw solid ${el.stroke || '#000'}` : undefined, boxShadow: boxShadow(el.shadow) }} />;
  }
  if (el.type === 'image') {
    const u = url(el.imageKey);
    return (
      <div style={{ ...fill, borderRadius: `${el.radius ?? 0}cqw`, overflow: 'hidden', background: u ? undefined : 'rgba(255,255,255,0.15)', boxShadow: boxShadow(el.shadow) }}>
        {u && <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: el.fit, objectPosition: `${el.focalX}% ${el.focalY}%`, display: 'block' }} />}
      </div>
    );
  }
  return null;
}

/**
 * Pure presentation of a canvas element. When `animate` is on, an entrance
 * animation plays — the animation rides the OUTER box (translate/scale/opacity)
 * while rotation lives on an inner wrapper, so the two never clobber each other.
 */
export function ElementView({ el, animate }: { el: CanvasElement; animate?: boolean }) {
  const kf = animate ? ANIM_KEYFRAME[el.anim ?? 'none'] : null;
  const outer: React.CSSProperties = {
    position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, opacity: el.opacity,
    animation: kf ? `${kf} ${el.animDuration ?? 600}ms cubic-bezier(0.22,0.61,0.36,1) ${el.animDelay ?? 0}ms both` : undefined,
  };
  return (
    <div style={outer}>
      <div style={{ position: 'absolute', inset: 0, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined }}>
        {elementInner(el)}
      </div>
    </div>
  );
}

/**
 * Renders a whole canvas document (background + elements) at the given aspect.
 * `animate` plays entrance animations + ambient bg motion (preview / storefront).
 */
export function CanvasRender({ doc, aspect, animate }: { doc: CanvasDoc; aspect: number; animate?: boolean }) {
  const bg = doc.background;
  const bgImg = url(bg.imageKey);
  const background = bg.type === 'solid' ? bg.color1
    : bg.type === 'image' ? '#1a1714'
      : `linear-gradient(${bg.angle}deg, ${bg.color1}, ${bg.color2})`;
  const ken = bg.type === 'image' ? KENBURNS_KEYFRAME[bg.kenBurns ?? 'none'] : null;
  const sorted = doc.elements.filter(e => !e.hidden); // array order = back→front; skip hidden
  return (
    <div className={c.board} style={{ aspectRatio: String(aspect), background }}>
      {bg.type === 'image' && bgImg && (
        <img src={bgImg} alt="" className={c.bgImg} style={{ objectFit: bg.fit, objectPosition: `${bg.focalX}% ${bg.focalY}%`,
          animation: ken ? `${ken} 14s ease-in-out infinite alternate` : undefined }} />
      )}
      {bg.type === 'image' && bgImg && (bg.overlay ?? 0) > 0 && (
        <div className={c.bgScrim} style={{ background: `rgba(0,0,0,${(bg.overlay ?? 0) / 100})` }} />
      )}
      {sorted.map(el => <ElementView key={el.id} el={el} animate={animate} />)}
    </div>
  );
}
