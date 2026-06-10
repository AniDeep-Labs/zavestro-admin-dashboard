import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fabricsApi, uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import type { Fabric, FabricInput } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './FabricsMasterPage.module.css';
import { UilPlus, UilTimes, UilImagePlus } from '@iconscout/react-unicons';

const swatchUrl = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');
const EMPTY = { name: '', color_name: '', composition: '', weave: '', finish: '', weight_gsm: '', origin: '', supplier: '', price_per_meter: '', care: '' };
type Form = typeof EMPTY;

export const FabricsMasterPage: React.FC = () => {
  const navigate = useNavigate();
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingCode, setEditingCode] = React.useState('');
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [images, setImages] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
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

  const openCreate = () => { setEditingId(null); setEditingCode(''); setForm(EMPTY); setImages([]); setOpen(true); };
  const openEdit = (f: Fabric) => {
    setEditingId(f.id); setEditingCode(f.code);
    setForm({
      name: f.name, color_name: f.color_name ?? '', composition: f.composition,
      weave: f.weave ?? '', finish: f.finish ?? '', weight_gsm: f.weight_gsm != null ? String(f.weight_gsm) : '',
      origin: f.origin ?? '', supplier: f.supplier ?? '', price_per_meter: f.price_per_meter ?? '',
      care: (f.care_instructions ?? []).join(', '),
    });
    setImages(f.image_keys ?? []);
    setOpen(true);
  };
  const set = (k: keyof Form) => (v: string) => setForm((st) => ({ ...st, [k]: v }));

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 4 - images.length;
    const picked = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      const keys = await Promise.all(picked.map((f) => uploadToR2(f, 'fabrics')));
      setImages((x) => [...x, ...keys]);
    } catch (e) {
      toast('error', 'Upload failed', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.composition.trim()) { toast('error', 'Name and composition are required'); return; }
    if (images.length === 0) { toast('error', 'At least one swatch image is required'); return; }
    setSaving(true);
    const input: FabricInput = {
      name: form.name.trim(),
      color_name: form.color_name.trim() || null,
      composition: form.composition.trim(),
      weave: form.weave.trim() || null,
      finish: form.finish.trim() || null,
      weight_gsm: form.weight_gsm ? Number(form.weight_gsm) : null,
      origin: form.origin.trim() || null,
      supplier: form.supplier.trim() || null,
      price_per_meter: form.price_per_meter ? Number(form.price_per_meter) : null,
      care_instructions: form.care.split(',').map((x) => x.trim()).filter(Boolean),
      image_keys: images,
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

  const toggleActive = async (f: Fabric, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fabricsApi.setActive(f.id, !f.is_active);
      setFabrics((xs) => xs.map((x) => (x.id === f.id ? { ...x, is_active: !f.is_active } : x)));
    } catch (err) {
      toast('error', 'Update failed', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>Fabrics Master</h1>
        <Button variant="primary" onClick={openCreate}><UilPlus size={16} /> New fabric</Button>
      </div>

      <div className={base.filterBar}>
        <input className={base.searchInput} placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={base.filterSelect} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className={s.grid}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${s.card} ${s.cardSkeleton}`} />)}
        </div>
      ) : fabrics.length === 0 ? (
        <div className={s.empty}>No fabrics yet. Add your first SKU.</div>
      ) : (
        <div className={s.grid}>
          {fabrics.map((f) => {
            const url = swatchUrl(f.image_keys?.[0]);
            return (
              <div key={f.id} className={s.card} onClick={() => navigate(`/admin/procurement/fabrics/${f.id}`)}>
                <div className={s.swatch}>
                  {url ? <img src={url} alt={f.name} /> : <span className={s.swatchEmpty}>no swatch</span>}
                </div>
                <div className={s.body}>
                  <div className={s.name}>{f.name}</div>
                  <div className={s.code}>{f.code}{f.color_name ? ` · ${f.color_name}` : ''}</div>
                  <div className={s.meta}>{f.composition}{f.weave ? ` · ${f.weave}` : ''}</div>
                  <div className={s.foot}>
                    <span className={s.price}>{f.price_per_meter ? `₹${Number(f.price_per_meter).toLocaleString('en-IN')}/m` : '—'}</span>
                    <span
                      className={`${base.stagePill} ${f.is_active ? base.stageSuccess : base.stageNeutral}`}
                      onClick={(e) => toggleActive(f, e)}
                      style={{ cursor: 'pointer' }}
                    >
                      {f.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button className={s.editLink} onClick={(e) => { e.stopPropagation(); openEdit(f); }}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? `Edit fabric · ${editingCode}` : 'New fabric'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" state={saving ? 'loading' : 'default'} onClick={save}>{editingId ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div className={s.modalBody}>
          {/* Swatch upload (required) */}
          <div className={s.uploadSection}>
            <label className={s.uploadLabel}>Swatch images <span className={s.req}>· at least 1 (up to 4)</span></label>
            <div className={s.thumbs}>
              {images.map((k, i) => (
                <div key={k} className={s.thumb}>
                  <img src={swatchUrl(k)} alt={`swatch ${i + 1}`} />
                  {i === 0 && <span className={s.heroTag}>hero</span>}
                  <button className={s.thumbX} onClick={() => setImages((x) => x.filter((y) => y !== k))} type="button"><UilTimes size={12} /></button>
                </div>
              ))}
              {images.length < 4 && (
                <label className={s.uploadBox}>
                  {uploading ? <Spinner /> : <><UilImagePlus size={20} /><span>Upload</span></>}
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          {editingId ? null : <p className={s.codeNote}>Code is auto-generated (FAB-…) on save.</p>}

          <div className={s.formGrid}>
            <Input label="Name *" value={form.name} onChange={set('name')} placeholder="Indigo Denim" />
            <Input label="Colour" value={form.color_name} onChange={set('color_name')} placeholder="Indigo" />
            <Input label="Composition *" value={form.composition} onChange={set('composition')} placeholder="98% Cotton, 2% Elastane" />
            <Input label="Weave" value={form.weave} onChange={set('weave')} placeholder="twill" />
            <Input label="Finish" value={form.finish} onChange={set('finish')} placeholder="enzyme wash" />
            <Input label="GSM" type="number" value={form.weight_gsm} onChange={set('weight_gsm')} placeholder="320" />
            <Input label="Origin" value={form.origin} onChange={set('origin')} placeholder="Erode, Tamil Nadu" />
            <Input label="Supplier / mill" value={form.supplier} onChange={set('supplier')} placeholder="Arvind, Erode" />
            <Input label="Price / metre (₹)" type="number" value={form.price_per_meter} onChange={set('price_per_meter')} placeholder="250" />
            <Input label="Care (comma-separated)" value={form.care} onChange={set('care')} placeholder="Cold wash, Hang dry" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FabricsMasterPage;
