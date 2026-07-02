import React from 'react';
import { uploadToR2, R2_PUBLIC_URL } from '../../../api/adminApi';
import type { CanvasDoc, CanvasElement, CanvasElementType, AnimType, KenBurns, LinkType } from './canvasTypes';
import { DEFAULT_ELEMENT, newId, resolveLink, linkTypeOf, linkValueOf } from './canvasTypes';
import { ElementView } from './CanvasRender';
import { CANVAS_TEMPLATES } from './canvasTemplates';
import c from './Canvas.module.css';

const TYPE_ICON: Record<CanvasElementType, string> = { text: 'T', button: '▭', rect: '◻', ellipse: '◯', image: '🖼' };
const url = (k?: string) => (k && R2_PUBLIC_URL ? (k.startsWith('http') ? k : `${R2_PUBLIC_URL}/${k}`) : '');
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

type DragOp =
  | { kind: 'move'; ids: string[]; primary: string; sx: number; sy: number; starts: Record<string, { x: number; y: number }> }
  | { kind: 'resize'; id: string; corner: 'nw' | 'ne' | 'sw' | 'se'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }
  | { kind: 'rotate'; id: string; cx: number; cy: number };

export function CanvasEditor({ doc, onChange, aspect, defaultLink, content }: { doc: CanvasDoc; onChange: (d: CanvasDoc) => void; aspect: number; defaultLink?: string; content?: { title?: string; subtitle?: string } }) {
  const [selIds, setSelIds] = React.useState<string[]>([]);
  const selId = selIds.length === 1 ? selIds[0] : null; // single-selection (props/handles)
  const setSelId = (id: string | null) => setSelIds(id ? [id] : []);
  const toggleSel = (id: string) => setSelIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const op = React.useRef<DragOp | null>(null);
  const imgRef = React.useRef<HTMLInputElement>(null);
  const bgImgRef = React.useRef<HTMLInputElement>(null);
  const [guides, setGuides] = React.useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [editId, setEditId] = React.useState<string | null>(null); // text element being edited inline
  const [zoom, setZoom] = React.useState(1); // art-board zoom; pan via the scrollable stage
  const clipboard = React.useRef<CanvasElement[]>([]); // copy/paste buffer (⌘C/⌘V)

  const sel = doc.elements.find(e => e.id === selId) ?? null;

  // ── Undo / redo (time-coalesced: rapid edits within 600ms = one history step) ──
  const undoRef = React.useRef<CanvasDoc[]>([]);
  const redoRef = React.useRef<CanvasDoc[]>([]);
  const lastT = React.useRef(0);
  const [, forceTick] = React.useReducer(x => x + 1, 0); // re-render so undo/redo buttons enable/disable
  const commit = (next: CanvasDoc) => {
    const now = Date.now();
    if (now - lastT.current > 600) { undoRef.current.push(doc); redoRef.current = []; if (undoRef.current.length > 80) undoRef.current.shift(); }
    lastT.current = now;
    onChange(next);
    forceTick();
  };
  const doUndo = () => { if (undoRef.current.length) { redoRef.current.push(doc); onChange(undoRef.current.pop()!); lastT.current = 0; forceTick(); } };
  const doRedo = () => { if (redoRef.current.length) { undoRef.current.push(doc); onChange(redoRef.current.pop()!); lastT.current = 0; forceTick(); } };

  const setEls = (els: CanvasElement[]) => commit({ ...doc, elements: els });
  const patch = (id: string, p: Partial<CanvasElement>) => setEls(doc.elements.map(e => e.id === id ? { ...e, ...p } : e));
  const patchSel = (p: Partial<CanvasElement>) => { if (sel) patch(sel.id, p); };
  const patchBg = (p: Partial<CanvasDoc['background']>) => commit({ ...doc, background: { ...doc.background, ...p } });
  // Replace the whole canvas with a starter template (keeps the current bg colours +
  // carries over the current Headline/Subtitle into the bound text; undoable).
  const applyTemplate = (tpl: typeof CANVAS_TEMPLATES[number]) => {
    const next = tpl.build({ color1: doc.background.color1, color2: doc.background.color2, angle: doc.background.angle });
    next.elements = next.elements.map(el => {
      if (el.type === 'text' && el.bind === 'title' && content?.title) return { ...el, text: content.title };
      if (el.type === 'text' && el.bind === 'subtitle' && content?.subtitle) return { ...el, text: content.subtitle };
      return el;
    });
    commit(next);
    setSelIds([]);
  };

  const add = (type: CanvasElementType) => {
    const el: CanvasElement = { id: newId(), ...DEFAULT_ELEMENT[type]() };
    if (type === 'button' && defaultLink) el.link = defaultLink; // inherit the banner's CTA link
    setEls([...doc.elements, el]);
    setSelId(el.id);
    if (type === 'image') setTimeout(() => imgRef.current?.click(), 0);
  };
  const remove = (id: string) => { setEls(doc.elements.filter(e => e.id !== id)); setSelId(null); };
  const duplicate = (id: string) => {
    const e = doc.elements.find(x => x.id === id); if (!e) return;
    const copy = { ...e, id: newId(), x: clamp(e.x + 4, 0, 90), y: clamp(e.y + 4, 0, 90) };
    setEls([...doc.elements, copy]); setSelId(copy.id);
  };
  const reorder = (id: string, dir: -1 | 1) => {
    const i = doc.elements.findIndex(e => e.id === id); if (i < 0) return;
    const j = i + dir; if (j < 0 || j >= doc.elements.length) return;
    const arr = [...doc.elements];[arr[i], arr[j]] = [arr[j], arr[i]];
    setEls(arr);
  };
  const toFront = (id: string) => { const e = doc.elements.find(x => x.id === id); if (!e) return; setEls([...doc.elements.filter(x => x.id !== id), e]); };
  const toBack = (id: string) => { const e = doc.elements.find(x => x.id === id); if (!e) return; setEls([e, ...doc.elements.filter(x => x.id !== id)]); };
  const toggleLock = (id: string) => patch(id, { locked: !doc.elements.find(e => e.id === id)?.locked });
  const toggleHide = (id: string) => patch(id, { hidden: !doc.elements.find(e => e.id === id)?.hidden });
  // Align every selected element to the board.
  const align = (a: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    if (!selIds.length) return;
    setEls(doc.elements.map(el => {
      if (!selIds.includes(el.id)) return el;
      const n = { ...el };
      if (a === 'left') n.x = 0; if (a === 'hcenter') n.x = 50 - el.w / 2; if (a === 'right') n.x = 100 - el.w;
      if (a === 'top') n.y = 0; if (a === 'vcenter') n.y = 50 - el.h / 2; if (a === 'bottom') n.y = 100 - el.h;
      return n;
    }));
  };

  // ── Interaction ──
  const boardRect = () => boardRef.current!.getBoundingClientRect();
  const startMove = (e: React.MouseEvent, el: CanvasElement) => {
    e.stopPropagation();
    if (el.locked) { setSelId(el.id); return; }
    if (e.shiftKey) { toggleSel(el.id); return; } // shift = add/remove from selection, no drag
    let ids = selIds.includes(el.id) ? selIds : [el.id];
    if (!selIds.includes(el.id)) setSelIds(ids);
    ids = ids.filter(id => !doc.elements.find(x => x.id === id)?.locked);
    const starts: Record<string, { x: number; y: number }> = {};
    for (const id of ids) { const m = doc.elements.find(x => x.id === id); if (m) starts[id] = { x: m.x, y: m.y }; }
    op.current = { kind: 'move', ids, primary: el.id, sx: e.clientX, sy: e.clientY, starts };
  };
  const startResize = (e: React.MouseEvent, el: CanvasElement, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation();
    op.current = { kind: 'resize', id: el.id, corner, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  };
  const startRotate = (e: React.MouseEvent, el: CanvasElement) => {
    e.stopPropagation();
    const r = boardRect();
    op.current = { kind: 'rotate', id: el.id, cx: r.left + (el.x + el.w / 2) / 100 * r.width, cy: r.top + (el.y + el.h / 2) / 100 * r.height };
  };

  // Snap a position so an edge/center aligns to a target (board centre/edges + other
  // elements' edges/centres); returns the snapped value + the guide line to draw.
  const snap1 = (val: number, size: number, targets: number[]): { v: number; guide: number | null } => {
    const pts = [val, val + size / 2, val + size];
    let best = { d: 1.4, adjust: 0, guide: null as number | null };
    for (const p of pts) for (const t of targets) { const d = Math.abs(p - t); if (d < best.d) best = { d, adjust: t - p, guide: t }; }
    return { v: val + best.adjust, guide: best.guide };
  };

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const o = op.current; if (!o) return;
      const r = boardRect();
      if (o.kind === 'move') {
        const dxRaw = (e.clientX - o.sx) / r.width * 100, dyRaw = (e.clientY - o.sy) / r.height * 100;
        if (o.ids.length > 1) {
          // Group move — shift all selected by the same delta (no snapping).
          setGuides({ x: [], y: [] });
          setEls(doc.elements.map(el => o.starts[el.id]
            ? { ...el, x: clamp(o.starts[el.id].x + dxRaw, -20, 100), y: clamp(o.starts[el.id].y + dyRaw, -20, 100) } : el));
        } else {
          const el = doc.elements.find(x => x.id === o.primary); if (!el) return;
          const rawX = clamp(o.starts[o.primary].x + dxRaw, -20, 100);
          const rawY = clamp(o.starts[o.primary].y + dyRaw, -20, 100);
          const others = doc.elements.filter(x => x.id !== o.primary);
          const tx = [0, 50, 100, ...others.flatMap(x => [x.x, x.x + x.w / 2, x.x + x.w])];
          const ty = [0, 50, 100, ...others.flatMap(x => [x.y, x.y + x.h / 2, x.y + x.h])];
          const sx = e.altKey ? { v: rawX, guide: null } : snap1(rawX, el.w, tx);
          const sy = e.altKey ? { v: rawY, guide: null } : snap1(rawY, el.h, ty);
          setGuides({ x: sx.guide != null ? [sx.guide] : [], y: sy.guide != null ? [sy.guide] : [] });
          patch(o.primary, { x: sx.v, y: sy.v });
        }
      } else if (o.kind === 'resize') {
        const dx = (e.clientX - o.sx) / r.width * 100, dy = (e.clientY - o.sy) / r.height * 100;
        let w = o.ow, h = o.oh;
        if (o.corner === 'se') { w = o.ow + dx; h = o.oh + dy; }
        if (o.corner === 'sw') { w = o.ow - dx; h = o.oh + dy; }
        if (o.corner === 'ne') { w = o.ow + dx; h = o.oh - dy; }
        if (o.corner === 'nw') { w = o.ow - dx; h = o.oh - dy; }
        w = Math.max(3, w); h = Math.max(3, h);
        if (e.shiftKey && o.ow > 0) h = w * (o.oh / o.ow); // Shift = lock aspect ratio
        // The opposite corner stays fixed.
        const left = o.corner === 'nw' || o.corner === 'sw';
        const top = o.corner === 'nw' || o.corner === 'ne';
        const x = left ? (o.ox + o.ow) - w : o.ox;
        const y = top ? (o.oy + o.oh) - h : o.oy;
        patch(o.id, { x, y, w, h });
      } else if (o.kind === 'rotate') {
        let deg = Math.atan2(e.clientY - o.cy, e.clientX - o.cx) * 180 / Math.PI + 90;
        if (!e.altKey) deg = Math.round(deg / 15) * 15; // snap to 15° unless Alt
        patch(o.id, { rotation: Math.round(deg) });
      }
    };
    const onUp = () => { op.current = null; setGuides({ x: [], y: [] }); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Keyboard: delete, undo/redo, duplicate, arrow-nudge.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if (meta && e.key.toLowerCase() === 'd' && selId) { e.preventDefault(); duplicate(selId); return; }
      if (meta && e.key.toLowerCase() === 'c' && selIds.length) { clipboard.current = doc.elements.filter(el => selIds.includes(el.id)); return; }
      if (meta && e.key.toLowerCase() === 'v' && clipboard.current.length) {
        e.preventDefault();
        const copies = clipboard.current.map(el => ({ ...el, id: newId(), x: clamp(el.x + 4, 0, 92), y: clamp(el.y + 4, 0, 92) }));
        setEls([...doc.elements, ...copies]); setSelIds(copies.map(x => x.id)); return;
      }
      if (!selIds.length) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setEls(doc.elements.filter(el => !selIds.includes(el.id))); setSelIds([]); return; }
      const step = e.shiftKey ? 5 : 1;
      const nudge = (dx: number, dy: number) => { e.preventDefault(); setEls(doc.elements.map(el => selIds.includes(el.id) && !el.locked ? { ...el, x: clamp(el.x + dx, -20, 100), y: clamp(el.y + dy, -20, 100) } : el)); };
      if (e.key === 'ArrowLeft') nudge(-step, 0);
      if (e.key === 'ArrowRight') nudge(step, 0);
      if (e.key === 'ArrowUp') nudge(0, -step);
      if (e.key === 'ArrowDown') nudge(0, step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, selIds]);

  const onUpload = async (file: File, forBg: boolean) => {
    try { const k = await uploadToR2(file, 'banners'); if (forBg) patchBg({ type: 'image', imageKey: k }); else if (sel) patchSel({ imageKey: k }); }
    catch { /* ignore */ }
  };

  const bg = doc.background;
  const bgImg = url(bg.imageKey);
  const boardBg = bg.type === 'solid' ? bg.color1 : bg.type === 'image' ? '#1a1714' : `linear-gradient(${bg.angle}deg, ${bg.color1}, ${bg.color2})`;

  return (
    <div className={c.editor}>
      {/* Left — add + layers */}
      <div className={c.left}>
        <div className={c.toolbar}>
          <button type="button" className={c.toolBtn} onClick={() => add('text')}>＋ Text</button>
          <button type="button" className={c.toolBtn} onClick={() => add('button')}>＋ Button</button>
          <button type="button" className={c.toolBtn} onClick={() => add('rect')}>＋ Box</button>
          <button type="button" className={c.toolBtn} onClick={() => add('ellipse')}>＋ Circle</button>
          <button type="button" className={c.toolBtn} onClick={() => add('image')}>＋ Image</button>
          <input ref={imgRef} type="file" accept="image/*" className={c.hidden} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f, false); e.target.value = ''; }} />
        </div>
        <div className={c.tplHead}>Start from a template</div>
        <div className={c.tplRow}>
          {CANVAS_TEMPLATES.map(t => <button type="button" key={t.id} className={c.tplChip} title={`Apply “${t.label}”`} onClick={() => applyTemplate(t)}>{t.label}</button>)}
        </div>
        <div className={c.layersHead}>Layers</div>
        <div className={c.layers}>
          {doc.elements.length === 0 && <div className={c.layerEmpty}>No elements yet. Add text, an image, or a shape.</div>}
          {doc.elements.map(el => (
            <div key={el.id} className={`${c.layer} ${selIds.includes(el.id) ? c.layerSel : ''}`} onClick={e => e.shiftKey ? toggleSel(el.id) : setSelId(el.id)}>
              <span className={c.layerType}>{TYPE_ICON[el.type]}</span>
              <span className={`${c.layerName} ${el.hidden ? c.layerHidden : ''}`}>{el.type === 'text' || el.type === 'button' ? (el.text || el.type) : el.type}</span>
              <button type="button" className={c.layerIcon} title={el.hidden ? 'Show' : 'Hide'} onClick={e => { e.stopPropagation(); toggleHide(el.id); }}>{el.hidden ? '🙈' : '👁'}</button>
              <button type="button" className={c.layerIcon} title={el.locked ? 'Unlock' : 'Lock'} onClick={e => { e.stopPropagation(); toggleLock(el.id); }}>{el.locked ? '🔒' : '🔓'}</button>
              <button type="button" className={c.layerIcon} title="Up" onClick={e => { e.stopPropagation(); reorder(el.id, 1); }}>↑</button>
              <button type="button" className={c.layerIcon} title="Down" onClick={e => { e.stopPropagation(); reorder(el.id, -1); }}>↓</button>
            </div>
          ))}
        </div>
      </div>

      {/* Center — toolbar + art-board */}
      <div className={c.center}>
        <div className={c.topbar}>
          <button type="button" className={c.tbBtn} disabled={!undoRef.current.length} onClick={doUndo} title="Undo (⌘Z)">↶</button>
          <button type="button" className={c.tbBtn} disabled={!redoRef.current.length} onClick={doRedo} title="Redo (⌘⇧Z)">↷</button>
          <span className={c.tbDiv} />
          <button type="button" className={c.tbBtn} disabled={!selIds.length} onClick={() => align('left')} title="Align left">⊣</button>
          <button type="button" className={c.tbBtn} disabled={!selIds.length} onClick={() => align('hcenter')} title="Centre horizontally">⊟</button>
          <button type="button" className={c.tbBtn} disabled={!selIds.length} onClick={() => align('right')} title="Align right">⊢</button>
          <span className={c.tbDiv} />
          <button type="button" className={c.tbBtn} disabled={!selIds.length} onClick={() => align('top')} title="Align top">⊤</button>
          <button type="button" className={c.tbBtn} disabled={!selIds.length} onClick={() => align('vcenter')} title="Centre vertically">⊞</button>
          <button type="button" className={c.tbBtn} disabled={!selIds.length} onClick={() => align('bottom')} title="Align bottom">⊥</button>
          <span className={c.tbDiv} />
          <button type="button" className={c.tbBtn} disabled={!selId} onClick={() => selId && toFront(selId)} title="Bring to front">⤒</button>
          <button type="button" className={c.tbBtn} disabled={!selId} onClick={() => selId && toBack(selId)} title="Send to back">⤓</button>
          <span className={c.tbHint}>{selIds.length > 1 ? `${selIds.length} selected · drag to move all` : 'Drag to move · Shift-click multi-select · ⌘C/⌘V'}</span>
          <span className={c.tbDiv} />
          <button type="button" className={c.tbBtn} onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Zoom out">−</button>
          <span className={c.tbZoom}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={c.tbBtn} onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} title="Zoom in">+</button>
          <button type="button" className={c.tbBtn} disabled={zoom === 1} onClick={() => setZoom(1)} title="Reset zoom (fit)">⤢</button>
        </div>
        <div className={c.stage} onMouseDown={() => setSelIds([])}>
        <div className={c.stageInner} style={{ width: `calc(min(100%, 720px) * ${zoom})`, maxWidth: 'none' }}>
          <div ref={boardRef} className={c.board} style={{ aspectRatio: String(aspect), background: boardBg }}>
            {bg.type === 'image' && bgImg && <img src={bgImg} alt="" className={c.bgImg} style={{ objectFit: bg.fit, objectPosition: `${bg.focalX}% ${bg.focalY}%` }} />}
            {bg.type === 'image' && bgImg && (bg.overlay ?? 0) > 0 && <div className={c.bgScrim} style={{ background: `rgba(0,0,0,${(bg.overlay ?? 0) / 100})` }} />}
            {guides.x.map((gx, i) => <div key={`gx${i}`} className={c.guideV} style={{ left: `${gx}%` }} />)}
            {guides.y.map((gy, i) => <div key={`gy${i}`} className={c.guideH} style={{ top: `${gy}%` }} />)}
            {doc.elements.filter(el => !el.hidden).length === 0 && (
              <div className={c.boardEmpty}>
                <div className={c.boardEmptyTitle}>Blank canvas</div>
                <div className={c.boardEmptySub}>Use <b>+ Text</b>, <b>+ Image</b>, or a shape on the left to start designing. Drag to move, double-click text to edit.</div>
              </div>
            )}
            {doc.elements.filter(el => !el.hidden).map(el => (
              <div key={el.id}
                className={`${c.elBox} ${selIds.includes(el.id) ? c.elSelected : ''}`}
                style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined }}
                onMouseDown={e => { if (editId !== el.id) startMove(e, el); }}
                onDoubleClick={e => { e.stopPropagation(); if (el.type === 'text' || el.type === 'button') { setSelId(el.id); setEditId(el.id); } }}>
                {editId === el.id ? (
                  <textarea autoFocus className={c.inlineEdit}
                    style={{ fontFamily: el.font === 'serif' || el.font === 'display' ? 'Georgia, serif' : 'inherit', textAlign: el.align, color: (el.type === 'button' ? el.color : el.color) || '#fff' }}
                    value={el.text ?? ''} onChange={ev => patch(el.id, { text: ev.target.value })}
                    onBlur={() => setEditId(null)} onMouseDown={ev => ev.stopPropagation()}
                    onKeyDown={ev => { if (ev.key === 'Escape' || (ev.key === 'Enter' && !ev.shiftKey)) { ev.preventDefault(); setEditId(null); } }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <ElementView el={{ ...el, x: 0, y: 0, w: 100, h: 100, rotation: 0 }} />
                  </div>
                )}
                {selId === el.id && (
                  <>
                    <span className={`${c.handle} ${c.hNW}`} onMouseDown={e => startResize(e, el, 'nw')} />
                    <span className={`${c.handle} ${c.hNE}`} onMouseDown={e => startResize(e, el, 'ne')} />
                    <span className={`${c.handle} ${c.hSW}`} onMouseDown={e => startResize(e, el, 'sw')} />
                    <span className={`${c.handle} ${c.hSE}`} onMouseDown={e => startResize(e, el, 'se')} />
                    <span className={c.rotHandle} onMouseDown={e => startRotate(e, el)} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Right — properties */}
      <div className={c.props}>
        {sel ? <ElementProps el={sel} patch={patchSel} onUpload={f => onUpload(f, false)} onDelete={() => remove(sel.id)} onDuplicate={() => duplicate(sel.id)} />
          : <BackgroundProps bg={bg} patch={patchBg} bgRef={bgImgRef} onUpload={f => onUpload(f, true)} />}
      </div>
    </div>
  );
}

function ElementProps({ el, patch, onUpload, onDelete, onDuplicate }: { el: CanvasElement; patch: (p: Partial<CanvasElement>) => void; onUpload: (f: File) => void; onDelete: () => void; onDuplicate: () => void }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const isText = el.type === 'text' || el.type === 'button';
  const hasFill = el.type === 'button' || el.type === 'rect' || el.type === 'ellipse';
  const num = (v: number) => Math.round(v * 10) / 10;
  return (
    <>
      <p className={c.propsHead}>{el.type} properties</p>
      {isText && (
        <div className={c.row}><span className={c.rowLbl}>{el.type === 'button' ? 'Label' : 'Text'}</span>
          <textarea className={c.ta} rows={2} value={el.text ?? ''} onChange={e => patch({ text: e.target.value })} /></div>
      )}
      {isText && (<>
        <div className={c.row}><span className={c.rowLbl}>Font</span>
          <div className={c.seg}>{(['sans', 'serif', 'display', 'mono'] as const).map(f => <button type="button" key={f} className={`${c.segBtn} ${(el.font ?? 'sans') === f ? c.segOn : ''}`} onClick={() => patch({ font: f })}>{f}</button>)}</div></div>
        <div className={c.grid2}>
          <div className={c.row}><span className={c.rowLbl}>Size — {el.size}</span><input type="range" min={2} max={16} step={0.2} value={el.size ?? 6} onChange={e => patch({ size: Number(e.target.value) })} className={c.range} /></div>
          <div className={c.row}><span className={c.rowLbl}>Weight</span><div className={c.seg}>{([400, 700, 900] as const).map(w => <button type="button" key={w} className={`${c.segBtn} ${(el.weight ?? 800) === w ? c.segOn : ''}`} onClick={() => patch({ weight: w })}>{w}</button>)}</div></div>
        </div>
        <div className={c.grid2}>
          <div className={c.row}><span className={c.rowLbl}>Letter-spacing — {el.letterSpacing ?? 0}</span><input type="range" min={-10} max={30} step={0.5} value={el.letterSpacing ?? 0} onChange={e => patch({ letterSpacing: Number(e.target.value) })} className={c.range} /></div>
          <div className={c.row}><span className={c.rowLbl}>Line-height — {((el.lineHeight ?? 110) / 100).toFixed(2)}</span><input type="range" min={80} max={200} step={2} value={el.lineHeight ?? 110} onChange={e => patch({ lineHeight: Number(e.target.value) })} className={c.range} /></div>
        </div>
        <div className={c.row}><span className={c.rowLbl}>Align</span>
          <div className={c.seg}>{(['left', 'center', 'right'] as const).map(a => <button type="button" key={a} className={`${c.segBtn} ${(el.align ?? 'left') === a ? c.segOn : ''}`} onClick={() => patch({ align: a })}>{a}</button>)}</div></div>
        <div className={c.row}><span className={c.rowLbl}>Text colour</span>
          <div className={c.colorRow}><input type="color" className={c.swatch} value={el.color || '#ffffff'} onChange={e => patch({ color: e.target.value })} /><input className={c.in} value={el.color || ''} onChange={e => patch({ color: e.target.value })} /></div></div>
        <div className={c.row}><span className={c.rowLbl}>Shadow — {el.shadow ?? (el.type === 'button' ? 24 : 28)}%</span><input type="range" min={0} max={100} value={el.shadow ?? (el.type === 'button' ? 24 : 28)} onChange={e => patch({ shadow: Number(e.target.value) })} className={c.range} /></div>
        {el.type === 'text' && (<>
          <div className={c.row}><span className={c.rowLbl}>Outline width — {el.strokeW ?? 0}</span><input type="range" min={0} max={2} step={0.05} value={el.strokeW ?? 0} onChange={e => patch({ strokeW: Number(e.target.value) })} className={c.range} /></div>
          {!!el.strokeW && <div className={c.row}><span className={c.rowLbl}>Outline colour</span>
            <div className={c.colorRow}><input type="color" className={c.swatch} value={el.stroke || '#000000'} onChange={e => patch({ stroke: e.target.value })} /><input className={c.in} value={el.stroke || ''} onChange={e => patch({ stroke: e.target.value })} /></div></div>}
          <div className={c.row}><span className={c.rowLbl}>Sync with content</span>
            <div className={c.seg}>{([['none', 'None'], ['title', 'Headline'], ['subtitle', 'Subtitle']] as const).map(([v, lbl]) => <button type="button" key={v} className={`${c.segBtn} ${(el.bind ?? 'none') === v ? c.segOn : ''}`} onClick={() => patch({ bind: v === 'none' ? undefined : v })}>{lbl}</button>)}</div>
            <span className={c.hint}>Bound text mirrors the Content field — edit either side.</span></div>
        </>)}
      </>)}
      {hasFill && (<>
        <div className={c.row}><span className={c.rowLbl}>Fill</span>
          <div className={c.seg}>{(['solid', 'gradient'] as const).map(t => <button type="button" key={t} className={`${c.segBtn} ${(el.fillType ?? 'solid') === t ? c.segOn : ''}`} onClick={() => patch({ fillType: t })}>{t}</button>)}</div></div>
        <div className={c.row}><span className={c.rowLbl}>{(el.fillType === 'gradient') ? (el.type === 'button' ? 'Fill 1' : 'Colour 1') : (el.type === 'button' ? 'Button fill' : 'Fill')}</span>
          <div className={c.colorRow}><input type="color" className={c.swatch} value={el.fill || '#ffffff'} onChange={e => patch({ fill: e.target.value })} /><input className={c.in} value={el.fill || ''} onChange={e => patch({ fill: e.target.value })} /></div></div>
        {el.fillType === 'gradient' && (<>
          <div className={c.row}><span className={c.rowLbl}>Colour 2</span>
            <div className={c.colorRow}><input type="color" className={c.swatch} value={el.fill2 || '#000000'} onChange={e => patch({ fill2: e.target.value })} /><input className={c.in} value={el.fill2 || ''} onChange={e => patch({ fill2: e.target.value })} /></div></div>
          <div className={c.row}><span className={c.rowLbl}>Gradient angle — {el.fillAngle ?? 135}°</span><input type="range" min={0} max={360} value={el.fillAngle ?? 135} onChange={e => patch({ fillAngle: Number(e.target.value) })} className={c.range} /></div>
        </>)}
      </>)}
      {(el.type === 'rect' || el.type === 'ellipse') && (<>
        <div className={c.row}><span className={c.rowLbl}>Border width — {el.strokeW ?? 0}</span><input type="range" min={0} max={3} step={0.1} value={el.strokeW ?? 0} onChange={e => patch({ strokeW: Number(e.target.value) })} className={c.range} /></div>
        {!!el.strokeW && <div className={c.row}><span className={c.rowLbl}>Border colour</span>
          <div className={c.colorRow}><input type="color" className={c.swatch} value={el.stroke || '#000000'} onChange={e => patch({ stroke: e.target.value })} /><input className={c.in} value={el.stroke || ''} onChange={e => patch({ stroke: e.target.value })} /></div></div>}
      </>)}
      {el.type === 'button' && (() => {
        const lt: LinkType = el.linkType ?? linkTypeOf(el.link);
        const lv = linkValueOf(lt, el.link);
        const setLink = (t: LinkType, v: string) => patch({ linkType: t, link: resolveLink(t, v) });
        return (<>
          <div className={c.row}><span className={c.rowLbl}>Links to</span>
            <div className={c.seg}>{(['category', 'collection', 'url'] as const).map(t => <button type="button" key={t} className={`${c.segBtn} ${lt === t ? c.segOn : ''}`} onClick={() => setLink(t, lv)}>{t === 'url' ? 'Custom' : t}</button>)}</div></div>
          <div className={c.row}><span className={c.rowLbl}>{lt === 'collection' ? 'Collection slug' : lt === 'category' ? 'Category slug' : 'Path'}</span>
            <input className={c.in} value={lv} onChange={e => setLink(lt, e.target.value)} placeholder={lt === 'url' ? '/categories' : 'e.g. wedding'} /></div>
          <span className={c.hint}>Opens <code>{el.link || '/categories'}</code></span>
        </>);
      })()}
      {(el.type === 'button' || el.type === 'rect' || el.type === 'image') && (
        <div className={c.row}><span className={c.rowLbl}>Corner radius — {el.radius ?? 0}</span><input type="range" min={0} max={50} step={0.5} value={el.radius ?? 0} onChange={e => patch({ radius: Number(e.target.value) })} className={c.range} /></div>
      )}
      {el.type === 'image' && (<>
        <input ref={fileRef} type="file" accept="image/*" className={c.hidden} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
        <button type="button" className={c.dupBtn} onClick={() => fileRef.current?.click()}>{el.imageKey ? 'Replace image' : 'Upload image'}</button>
        <div className={c.row}><span className={c.rowLbl}>Fit</span><div className={c.seg}>{(['cover', 'contain'] as const).map(f => <button type="button" key={f} className={`${c.segBtn} ${(el.fit ?? 'cover') === f ? c.segOn : ''}`} onClick={() => patch({ fit: f })}>{f}</button>)}</div></div>
      </>)}
      {(el.type === 'rect' || el.type === 'ellipse' || el.type === 'image') && (
        <div className={c.row}><span className={c.rowLbl}>Shadow — {el.shadow ?? 0}%</span><input type="range" min={0} max={100} value={el.shadow ?? 0} onChange={e => patch({ shadow: Number(e.target.value) })} className={c.range} /></div>
      )}
      <div className={c.row}><span className={c.rowLbl}>Opacity — {Math.round((el.opacity ?? 1) * 100)}%</span><input type="range" min={0.1} max={1} step={0.05} value={el.opacity ?? 1} onChange={e => patch({ opacity: Number(e.target.value) })} className={c.range} /></div>
      <div className={c.row}><span className={c.rowLbl}>Rotation — {el.rotation}°</span><input type="range" min={-180} max={180} value={el.rotation} onChange={e => patch({ rotation: Number(e.target.value) })} className={c.range} /></div>
      <p className={c.propsHead}>Motion</p>
      <div className={c.row}><span className={c.rowLbl}>Entrance animation</span>
        <select className={c.in} value={el.anim ?? 'none'} onChange={e => patch({ anim: e.target.value as AnimType })}>
          <option value="none">None</option>
          <option value="fade">Fade in</option>
          <option value="slide-up">Slide up</option>
          <option value="slide-down">Slide down</option>
          <option value="slide-left">Slide in ← left</option>
          <option value="slide-right">Slide in → right</option>
          <option value="zoom">Zoom in</option>
          <option value="rise">Rise up</option>
          <option value="pop">Pop</option>
        </select></div>
      {el.anim && el.anim !== 'none' && (
        <div className={c.grid2}>
          <div className={c.row}><span className={c.rowLbl}>Delay — {el.animDelay ?? 0}ms</span><input type="range" min={0} max={2000} step={50} value={el.animDelay ?? 0} onChange={e => patch({ animDelay: Number(e.target.value) })} className={c.range} /></div>
          <div className={c.row}><span className={c.rowLbl}>Duration — {el.animDuration ?? 600}ms</span><input type="range" min={200} max={2000} step={50} value={el.animDuration ?? 600} onChange={e => patch({ animDuration: Number(e.target.value) })} className={c.range} /></div>
        </div>
      )}
      <p className={c.propsHead}>Position &amp; size (%)</p>
      <div className={c.grid2}>
        <div className={c.row}><span className={c.rowLbl}>X</span><input type="number" className={c.in} value={num(el.x)} onChange={e => patch({ x: clamp(Number(e.target.value), -50, 150) })} /></div>
        <div className={c.row}><span className={c.rowLbl}>Y</span><input type="number" className={c.in} value={num(el.y)} onChange={e => patch({ y: clamp(Number(e.target.value), -50, 150) })} /></div>
        <div className={c.row}><span className={c.rowLbl}>W</span><input type="number" className={c.in} value={num(el.w)} onChange={e => patch({ w: clamp(Number(e.target.value), 1, 200) })} /></div>
        <div className={c.row}><span className={c.rowLbl}>H</span><input type="number" className={c.in} value={num(el.h)} onChange={e => patch({ h: clamp(Number(e.target.value), 1, 200) })} /></div>
      </div>
      <div className={c.propActions}>
        <button type="button" className={c.dupBtn} onClick={onDuplicate}>Duplicate</button>
        <button type="button" className={c.delBtn} onClick={onDelete}>Delete</button>
      </div>
    </>
  );
}

function BackgroundProps({ bg, patch, bgRef, onUpload }: { bg: CanvasDoc['background']; patch: (p: Partial<CanvasDoc['background']>) => void; bgRef: React.RefObject<HTMLInputElement | null>; onUpload: (f: File) => void }) {
  return (
    <>
      <p className={c.propsHead}>Background</p>
      <p className={c.hint}>Click an element to edit it, or design the background here.</p>
      <div className={c.row}><span className={c.rowLbl}>Type</span>
        <div className={c.seg}>{(['gradient', 'solid', 'image'] as const).map(t => <button type="button" key={t} className={`${c.segBtn} ${bg.type === t ? c.segOn : ''}`} onClick={() => patch({ type: t })}>{t}</button>)}</div></div>
      {bg.type !== 'image' && (
        <div className={c.row}><span className={c.rowLbl}>{bg.type === 'solid' ? 'Colour' : 'Colour 1'}</span>
          <div className={c.colorRow}><input type="color" className={c.swatch} value={bg.color1} onChange={e => patch({ color1: e.target.value })} /><input className={c.in} value={bg.color1} onChange={e => patch({ color1: e.target.value })} /></div></div>
      )}
      {bg.type === 'gradient' && (<>
        <div className={c.row}><span className={c.rowLbl}>Colour 2</span>
          <div className={c.colorRow}><input type="color" className={c.swatch} value={bg.color2} onChange={e => patch({ color2: e.target.value })} /><input className={c.in} value={bg.color2} onChange={e => patch({ color2: e.target.value })} /></div></div>
        <div className={c.row}><span className={c.rowLbl}>Angle — {bg.angle}°</span><input type="range" min={0} max={360} value={bg.angle} onChange={e => patch({ angle: Number(e.target.value) })} className={c.range} /></div>
      </>)}
      {bg.type === 'image' && (<>
        <input ref={bgRef} type="file" accept="image/*" className={c.hidden} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
        <button type="button" className={c.dupBtn} onClick={() => bgRef.current?.click()}>{bg.imageKey ? 'Replace image' : 'Upload image'}</button>
        <div className={c.row}><span className={c.rowLbl}>Overlay — {bg.overlay ?? 0}%</span><input type="range" min={0} max={80} value={bg.overlay ?? 0} onChange={e => patch({ overlay: Number(e.target.value) })} className={c.range} /></div>
        <div className={c.row}><span className={c.rowLbl}>Ambient motion (Ken Burns)</span>
          <select className={c.in} value={bg.kenBurns ?? 'none'} onChange={e => patch({ kenBurns: e.target.value as KenBurns })}>
            <option value="none">None</option>
            <option value="zoom-in">Slow zoom in</option>
            <option value="zoom-out">Slow zoom out</option>
            <option value="pan-left">Pan left</option>
            <option value="pan-right">Pan right</option>
          </select>
          <span className={c.hint}>A slow, looping drift — plays in preview &amp; on the live site.</span></div>
      </>)}
    </>
  );
}
