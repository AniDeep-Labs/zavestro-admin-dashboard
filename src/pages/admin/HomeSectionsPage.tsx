import React from 'react';
import { homeSectionsApi } from '../../api/adminApi';
import type { HomeSection, HomeSectionPayload } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { UilArrowDown, UilArrowUp, UilPlus, UilRefresh, UilTrashAlt } from "@iconscout/react-unicons";

const TYPES: HomeSection['type'][] = ['hero', 'occasions', 'new_arrivals', 'collection', 'categories'];
const TYPE_LABEL: Record<HomeSection['type'], string> = {
  hero: 'Hero banners', occasions: 'Shop by Occasion', new_arrivals: 'New Arrivals',
  collection: 'Collection rail', categories: 'Category rail',
};

/**
 * Server-driven homepage layout — arrange the sections the customer apps render
 * (GET /api/catalog/home). Reorder / toggle / retitle with no code release.
 */
export const HomeSectionsPage: React.FC = () => {
  const [sections, setSections] = React.useState<HomeSection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [draft, setDraft] = React.useState<HomeSectionPayload>({ type: 'collection', title: '', sort_order: 50, item_limit: 10, is_active: true });

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    homeSectionsApi.list()
      .then(s => setSections([...s].sort((a, b) => a.sort_order - b.sort_order)))
      .catch(e => toast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);

  const patch = async (id: string, data: HomeSectionPayload) => {
    try { await homeSectionsApi.update(id, data); load(); }
    catch (e) { toast('error', 'Update failed', e instanceof Error ? e.message : undefined); }
  };

  // Reorder by swapping sort_order with the adjacent section.
  const move = async (idx: number, dir: -1 | 1) => {
    const a = sections[idx], b = sections[idx + dir];
    if (!a || !b) return;
    await Promise.all([homeSectionsApi.update(a.id, { sort_order: b.sort_order }), homeSectionsApi.update(b.id, { sort_order: a.sort_order })]);
    load();
  };

  const create = async () => {
    try {
      await homeSectionsApi.create({ ...draft, title: draft.title || undefined });
      setShowCreate(false);
      setDraft({ type: 'collection', title: '', sort_order: 50, item_limit: 10, is_active: true });
      toast('success', 'Section added');
      load();
    } catch (e) { toast('error', 'Create failed', e instanceof Error ? e.message : undefined); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this home section?')) return;
    try { await homeSectionsApi.delete(id); toast('success', 'Removed'); load(); }
    catch (e) { toast('error', 'Delete failed', e instanceof Error ? e.message : undefined); }
  };

  const cell: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--border, #eee)', fontSize: 14, textAlign: 'left' };

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Home Layout</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted,#888)', fontSize: 13 }}>
            Sections shown on the customer home screen, in order. Changes are live — no app release.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnGhost}><UilRefresh size={15} /> Refresh</button>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}><UilPlus size={15} /> Add section</button>
        </div>
      </div>

      {loading ? <p>Loading…</p> : sections.length === 0 ? (
        <p style={{ color: 'var(--text-muted,#888)' }}>No sections yet. Add one to build the home screen.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card,#fff)', borderRadius: 8, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle,#fafafa)' }}>
              <th style={cell}>Order</th><th style={cell}>Type</th><th style={cell}>Title</th>
              <th style={cell}>Collection</th><th style={cell}>Active</th><th style={cell}></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, i) => (
              <tr key={s.id}>
                <td style={cell}>
                  <span style={{ marginRight: 8 }}>{s.sort_order}</span>
                  <button style={iconBtn} disabled={i === 0} onClick={() => move(i, -1)}><UilArrowUp size={14} /></button>
                  <button style={iconBtn} disabled={i === sections.length - 1} onClick={() => move(i, 1)}><UilArrowDown size={14} /></button>
                </td>
                <td style={cell}>{TYPE_LABEL[s.type] ?? s.type}</td>
                <td style={cell}>
                  <input defaultValue={s.title ?? ''} placeholder="(default)" style={inp}
                    onBlur={e => e.target.value !== (s.title ?? '') && patch(s.id, { title: e.target.value || undefined })} />
                </td>
                <td style={cell}>{s.type === 'collection' ? (
                  <input defaultValue={s.collection_slug ?? ''} placeholder="slug" style={inp}
                    onBlur={e => e.target.value !== (s.collection_slug ?? '') && patch(s.id, { collection_slug: e.target.value || undefined })} />
                ) : '—'}</td>
                <td style={cell}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={s.is_active} onChange={e => patch(s.id, { is_active: e.target.checked })} /> {s.is_active ? 'On' : 'Off'}
                  </label>
                </td>
                <td style={cell}><button style={iconBtn} onClick={() => remove(s.id)}><UilTrashAlt size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <div style={overlay} onClick={() => setShowCreate(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Add home section</h2>
            <label style={lbl}>Type</label>
            <select style={inp} value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as HomeSection['type'] }))}>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <label style={lbl}>Title (optional)</label>
            <input style={inp} value={draft.title ?? ''} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Section heading" />
            {draft.type === 'collection' && (<>
              <label style={lbl}>Collection slug</label>
              <input style={inp} value={draft.collection_slug ?? ''} onChange={e => setDraft(d => ({ ...d, collection_slug: e.target.value }))} placeholder="e.g. wedding" />
            </>)}
            <label style={lbl}>Sort order</label>
            <input style={inp} type="number" value={draft.sort_order ?? 50} onChange={e => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnGhost} onClick={() => setShowCreate(false)}>Cancel</button>
              <button style={btnPrimary} onClick={create}>Add</button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  );
};

const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent,#1f6b4f)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 };
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: '1px solid var(--border,#ddd)', borderRadius: 8, cursor: 'pointer', fontSize: 14 };
const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text,#333)' };
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border,#ddd)', borderRadius: 6, fontSize: 14, marginBottom: 4 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, margin: '10px 0 4px', color: 'var(--text-muted,#666)' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal: React.CSSProperties = { background: 'var(--card,#fff)', padding: 24, borderRadius: 12, width: 420, maxWidth: '90vw' };

export default HomeSectionsPage;
