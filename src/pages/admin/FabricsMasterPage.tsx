import React from 'react';
import { fabricsApi } from '../../api/adminApi';
import type { Fabric, FabricInput } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import { UilPlus } from '@iconscout/react-unicons';

const EMPTY = { code: '', name: '', composition: '', weave: '', finish: '', weight_gsm: '', origin: '', price_per_meter: '', care: '' };
type Form = typeof EMPTY;

export const FabricsMasterPage: React.FC = () => {
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<string>('');
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    fabricsApi
      .list({ q: search || undefined, active: activeFilter === '' ? undefined : activeFilter === 'true' })
      .then(setFabrics)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [search, activeFilter]);

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (f: Fabric) => {
    setEditingId(f.id);
    setForm({
      code: f.code, name: f.name, composition: f.composition,
      weave: f.weave ?? '', finish: f.finish ?? '',
      weight_gsm: f.weight_gsm != null ? String(f.weight_gsm) : '',
      origin: f.origin ?? '', price_per_meter: f.price_per_meter ?? '',
      care: (f.care_instructions ?? []).join(', '),
    });
    setOpen(true);
  };
  const set = (k: keyof Form) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.composition.trim()) {
      toast('error', 'Code, name and composition are required');
      return;
    }
    setSaving(true);
    const input: FabricInput = {
      code: form.code.trim(),
      name: form.name.trim(),
      composition: form.composition.trim(),
      weave: form.weave.trim() || null,
      finish: form.finish.trim() || null,
      weight_gsm: form.weight_gsm ? Number(form.weight_gsm) : null,
      origin: form.origin.trim() || null,
      price_per_meter: form.price_per_meter ? Number(form.price_per_meter) : null,
      care_instructions: form.care.split(',').map((x) => x.trim()).filter(Boolean),
    };
    try {
      if (editingId) await fabricsApi.update(editingId, input);
      else await fabricsApi.create(input);
      toast('success', editingId ? 'Fabric updated' : 'Fabric created');
      setOpen(false);
      load();
    } catch (e) {
      toast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: Fabric) => {
    try {
      await fabricsApi.setActive(f.id, !f.is_active);
      setFabrics((xs) => xs.map((x) => (x.id === f.id ? { ...x, is_active: !f.is_active } : x)));
    } catch (e) {
      toast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Fabrics Master</h1>
        <Button variant="primary" onClick={openCreate}><UilPlus size={16} /> New fabric</Button>
      </div>

      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Fabric</th><th>Code</th><th>Composition</th><th>Weave</th><th>GSM</th><th>Price/m</th><th>Used by</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : fabrics.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No fabrics. Add your first SKU.</td></tr>
            ) : (
              fabrics.map((f) => (
                <tr key={f.id} className={styles.row} onClick={() => openEdit(f)} style={{ cursor: 'pointer' }}>
                  <td className={styles.customerName} style={{ fontWeight: 500 }}>{f.name}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{f.code}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{f.composition}</td>
                  <td style={{ textTransform: 'capitalize' }}>{f.weave ?? '—'}</td>
                  <td>{f.weight_gsm ?? '—'}</td>
                  <td className={styles.total}>{f.price_per_meter ? `₹${Number(f.price_per_meter).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{f.design_count ?? 0} designs · {f.listing_count ?? 0} listings</td>
                  <td onClick={(e) => { e.stopPropagation(); toggleActive(f); }}>
                    <span className={`${styles.stagePill} ${f.is_active ? styles.stageSuccess : styles.stageNeutral}`} style={{ cursor: 'pointer' }}>
                      {f.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Edit fabric' : 'New fabric'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" state={saving ? 'loading' : 'default'} onClick={save}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div className={styles.modalGrid}>
          <Input label="Code *" value={form.code} onChange={set('code')} placeholder="e.g. DNM-9" />
          <Input label="Name *" value={form.name} onChange={set('name')} placeholder="e.g. Indigo Denim" />
          <Input label="Composition *" value={form.composition} onChange={set('composition')} placeholder="98% Cotton, 2% Elastane" />
          <Input label="Weave" value={form.weave} onChange={set('weave')} placeholder="twill / poplin / oxford" />
          <Input label="Finish" value={form.finish} onChange={set('finish')} placeholder="enzyme wash" />
          <Input label="Weight (GSM)" type="number" value={form.weight_gsm} onChange={set('weight_gsm')} placeholder="320" />
          <Input label="Origin" value={form.origin} onChange={set('origin')} placeholder="Erode, Tamil Nadu" />
          <Input label="Price / metre (₹)" type="number" value={form.price_per_meter} onChange={set('price_per_meter')} placeholder="250" />
          <Input label="Care (comma-separated)" value={form.care} onChange={set('care')} placeholder="Cold wash, Hang dry" />
        </div>
      </Modal>
    </div>
  );
};

export default FabricsMasterPage;
