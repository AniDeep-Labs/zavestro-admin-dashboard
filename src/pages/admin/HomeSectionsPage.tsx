import React from 'react';
import { homeSectionsApi } from '../../api/adminApi';
import type { HomeSection, HomeSectionPayload } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { UilArrowDown, UilArrowUp, UilPlus, UilRefresh, UilTrashAlt } from "@iconscout/react-unicons";
import { Modal } from '../../components/Modal/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert } from '../../components/Alert';
import styles from './HomeSectionsPage.module.css';

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
  // In-flight guard — blocks duplicate creates / raced reorder swaps (was unguarded).
  const [busy, setBusy] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<HomeSection | null>(null);
  const [removing, setRemoving] = React.useState(false);

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
    if (busy) return;
    setBusy(true);
    try { await homeSectionsApi.update(id, data); load(); }
    catch (e) { toast('error', 'Update failed', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  };

  // Reorder by swapping sort_order with the adjacent section.
  const move = async (idx: number, dir: -1 | 1) => {
    const a = sections[idx], b = sections[idx + dir];
    if (!a || !b || busy) return;
    setBusy(true);
    try {
      await Promise.all([homeSectionsApi.update(a.id, { sort_order: b.sort_order }), homeSectionsApi.update(b.id, { sort_order: a.sort_order })]);
      load();
    } catch (e) { toast('error', 'Reorder failed', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await homeSectionsApi.create({ ...draft, title: draft.title || undefined });
      setShowCreate(false);
      setDraft({ type: 'collection', title: '', sort_order: 50, item_limit: 10, is_active: true });
      toast('success', 'Section added');
      load();
    } catch (e) { toast('error', 'Create failed', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await homeSectionsApi.delete(removeTarget.id);
      toast('success', 'Removed');
      setRemoveTarget(null);
      load();
    } catch (e) { toast('error', 'Delete failed', e instanceof Error ? e.message : undefined); }
    finally { setRemoving(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Home Layout</h1>
          <p className={styles.subtitle}>
            Intended layout of sections for the customer home screen, in order.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={load} className={styles.btnGhost}><UilRefresh size={15} /> Refresh</button>
          <button onClick={() => setShowCreate(true)} className={styles.btnPrimary}><UilPlus size={15} /> Add section</button>
        </div>
      </div>

      <Alert
        type="warning"
        title="Not yet connected to the live storefront"
        message="The web and app home screens currently use a fixed, hand-built layout — they do not render from these sections. Changes here have no customer-facing effect yet. This page is kept for the planned move to a server-driven home (P5)."
      />


      {loading ? <p>Loading…</p> : sections.length === 0 ? (
        <p className={styles.empty}>No sections yet. Add one to build the home screen.</p>
      ) : (
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headRow}>
              <th className={styles.cell}>Order</th><th className={styles.cell}>Type</th><th className={styles.cell}>Title</th>
              <th className={styles.cell}>Collection</th><th className={styles.cell}>Active</th><th className={styles.cell}></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, i) => (
              <tr key={s.id}>
                <td className={styles.cell}>
                  <span className={styles.orderNum}>{s.sort_order}</span>
                  <button className={styles.iconBtn} aria-label="Move section up" disabled={busy || i === 0} onClick={() => move(i, -1)}><UilArrowUp size={14} /></button>
                  <button className={styles.iconBtn} aria-label="Move section down" disabled={busy || i === sections.length - 1} onClick={() => move(i, 1)}><UilArrowDown size={14} /></button>
                </td>
                <td className={styles.cell}>{TYPE_LABEL[s.type] ?? s.type}</td>
                <td className={styles.cell}>
                  <input defaultValue={s.title ?? ''} placeholder="(default)" className={styles.inp}
                    onBlur={e => e.target.value !== (s.title ?? '') && patch(s.id, { title: e.target.value || undefined })} />
                </td>
                <td className={styles.cell}>{s.type === 'collection' ? (
                  <input defaultValue={s.collection_slug ?? ''} placeholder="slug" className={styles.inp}
                    onBlur={e => e.target.value !== (s.collection_slug ?? '') && patch(s.id, { collection_slug: e.target.value || undefined })} />
                ) : '—'}</td>
                <td className={styles.cell}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={s.is_active} onChange={e => patch(s.id, { is_active: e.target.checked })} /> {s.is_active ? 'On' : 'Off'}
                  </label>
                </td>
                <td className={styles.cell}><button className={styles.iconBtn} aria-label="Remove section" onClick={() => setRemoveTarget(s)}><UilTrashAlt size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add home section"
        size="sm"
        footer={
          <div className={styles.modalActions}>
            <button className={styles.btnGhost} onClick={() => setShowCreate(false)}>Cancel</button>
            <button className={styles.btnPrimary} disabled={busy} onClick={create}>{busy ? 'Adding…' : 'Add'}</button>
          </div>
        }
      >
        <label className={styles.lbl}>Type</label>
        <select className={styles.inp} value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as HomeSection['type'] }))}>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <label className={styles.lbl}>Title (optional)</label>
        <input className={styles.inp} value={draft.title ?? ''} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Section heading" />
        {draft.type === 'collection' && (<>
          <label className={styles.lbl}>Collection slug</label>
          <input className={styles.inp} value={draft.collection_slug ?? ''} onChange={e => setDraft(d => ({ ...d, collection_slug: e.target.value }))} placeholder="e.g. wedding" />
        </>)}
        <label className={styles.lbl}>Sort order</label>
        <input className={styles.inp} type="number" value={draft.sort_order ?? 50} onChange={e => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))} />
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove this home section?"
        message={removeTarget ? `Remove the “${TYPE_LABEL[removeTarget.type] ?? removeTarget.type}” section? It’s dropped from the layout here — no customer-facing effect until the home feed is wired to the storefront (P5).` : ''}
        confirmLabel="Remove"
        variant="danger"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  );
};

export default HomeSectionsPage;
