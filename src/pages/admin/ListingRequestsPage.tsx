import React from 'react';
import { useHubContextFilter } from '../../utils/useHubContextFilter'; // [SHL-3-8]
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listingRequestsApi, designsApi, fabricsApi, hubsApi, adminAuthExtApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { ListingRequest, DesignSummary, Fabric, Hub } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge, PageHeader, EmptyState, NoHubAssigned } from '../../components';
import { AgeCell } from '../../components/DataCells';
import base from './OrdersListPage.module.css';
import ds from './DistributionPage.module.css';
import s from './ListingRequestsPage.module.css';
import { UilImage } from '@iconscout/react-unicons';

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');
// Domain wording for the restock-into-listing flow. Tone from the shared vocab key; label override keeps the phrasing.
const PILL: Record<string, { key: string; label: string }> = {
  requested: { key: 'requested', label: 'Requested' },
  approved: { key: 'in_transit', label: 'Sent · in transit' },
  received: { key: 'received', label: 'Received · in stock' },
  rejected: { key: 'rejected', label: 'Rejected' },
  cancelled: { key: 'cancelled', label: 'Withdrawn' },
};

type ConfirmState = { title: string; message: React.ReactNode; label: string; variant?: 'primary' | 'danger'; run: () => Promise<void> };

export const ListingRequestsPage: React.FC<{ mode?: 'cm' | 'procurement' }> = ({ mode = 'procurement' }) => {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const isProc = mode === 'procurement';

  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try { await confirm.run(); } finally { setConfirming(false); setConfirm(null); }
  };

  const [rows, setRows] = React.useState<ListingRequest[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [loading, setLoading] = React.useState(true);
  // [SHL-3-8] Defaults to the header hub switcher and follows it. Was React.useState(''),
  // so the global control changed nothing on this page while claiming to.
  const [hubFilter, setHubFilter] = useHubContextFilter();
  const [actingId, setActingId] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // CM form (hub locked to the signed-in CM's own hub)
  const [myHubId, setMyHubId] = React.useState<string | null>(null);
  const [hubResolved, setHubResolved] = React.useState(false); // T2-38: me() has answered
  const [fDesign, setFDesign] = React.useState('');
  const [fFabric, setFFabric] = React.useState('');
  const [fQty, setFQty] = React.useState('');
  const [fNote, setFNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // decline-with-reason modal (procurement)
  const [rejectTarget, setRejectTarget] = React.useState<ListingRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [rejecting, setRejecting] = React.useState(false);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    listingRequestsApi
      .list({ hub_id: hubFilter || undefined })
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
    if (!isProc) {
      designsApi.list({ status: 'published' }).then(setDesigns).catch(() => {});
      fabricsApi.list({ active: true }).then(setFabrics).catch(() => {});
      adminAuthExtApi.me()
        .then((m) => setMyHubId(m.hubId ?? null))
        .catch(() => {})
        .finally(() => setHubResolved(true));
    }
  }, [isProc]);

  // Prefill from the origin context (SampleVerification "ready to list": ?design=&fabric=).
  React.useEffect(() => {
    if (isProc) return;
    const d = sp.get('design'); const f = sp.get('fabric');
    if (d) setFDesign(d);
    if (f) setFFabric(f);
  }, [isProc, sp]);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';
  const myHubName = myHubId ? hubName(myHubId) : '';

  const decide = async (r: ListingRequest, decision: 'approved' | 'rejected') => {
    setActingId(r.id);
    try {
      await listingRequestsApi.decide(r.id, decision);
      toast('success', decision === 'approved' ? 'Approved & sent' : 'Rejected', decision === 'approved' ? 'Confirm receipt once it reaches the hub.' : undefined);
      load();
    } catch (e) {
      toast('error', 'Action failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActingId('');
    }
  };

  const doReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await listingRequestsApi.decide(rejectTarget.id, 'rejected', rejectReason.trim() || undefined);
      toast('success', 'Rejected', 'The catalog manager has been told why.');
      setRejectTarget(null); setRejectReason('');
      load();
    } catch (e) {
      toast('error', 'Action failed', e instanceof Error ? e.message : undefined);
    } finally {
      setRejecting(false);
    }
  };

  const receive = async (r: ListingRequest) => {
    setActingId(r.id);
    try {
      const res = await listingRequestsApi.receive(r.id);
      toast('success', 'Received at hub', res.stocked_meters ? `${res.stocked_meters}m landed in ${hubName(r.hub_id)} stock.` : undefined);
      load();
    } catch (e) {
      toast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActingId('');
    }
  };

  const withdraw = async (r: ListingRequest) => {
    setActingId(r.id);
    try {
      await listingRequestsApi.cancel(r.id);
      toast('success', 'Request withdrawn');
      load();
    } catch (e) {
      toast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActingId('');
    }
  };

  const submit = async () => {
    if (!fDesign || !fFabric || !myHubId || !fQty || Number(fQty) <= 0) { toast('error', 'Design, fabric and metres are required'); return; }
    setSubmitting(true);
    try {
      await listingRequestsApi.create({ design_id: fDesign, fabric_id: fFabric, hub_id: myHubId, qty: Number(fQty), note: fNote.trim() || undefined });
      toast('success', 'Requested', 'Procurement will review and send the fabric.');
      setFDesign(''); setFFabric(''); setFQty(''); setFNote('');
      load();
    } catch (e) {
      toast('error', 'Request failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  // G-10: a sample for this design+fabric must be reviewed/approved before listing.
  const sampleChip = (st?: string | null) => {
    if (!st) return <span className={`${s.sampleChip} ${s.sampleNone}`}>No sample yet</span>;
    const ok = st === 'reviewed' || st === 'approved';
    const dead = st === 'rejected' || st === 'cancelled';
    const cls = ok ? s.sampleOk : dead ? s.sampleNone : s.samplePending;
    return <span className={`${s.sampleChip} ${cls}`}>{ok ? 'Sample reviewed ✓' : `Sample: ${st.replace(/_/g, ' ')}`}</span>;
  };

  const card = (r: ListingRequest) => {
    const img = swatch(r.fabric_image_keys);
    const busy = actingId === r.id;
    return (
      <div
        key={r.id}
        className={`${s.card} ${isProc ? s.clickCard : ''}`}
        onClick={isProc ? () => navigate(`/admin/procurement/track/${r.hub_id}/${r.fabric_id}`) : undefined}
      >
        <div className={s.cardSwatch}>{img ? <img src={img} alt={r.fabric_name} /> : <UilImage size={26} />}</div>
        <div className={s.cardBody}>
          <div className={s.cardTop}>
            <span className={s.cardCode}>{r.fabric_code}{r.fabric_color ? ` · ${r.fabric_color}` : ''}</span>
            <StatusBadge status={PILL[r.status]?.key ?? r.status} label={PILL[r.status]?.label} />
          </div>
          <div className={s.cardFabric}>{r.fabric_name}</div>
          {r.fabric_composition && <div className={s.cardComp}>{r.fabric_composition}</div>}
          <div className={s.cardMeta}>For <strong>{r.design_name}</strong> ({r.garment_type})</div>
          <div className={s.cardMeta}>To <strong>{r.hub_name}</strong> · {Number(r.qty)}m · <span className={s.cardAge}><AgeCell since={r.created_at} warnAfterH={72} alertAfterH={168} /></span></div>
          {sampleChip(r.sample_status)}
          {r.note && <div className={s.cardNote}>“{r.note}”</div>}
          {r.status === 'rejected' && r.decision_note && <div className={s.decisionNote}>Rejected: {r.decision_note}</div>}
          {isProc && r.status === 'requested' && (
            <div className={s.cardFoot} onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setRejectTarget(r); setRejectReason(''); }}>Reject</Button>
              <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirm({
                title: 'Approve & send?', label: 'Approve & send',
                message: <>Approve and send <strong>{Number(r.qty)}m</strong> of <strong>{r.fabric_name}</strong> ({r.fabric_code}) to <strong>{r.hub_name}</strong>? Draws from central on receipt; shows <em>in transit</em> until you confirm.</>,
                run: () => decide(r, 'approved'),
              })}>Approve &amp; send</Button>
            </div>
          )}
          {isProc && r.status === 'approved' && (
            <div className={s.cardFoot} onClick={(e) => e.stopPropagation()}>
              <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirm({
                title: 'Mark received?', label: 'Yes, it arrived',
                message: <>Confirm <strong>{Number(r.qty)}m</strong> of <strong>{r.fabric_name}</strong> ({r.fabric_code}) physically arrived at <strong>{r.hub_name}</strong>. This draws from central stock, lands it at the hub, and can't be undone.</>,
                run: () => receive(r),
              })}>Mark received</Button>
            </div>
          )}
          {!isProc && r.status === 'requested' && (
            <div className={s.cardFoot} onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm({
                title: 'Withdraw this request?', label: 'Withdraw', variant: 'danger',
                message: <>Withdraw your request for <strong>{r.fabric_name}</strong> ({r.fabric_code})?</>,
                run: () => withdraw(r),
              })}>Withdraw</Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const pending = rows.filter((r) => r.status === 'requested');
  const transit = rows.filter((r) => r.status === 'approved');
  const received = rows.filter((r) => r.status === 'received');
  const closed = rows.filter((r) => r.status === 'rejected' || r.status === 'cancelled');

  const section = (title: string, list: ListingRequest[]) =>
    list.length === 0 ? null : (
      <section className={ds.section}>
        <h2 className={ds.sectionTitle}>{title} <span className={ds.count}>{list.length}</span></h2>
        <div className={s.cardGrid}>{list.map(card)}</div>
      </section>
    );

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow={isProc ? 'Procurement · Supply' : 'Catalog · Stock'}
        title={isProc ? 'Listing Requests' : 'Fabric for Listing'}
        subtitle={isProc
          ? 'A catalog manager wants fabric to list — approve & send from central, then confirm it lands at the hub.'
          : 'Ask procurement for the fabric you need to list an approved sample. Track each request to in-stock.'}
        meta={!loading && <span className={s.cardAge}>{pending.length} open · {rows.length} total</span>}
      />

      {/* T2-38 (PR-5): a hub-less CM can't raise listing requests (hub-scoped) — dead-end honestly. */}
      {!isProc && hubResolved && !myHubId && <NoHubAssigned action="raise listing requests" />}
      {/* CM: create a request */}
      {!isProc && (!hubResolved || myHubId) && (
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
              <span className={s.lockedHub} title="You can only request for your own hub">{myHubName || 'your hub'}</span>
            </label>
            <Input label="Metres" type="number" value={fQty} onChange={setFQty} placeholder="e.g. 30" />
          </div>
          <Input label="Note (optional)" value={fNote} onChange={setFNote} placeholder="Sample approved — ready to list" />
          <div className={s.formActions}>
            <Button variant="primary" state={submitting ? 'loading' : 'default'} disabled={!myHubId} onClick={submit}>Send request</Button>
          </div>
        </section>
      )}

      {isProc && (
        <div className={ds.toolbar}>
          <select className={ds.hubSel} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
            <option value="">All hubs</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className={s.cardGrid}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${s.card} ${s.cardSkeleton}`} />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title={isProc ? 'No listing requests yet' : 'No requests yet'} body={isProc ? 'Requests from catalog managers will appear here to approve & send.' : 'Use the form above to ask procurement for fabric to list.'} />
      ) : (
        <>
          {section('Pending', pending)}
          {section('In transit', transit)}
          {section('Received', received)}
          {section(isProc ? 'Rejected' : 'Closed', closed)}
        </>
      )}

      <Modal
        open={rejectTarget !== null}
        onClose={() => !rejecting && setRejectTarget(null)}
        title="Reject this request"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)} disabled={rejecting}>Cancel</Button>
            <Button variant="danger" state={rejecting ? 'loading' : 'default'} onClick={doReject}>Reject request</Button>
          </>
        }
      >
        {rejectTarget && (
          <div className={base.modalStack}>
            <p className={base.fabricCellCode}>
              {rejectTarget.fabric_name} ({rejectTarget.fabric_code}) · for {rejectTarget.design_name} → {rejectTarget.hub_name}
            </p>
            <Input label="Reason (shared with the catalog manager)" value={rejectReason} onChange={setRejectReason} placeholder="e.g. sample not reviewed yet / use the lighter cotton instead" />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label}
        variant={confirm?.variant}
        loading={confirming}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default ListingRequestsPage;
