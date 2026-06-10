import React from 'react';
import { listingRequestsApi, designsApi, fabricsApi, hubsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { ListingRequest, DesignSummary, Fabric, Hub } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './ListingRequestsPage.module.css';
import { UilImage } from '@iconscout/react-unicons';

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');
const STATUS_LABELS: Record<string, string> = { requested: 'Requested', approved: 'Approved', rejected: 'Rejected' };
const STATUS_CSS: Record<string, string> = { requested: 'stageWarning', approved: 'stageSuccess', rejected: 'stageNeutral' };

export const ListingRequestsPage: React.FC<{ mode?: 'cm' | 'procurement' }> = ({ mode = 'procurement' }) => {
  const isProc = mode === 'procurement';
  const [rows, setRows] = React.useState<ListingRequest[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [actingId, setActingId] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // CM form
  const [fDesign, setFDesign] = React.useState('');
  const [fFabric, setFFabric] = React.useState('');
  const [fHub, setFHub] = React.useState('');
  const [fQty, setFQty] = React.useState('');
  const [fNote, setFNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    listingRequestsApi
      .list({ status: statusFilter || undefined })
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
    if (!isProc) {
      designsApi.list({ status: 'published' }).then(setDesigns).catch(() => {});
      fabricsApi.list({ active: true }).then(setFabrics).catch(() => {});
    }
  }, [isProc]);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';

  const decide = async (r: ListingRequest, decision: 'approved' | 'rejected') => {
    setActingId(r.id);
    try {
      const res = await listingRequestsApi.decide(r.id, decision);
      toast('success', `Request ${decision}`, decision === 'approved' && res.stocked_meters ? `${res.stocked_meters}m sent to ${hubName(r.hub_id)} stock.` : undefined);
      load();
    } catch (e) {
      toast('error', 'Action failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActingId('');
    }
  };

  const submit = async () => {
    if (!fDesign || !fFabric || !fHub || !fQty) { toast('error', 'Design, fabric, hub and metres are required'); return; }
    setSubmitting(true);
    try {
      await listingRequestsApi.create({ design_id: fDesign, fabric_id: fFabric, hub_id: fHub, qty: Number(fQty), note: fNote.trim() || undefined });
      toast('success', 'Requested', 'Procurement will review and send the fabric.');
      setFDesign(''); setFFabric(''); setFHub(''); setFQty(''); setFNote('');
      load();
    } catch (e) {
      toast('error', 'Request failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>{isProc ? 'Listing Requests' : 'Fabric for Listing'}</h1>
        <span className={base.pagination}>{loading ? '' : `${rows.filter((r) => r.status === 'requested').length} open · ${rows.length} total`}</span>
      </div>

      {/* CM: create a request */}
      {!isProc && (
        <section className={s.form}>
          <h3 className={s.formTitle}>Request a fabric to list</h3>
          <div className={s.formGrid}>
            <label className={s.field}>Design
              <select value={fDesign} onChange={(e) => setFDesign(e.target.value)}>
                <option value="">Select…</option>
                {designs.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.garment_type}</option>)}
              </select>
            </label>
            <label className={s.field}>Fabric
              <select value={fFabric} onChange={(e) => setFFabric(e.target.value)}>
                <option value="">Select…</option>
                {fabrics.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
              </select>
            </label>
            <label className={s.field}>Hub
              <select value={fHub} onChange={(e) => setFHub(e.target.value)}>
                <option value="">Select…</option>
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <Input label="Metres" type="number" value={fQty} onChange={setFQty} placeholder="e.g. 30" />
          </div>
          <Input label="Note (optional)" value={fNote} onChange={setFNote} placeholder="Sample approved — ready to list" />
          <div className={s.formActions}>
            <Button variant="primary" state={submitting ? 'loading' : 'default'} onClick={submit}>Send request</Button>
          </div>
        </section>
      )}

      <div className={base.filterBar}>
        <select className={base.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Procurement: fabric product-cards to approve. CM: list of their requests. */}
      {loading ? (
        <div className={s.cardGrid}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${s.card} ${s.cardSkeleton}`} />)}</div>
      ) : rows.length === 0 ? (
        <div className={s.empty}>{isProc ? 'No listing requests yet.' : 'No requests yet — send one above.'}</div>
      ) : (
        <div className={s.cardGrid}>
          {rows.map((r) => {
            const img = swatch(r.fabric_image_keys);
            const busy = actingId === r.id;
            return (
              <div key={r.id} className={s.card}>
                <div className={s.cardSwatch}>{img ? <img src={img} alt={r.fabric_name} /> : <UilImage size={26} />}</div>
                <div className={s.cardBody}>
                  <div className={s.cardCode}>{r.fabric_code}{r.fabric_color ? ` · ${r.fabric_color}` : ''}</div>
                  <div className={s.cardFabric}>{r.fabric_name}</div>
                  {r.fabric_composition && <div className={s.cardComp}>{r.fabric_composition}</div>}
                  <div className={s.cardMeta}>For <strong>{r.design_name}</strong> ({r.garment_type})</div>
                  <div className={s.cardMeta}>To <strong>{hubName(r.hub_id) !== '—' ? hubName(r.hub_id) : r.hub_name}</strong> · {Number(r.qty)}m</div>
                  {r.note && <div className={s.cardNote}>“{r.note}”</div>}
                  <div className={s.cardFoot}>
                    <span className={`${base.stagePill} ${base[STATUS_CSS[r.status] ?? 'stageNeutral']}`}>{STATUS_LABELS[r.status] ?? r.status}</span>
                    {isProc && r.status === 'requested' && (
                      <div className={s.cardActions}>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => decide(r, 'rejected')}>Reject</Button>
                        <Button variant="primary" size="sm" disabled={busy} onClick={() => decide(r, 'approved')}>Approve &amp; send</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ListingRequestsPage;
