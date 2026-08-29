import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fabricsApi, uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import type { ReorderCoverage, FabricFieldVisibility } from '../../api/adminApi';
import type { Fabric, FabricInput } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './FabricsMasterPage.module.css';
import kpi from './CodReconciliationPage.module.css';
import { UilPlus, UilTimes, UilImagePlus, UilImage, UilTrashAlt, UilAngleUp, UilAngleDown } from '@iconscout/react-unicons';
import { StatusBadge, Select, CopyId, MoneyCell } from '../../components';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const swatchUrl = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

// [PRC-14-11] "No swatch on file" and "the stored key doesn't resolve" produced the exact
// same placeholder tile. A swatch is REQUIRED at create (`min(1)`), so an empty tile on a
// fabric master almost always means the key is broken, not that nobody uploaded one — and
// for a fabric, the swatch is half the identity. The two states are different problems with
// different owners: one is a missing upload, the other is a storage or CDN fault.
type SwatchState = 'ok' | 'none-on-file' | 'unreachable';
const swatchState = (
  keys: string[] | null | undefined,
  url: string,
  isBroken: boolean,
): SwatchState => {
  if (!keys?.length) return 'none-on-file';
  // A key exists but no public base URL is configured, or the image failed to load.
  if (!url || isBroken) return 'unreachable';
  return 'ok';
};
const SWATCH_TITLE: Record<SwatchState, string> = {
  ok: '',
  'none-on-file': 'No swatch uploaded for this fabric',
  unreachable: 'A swatch is on file but its image could not be loaded — the key may be broken or storage unreachable',
};

const EMPTY = { name: '', color_name: '', composition: '', weave: '', finish: '', weight_gsm: '', width_cm: '', origin: '', supplier: '', supplier_city: '', supplier_lead_time: '', supplier_moq: '', supplier_phone: '', supplier_email: '', supplier_gstin: '', price_per_meter: '', care: '', fabric_type: 'woven', stretch_pct: '', shrinkage_pct: '' };
type Form = typeof EMPTY;

export const FabricsMasterPage: React.FC<{ mode?: 'procurement' | 'design' }> = ({ mode = 'procurement' }) => {
  const navigate = useNavigate();
  const readOnly = mode === 'design';
  const basePath = readOnly ? '/admin/design/fabrics' : '/admin/procurement/fabrics';
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('');
  const [lowOnly, setLowOnly] = React.useState(false); // "Low somewhere" (procurement)
  // [PRC-14-4] How many shelf positions have a reorder point at all — the denominator
  // the "Below reorder" count needs before it means anything.
  const [coverage, setCoverage] = React.useState<ReorderCoverage | null>(null);
  // [PRC-14-6] Which commercial columns the server sent. A masked supplier must not read
  // as an absent one — this page's whole job is knowing who to call to buy more cloth.
  const [fieldVis, setFieldVis] = React.useState<FabricFieldVisibility | null>(null);
  // sort (procurement table) + client-side pagination
  const [sortKey, setSortKey] = React.useState<'name' | 'total_available' | 'stock_value' | 'price_per_meter'>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 25;
  // guarded delete
  const [delTarget, setDelTarget] = React.useState<Fabric | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  // post-create handoff to Central Stock (receiving is Central Stock's job, not the catalog's)
  const [justCreated, setJustCreated] = React.useState<{ id: string; code: string } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingCode, setEditingCode] = React.useState('');
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [images, setImages] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [broken, setBroken] = React.useState<Set<string>>(new Set());
  const markBroken = (id: string) => setBroken((b) => (b.has(id) ? b : new Set(b).add(id)));

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    fabricsApi
      .listWithCoverage({ q: search || undefined, active: activeFilter === '' ? undefined : activeFilter === 'true', low: lowOnly || undefined })
      .then((r) => {
        setFabrics(r.data);
        setCoverage(r.meta?.reorder_coverage ?? null);
        setFieldVis(r.meta?.fabric_fields_visible ?? null);
      })
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [search, activeFilter, lowOnly]);

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
      width_cm: f.width_cm != null ? String(f.width_cm) : '',
      origin: f.origin ?? '', supplier: f.supplier ?? '',
      supplier_city: f.supplier_city ?? '',
      supplier_lead_time: f.supplier_lead_time_days != null ? String(f.supplier_lead_time_days) : '',
      supplier_moq: f.supplier_moq_note ?? '',
      supplier_phone: f.supplier_phone ?? '',
      supplier_email: f.supplier_email ?? '',
      supplier_gstin: f.supplier_gstin ?? '',
      price_per_meter: f.price_per_meter ?? '',
      care: (f.care_instructions ?? []).join(', '),
      fabric_type: f.fabric_type ?? 'woven',
      stretch_pct: f.stretch_pct != null ? String(f.stretch_pct) : '',
      shrinkage_pct: f.shrinkage_pct != null ? String(f.shrinkage_pct) : '',
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
      width_cm: form.width_cm ? Number(form.width_cm) : null,
      origin: form.origin.trim() || null,
      supplier: form.supplier.trim() || null,
      supplier_city: form.supplier_city.trim() || null,
      supplier_lead_time_days: form.supplier_lead_time ? Number(form.supplier_lead_time) : null,
      supplier_moq_note: form.supplier_moq.trim() || null,
      supplier_phone: form.supplier_phone.trim() || null,
      supplier_email: form.supplier_email.trim() || null,
      supplier_gstin: form.supplier_gstin.trim() || null,
      price_per_meter: form.price_per_meter ? Number(form.price_per_meter) : null,
      fabric_type: form.fabric_type || 'woven',
      stretch_pct: form.stretch_pct ? Number(form.stretch_pct) : 0,
      shrinkage_pct: form.shrinkage_pct ? Number(form.shrinkage_pct) : 0,
      care_instructions: form.care.split(',').map((x) => x.trim()).filter(Boolean),
      image_keys: images,
    };
    try {
      if (editingId) {
        await fabricsApi.update(editingId, input);
        toast('success', 'Fabric updated');
        setOpen(false);
        load();
      } else {
        // Fabrics Master owns the SKU/identity only (mints FAB-NNNNN). Receiving stock
        // is Central Stock's job — so we hand off there rather than transacting inventory
        // on the catalog page.
        const created = await fabricsApi.create(input);
        toast('success', `Created ${created.code}`);
        setOpen(false);
        load();
        setJustCreated({ id: created.id, code: created.code });
      }
    } catch (e) {
      toast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  // G-9: deactivating an in-use fabric 409s with the blast radius; the operator
  // must read it and confirm before we retry with force.
  const [forceTarget, setForceTarget] = React.useState<{ fabric: Fabric; blast: string } | null>(null);
  const [forceCode, setForceCode] = React.useState(''); // G-9: type the code to confirm
  const [forcing, setForcing] = React.useState(false);
  const closeForce = () => { setForceTarget(null); setForceCode(''); };

  const toggleActive = async (f: Fabric, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fabricsApi.setActive(f.id, !f.is_active);
      setFabrics((xs) => xs.map((x) => (x.id === f.id ? { ...x, is_active: !f.is_active } : x)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const status = (err as { status?: number }).status;
      // Deactivating an in-use fabric → backend 409 FABRIC_IN_USE with the blast radius.
      // Key off the HTTP status (robust), not the message text.
      if (f.is_active && status === 409) {
        setForceTarget({ fabric: f, blast: msg });
      } else {
        toast('error', 'Update failed', msg || undefined);
      }
    }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await fabricsApi.remove(delTarget.id);
      setFabrics((xs) => xs.filter((x) => x.id !== delTarget.id));
      toast('success', `Deleted ${delTarget.code}`);
      setDelTarget(null);
    } catch (err) {
      // 409 = referenced somewhere → can't hard-delete; tell them to deactivate.
      toast('error', "Can't delete", err instanceof Error ? err.message : undefined);
      setDelTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const forceDeactivate = async () => {
    if (!forceTarget) return;
    setForcing(true);
    try {
      await fabricsApi.setActive(forceTarget.fabric.id, false, true);
      setFabrics((xs) => xs.map((x) => (x.id === forceTarget.fabric.id ? { ...x, is_active: false } : x)));
      toast('success', 'Fabric deactivated', 'Its live listings are now unservable — review them.');
      closeForce();
    } catch (err) {
      toast('error', 'Deactivate failed', err instanceof Error ? err.message : undefined);
    } finally {
      setForcing(false);
    }
  };

  // procurement table: client-side sort + pagination
  const sorted = React.useMemo(() => {
    const arr = [...fabrics];
    arr.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortKey === 'total_available') { av = a.total_available ?? 0; bv = b.total_available ?? 0; }
      else if (sortKey === 'stock_value') { av = a.stock_value ?? 0; bv = b.stock_value ?? 0; }
      else { av = Number(a.price_per_meter ?? 0); bv = Number(b.price_per_meter ?? 0); }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [fabrics, sortKey, sortDir]);
  // Summary rollup (reflects the current filter set, matching the row count).
  const totalStock = fabrics.reduce((sum, f) => sum + (f.total_available ?? 0), 0);
  const capital = fabrics.reduce((sum, f) => sum + (f.stock_value ?? 0), 0);
  const lowCount = fabrics.filter((f) => f.low_somewhere).length;
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
    setPage(0);
  };
  const sortIcon = (k: typeof sortKey) =>
    sortKey !== k ? null : sortDir === 'asc' ? <UilAngleUp size={14} /> : <UilAngleDown size={14} />;
  React.useEffect(() => { setPage(0); }, [search, activeFilter, lowOnly]);

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={base.pageHeader}>
        <div>
          <h1 className={base.title}>{readOnly ? 'Fabrics' : 'Fabrics Master'}</h1>
          <p className={base.subtitle}>
            {readOnly
              ? 'The fabric library you pair with designs. Open a fabric to see its specs, hub stock, and request a sample.'
              : 'Every fabric SKU the brand stocks — add, edit, distribute to hubs, and retire. Stock totals roll up from all hubs.'}
          </p>
        </div>
        {!readOnly && <Button variant="primary" onClick={openCreate}><UilPlus size={16} /> New fabric</Button>}
      </div>

      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${base.filterSelect} ${s.status}`} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {!readOnly && (
          <button
            type="button"
            className={`${s.lowChip} ${lowOnly ? s.lowChipActive : ''}`}
            onClick={() => setLowOnly((v) => !v)}
            title={
              coverage && coverage.with_reorder_point === 0
                ? 'No hub has a reorder point set, so this filter can only return nothing'
                : 'Fabrics below their reorder point at some hub'
            }
            disabled={!!coverage && coverage.with_reorder_point === 0}
          >
            Low somewhere
          </button>
        )}
        {!loading && <span className={s.count}>{fabrics.length} fabric{fabrics.length === 1 ? '' : 's'}</span>}
      </div>

      {!readOnly && !loading && fabrics.length > 0 && (
        <div className={kpi.summary}>
          <div className={kpi.summaryCard}>
            <div className={kpi.summaryLabel}>Fabrics</div>
            <div className={kpi.summaryValue}>{fabrics.length}</div>
          </div>
          <div className={kpi.summaryCard}>
            <div className={kpi.summaryLabel}>Total stock</div>
            <div className={kpi.summaryValue}>{totalStock.toLocaleString('en-IN')}m</div>
          </div>
          <div className={kpi.summaryCard}>
            <div className={kpi.summaryLabel}>Capital in stock</div>
            <div className={kpi.summaryValue}>₹{capital.toLocaleString('en-IN')}</div>
          </div>
          {/* [PRC-14-4] A reorder point is optional and almost nobody sets one, so this card
              used to render a calm green 0 whether nothing was low or nothing was watched.
              With no thresholds set anywhere the count cannot mean anything, and says so. */}
          <div className={kpi.summaryCard}>
            <div className={kpi.summaryLabel}>Below reorder</div>
            {coverage && coverage.with_reorder_point === 0 ? (
              <>
                <div className={kpi.summaryValue}>—</div>
                <div className={s.kpiNote}>
                  no reorder point set on any of {coverage.total_positions} shelf position
                  {coverage.total_positions === 1 ? '' : 's'}
                </div>
              </>
            ) : (
              <>
                <div className={`${kpi.summaryValue} ${lowCount ? s.stockLow : ''}`}>{lowCount}</div>
                {coverage && coverage.with_reorder_point < coverage.total_positions && (
                  <div className={s.kpiNote}>
                    watching {coverage.with_reorder_point} of {coverage.total_positions} shelf
                    positions
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {loading && readOnly ? (
        <div className={s.grid}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${s.card} ${s.cardSkeleton}`} />)}
        </div>
      ) : fabrics.length === 0 && !loading ? (
        <div className={s.empty}>
          {lowOnly ? 'No fabrics are below their reorder point. ✓' : 'No fabrics yet. Add your first SKU.'}
        </div>
      ) : readOnly ? (
        /* Design: visual card browse */
        <div className={s.grid}>
          {fabrics.map((f) => {
            const url = swatchUrl(f.image_keys?.[0]);
            return (
              <div key={f.id} className={s.card} onClick={() => navigate(`${basePath}/${f.id}`)}>
                <div className={s.swatch}>
                  {(() => {
                    const st = swatchState(f.image_keys, url, broken.has(f.id));
                    return st === 'ok' ? (
                      <img src={url} alt={f.name} onError={() => markBroken(f.id)} />
                    ) : (
                      <span
                        className={`${s.swatchEmpty} ${st === 'unreachable' ? s.swatchBroken : ''}`}
                        title={SWATCH_TITLE[st]}
                      >
                        <UilImage size={20} />
                        <span className={s.swatchNote}>
                          {st === 'unreachable' ? 'image unreachable' : 'no swatch'}
                        </span>
                      </span>
                    );
                  })()}
                </div>
                <div className={s.body}>
                  <div className={s.name}>{f.name}</div>
                  <div className={s.code}>{f.code}{f.color_name ? ` · ${f.color_name}` : ''}</div>
                  <div className={s.meta}>{f.composition}{f.weave ? ` · ${f.weave}` : ''}</div>
                  <div className={s.foot}>
                    {/* [PRC-14-6] Design holds neither distribution:write nor catalog:write,
                        so the server does not send ₹/m here. A bare "—" would say the fabric
                        has no price; it has one, and this role is not the one that sets or
                        spends against it. */}
                    <span className={s.price}>
                      {fieldVis && !fieldVis.price
                        ? 'cost restricted'
                        : f.price_per_meter
                          ? `₹${Number(f.price_per_meter).toLocaleString('en-IN')}/m`
                          : '—'}
                    </span>
                    <StatusBadge status={f.is_active ? 'active' : 'inactive'} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Procurement: stock-aware master table */
        <>
        <div className={base.tableWrap}>
          <table className={base.table}>
            <thead>
              <tr>
                <th><button className={s.sortHead} onClick={() => toggleSort('name')}>Fabric {sortIcon('name')}</button></th>
                <th>Code</th><th>Composition</th><th>Supplier</th>
                <th><button className={s.sortHead} onClick={() => toggleSort('price_per_meter')}>₹/m {sortIcon('price_per_meter')}</button></th>
                <th><button className={s.sortHead} onClick={() => toggleSort('total_available')}>Total stock {sortIcon('total_available')}</button></th>
                <th><button className={s.sortHead} onClick={() => toggleSort('stock_value')}>Value {sortIcon('stock_value')}</button></th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((__, j) => <td key={j}><div className={base.skeleton} /></td>)}</tr>
                ))
              ) : (
                pageRows.map((f) => {
                  const url = swatchUrl(f.image_keys?.[0]);
                  return (
                    <tr key={f.id} className={base.row} {...rowActivation(() => navigate(`${basePath}/${f.id}`))}>
                      <td>
                        <div className={base.fabricCell}>
                          {(() => {
                            const st = swatchState(f.image_keys, url, broken.has(f.id));
                            return st === 'ok' ? (
                              <img className={base.swatchThumb} src={url} alt="" onError={() => markBroken(f.id)} />
                            ) : (
                              <span
                                className={`${base.swatchThumb} ${st === 'unreachable' ? s.swatchBroken : ''}`}
                                title={SWATCH_TITLE[st]}
                              >
                                <UilImage size={16} />
                              </span>
                            );
                          })()}
                          <span>{f.name}{f.color_name ? ` · ${f.color_name}` : ''}</span>
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}><CopyId value={f.code} /></td>
                      <td>{f.composition}</td>
                      <td>
                        {/* [PRC-14-6] Restricted ≠ missing. The server omits these fields for
                            roles that may not see them, and a bare "—" would claim the mill
                            has no name on file. */}
                        {fieldVis && !fieldVis.supplier ? (
                          <div className={s.subtle} title="Supplier identity is visible to procurement and finance">
                            restricted
                          </div>
                        ) : (
                          <>
                            <div>{f.supplier ?? '—'}{f.supplier_city ? ` · ${f.supplier_city}` : ''}</div>
                            {f.supplier_lead_time_days != null && (
                              <div className={s.subtle}>{f.supplier_lead_time_days}d lead</div>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        {fieldVis && !fieldVis.price ? (
                          <span className={s.subtle} title="Cost is visible to procurement, finance and catalog">
                            restricted
                          </span>
                        ) : f.price_per_meter ? (
                          `₹${Number(f.price_per_meter).toLocaleString('en-IN')}`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={f.low_somewhere ? s.stockLow : undefined}>
                        {(f.total_available ?? 0).toLocaleString('en-IN')}m
                        {f.low_somewhere && <span className={s.lowTag}>low</span>}
                        {/* [PRC-14-4] Stock on the shelf and no threshold anywhere: this row
                            can never show "low", so its silence means nothing. Say so, and
                            point at the page that fixes it (the row already opens the PDP). */}
                        {!f.low_somewhere && !f.watched_somewhere && (f.total_available ?? 0) > 0 && (
                          <span
                            className={s.unwatchedTag}
                            title="No hub has a reorder point for this fabric, so it can never be flagged low. Open the fabric to set one."
                          >
                            unwatched
                          </span>
                        )}
                      </td>
                      <td><MoneyCell amount={f.stock_value ?? null} /></td>
                      <td><StatusBadge status={f.is_active ? 'active' : 'inactive'} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className={s.rowActions}>
                          <button className={s.editLink} onClick={() => openEdit(f)}>Edit</button>
                          <button className={s.editLink} onClick={(e) => toggleActive(f, e)}>
                            {f.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                          <button
                            className={s.delBtn}
                            title="Delete fabric (only if unused)"
                            onClick={() => setDelTarget(f)}
                          >
                            <UilTrashAlt size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className={base.pageButtons}>
            <button className={base.pageBtn} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className={base.pageIndicator}>Page {page + 1} of {pageCount}</span>
            <button className={base.pageBtn} disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
        </>
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
            <Input label="Width (cm)" type="number" value={form.width_cm} onChange={set('width_cm')} placeholder="112 (44″) · 150 (58″)" />
            <Input label="Origin" value={form.origin} onChange={set('origin')} placeholder="Erode, Tamil Nadu" />
            <Input label="Supplier / mill" value={form.supplier} onChange={set('supplier')} placeholder="Arvind" />
            <Input label="Supplier city" value={form.supplier_city} onChange={set('supplier_city')} placeholder="Erode" />
            <Input label="Lead time (days)" type="number" value={form.supplier_lead_time} onChange={set('supplier_lead_time')} placeholder="14" />
            <Input label="MOQ note" value={form.supplier_moq} onChange={set('supplier_moq')} placeholder="e.g. 50 m minimum" />
            {/* T3-4 (W-P1): the contacts a buyer reaches for at "below reorder". */}
            <Input label="Supplier phone" value={form.supplier_phone} onChange={set('supplier_phone')} placeholder="+91 98765 43210" />
            <Input label="Supplier email" type="email" value={form.supplier_email} onChange={set('supplier_email')} placeholder="sales@arvind.com" />
            <Input label="Supplier GSTIN" value={form.supplier_gstin} onChange={set('supplier_gstin')} placeholder="24AAACA1234A1Z5" />
            <Input label="Price / metre (₹)" type="number" value={form.price_per_meter} onChange={set('price_per_meter')} placeholder="250" />
            <Input label="Care (comma-separated)" value={form.care} onChange={set('care')} placeholder="Cold wash, Hang dry" />
            <Select
              label="Fabric type (fit)"
              value={form.fabric_type}
              onChange={set('fabric_type')}
              options={[
                { label: 'Woven (rigid)', value: 'woven' },
                { label: 'Stretch woven', value: 'stretch_woven' },
                { label: 'Knit', value: 'knit' },
              ]}
            />
            <Input label="Stretch %" type="number" value={form.stretch_pct} onChange={set('stretch_pct')} placeholder="0 = rigid · 30 = stretch denim" />
            <Input label="Shrinkage %" type="number" value={form.shrinkage_pct} onChange={set('shrinkage_pct')} placeholder="cotton ≈ 3–5" />
          </div>
          {!editingId && (
            <p className={s.codeNote}>
              This creates the fabric SKU + its code. To put metres in inventory, you'll receive it in <strong>Central Stock</strong> next.
            </p>
          )}
        </div>
      </Modal>

      {/* Post-create handoff — receiving lives on Central Stock, so offer the jump there. */}
      <Modal
        open={!!justCreated}
        onClose={() => setJustCreated(null)}
        title={`Created ${justCreated?.code ?? 'fabric'}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setJustCreated(null)}>Later</Button>
            <Button variant="primary" onClick={() => navigate(`/admin/procurement/central-stock?receive=${justCreated?.id}`)}>
              Receive stock →
            </Button>
          </>
        }
      >
        <div className={s.modalBody}>
          <p className={s.codeNote}>
            The SKU and its code are created. It has <strong>no stock</strong> yet — record the metres you bought in
            <strong> Central Stock</strong> to put it in inventory (or do it later).
          </p>
        </div>
      </Modal>

      {/* Guarded delete — server blocks (409) if the fabric is referenced anywhere. */}
      <Modal
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title={`Delete ${delTarget?.code ?? 'fabric'}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDelTarget(null)}>Cancel</Button>
            <Button variant="danger" state={deleting ? 'loading' : 'default'} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <div className={s.modalBody}>
          <p className={s.codeNote}>
            Permanently removes <strong>{delTarget?.name}</strong> ({delTarget?.code}). This only works
            if no design, listing, hub stock, or restock request references it — otherwise deactivate it instead.
          </p>
        </div>
      </Modal>

      {/* G-9: blast-radius confirm + type-the-code friction before force-deactivating an in-use fabric */}
      <Modal
        open={!!forceTarget}
        onClose={closeForce}
        title={`Deactivate ${forceTarget?.fabric.name ?? 'fabric'}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeForce}>Cancel</Button>
            <Button
              variant="primary"
              state={forcing ? 'loading' : 'default'}
              disabled={forceCode.trim() !== forceTarget?.fabric.code}
              onClick={forceDeactivate}
            >
              Deactivate anyway
            </Button>
          </>
        }
      >
        <div className={s.modalBody}>
          <p className={s.codeNote}>
            {forceTarget?.blast} This can't be undone from here without re-activating the fabric.
          </p>
          <Input
            label={`Type the code ${forceTarget?.fabric.code ?? ''} to confirm`}
            value={forceCode}
            onChange={setForceCode}
            placeholder={forceTarget?.fabric.code}
          />
        </div>
      </Modal>
    </div>
  );
};

export default FabricsMasterPage;
