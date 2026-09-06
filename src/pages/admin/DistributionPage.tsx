import React from 'react';
import { useHubContextFilter } from '../../utils/useHubContextFilter'; // [SHL-3-8]
import { isDenied, errorMessage } from '../../components/EmptyState/asyncState'; // [SHL-3-1]
import { useNavigate, useSearchParams } from 'react-router-dom';
import { distributionApi, designsApi, hubsApi, fabricsApi, qcTemplatesApi } from '../../api/adminApi';
import type { Distribution, DesignSummary, DesignFabricRef, Hub, CentralStockRow, FabricStockRow, Fabric, QcCheck } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { StatusBadge, PageHeader, EmptyState, Alert } from '../../components';
import { AgeCell } from '../../components/DataCells';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import s from './DistributionPage.module.css';
import { UilPlus } from '@iconscout/react-unicons';
import { FabricSwatch } from '../../components/Image/FabricSwatch';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const numv = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

export const DistributionPage: React.FC = () => {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = React.useState<Distribution[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  // [SHL-3-1] Kept, not discarded. Procurement's one job is pushing a design to a hub, and the
  // design list was 403 for the role — so the dropdown rendered EMPTY and the page said nothing.
  // "There are no published designs" and "you are not allowed to see them" are the same picture
  // with a swallowed catch, and only one of them is the operator's problem to solve.
  const [designsErr, setDesignsErr] = React.useState<unknown>(null);
  const [hubsErr, setHubsErr] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(true);
  // [SHL-3-8] Defaults to the header hub switcher and follows it. Was React.useState(''),
  // so the global control changed nothing on this page while claiming to.
  const [hubFilter, setHubFilter] = useHubContextFilter();
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // central available (fabric_id → m) + per-hub stock (`${hub}-${fabric}` → row), for the push modal
  const [central, setCentral] = React.useState<Record<string, number>>({});
  const [hubStock, setHubStock] = React.useState<Record<string, FabricStockRow>>({});

  // push modal
  const NO_DESIGN = '__none__'; // sentinel: plain fabric restock (no design)
  const [open, setOpen] = React.useState(false);
  const [designId, setDesignId] = React.useState('');
  const [fabrics, setFabrics] = React.useState<DesignFabricRef[]>([]);
  const [allFabrics, setAllFabrics] = React.useState<Fabric[]>([]);
  const [fabricId, setFabricId] = React.useState('');
  const [hubId, setHubId] = React.useState('');
  const [sampleQty, setSampleQty] = React.useState('1');
  const [sellableQty, setSellableQty] = React.useState('0');
  const [lotCode, setLotCode] = React.useState(''); // T1-9 dye-lot being shipped
  const [pushing, setPushing] = React.useState(false);

  // receive (G-30)
  const [receiveTarget, setReceiveTarget] = React.useState<Distribution | null>(null);
  const [actualMeters, setActualMeters] = React.useState('');
  const [varianceReason, setVarianceReason] = React.useState('');
  const [receiving, setReceiving] = React.useState(false);
  // inbound QC (T1-13)
  const [rejectedMeters, setRejectedMeters] = React.useState('');
  const [heldMeters, setHeldMeters] = React.useState('');
  const [qcNotes, setQcNotes] = React.useState('');
  const [qcDefects, setQcDefects] = React.useState<string[]>([]);
  // T1-13b Phase 2: the category's QC checklist + the inspector's per-check answers.
  const [qcChecks, setQcChecks] = React.useState<QcCheck[]>([]);
  const [qcAnswers, setQcAnswers] = React.useState<Record<string, number | boolean | null>>({});
  // re-inspect held metres (T1-13)
  const [inspectTarget, setInspectTarget] = React.useState<Distribution | null>(null);
  const [acceptMeters, setAcceptMeters] = React.useState('');
  const [rejMeters, setRejMeters] = React.useState('');
  const [inspectNotes, setInspectNotes] = React.useState('');
  const [inspecting, setInspecting] = React.useState(false);

  // cancel (with reason)
  const [cancelTarget, setCancelTarget] = React.useState<Distribution | null>(null);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelling, setCancelling] = React.useState(false);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    distributionApi
      .list({ hub_id: hubFilter || undefined })
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(setHubsErr);
    designsApi.list({ status: 'published' }).then(setDesigns).catch(setDesignsErr);
    fabricsApi.centralStock().then((cs: CentralStockRow[]) => {
      const m: Record<string, number> = {};
      cs.forEach((c) => { m[c.fabric_id] = numv(c.available_meters); });
      setCentral(m);
    }).catch(() => {});
    fabricsApi.stock().then((st: FabricStockRow[]) => {
      const m: Record<string, FabricStockRow> = {};
      st.forEach((r) => { m[`${r.hub_id}-${r.fabric_id}`] = r; });
      setHubStock(m);
    }).catch(() => {});
    fabricsApi.list({ active: true }).then(setAllFabrics).catch(() => {});
  }, []);

  // Deep-link from Cross-hub Stock "Create distribution →": open the push modal with the hub
  // preset and, for a plain restock, the fabric preselected (no design needed — G-29 close).
  const prefillApplied = React.useRef(false);
  React.useEffect(() => {
    if (prefillApplied.current) return;
    const hub = sp.get('hub_id');
    const fab = sp.get('fabric_id');
    if (hub && hubs.length > 0) {
      prefillApplied.current = true;
      setHubId(hub);
      if (fab) { setDesignId(NO_DESIGN); setFabricId(fab); setSampleQty('0'); setSellableQty('0'); }
      setOpen(true);
      sp.delete('hub_id'); sp.delete('fabric_id'); setSp(sp, { replace: true });
    }
  }, [sp, hubs, setSp]);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';
  const restockMode = designId === NO_DESIGN;

  React.useEffect(() => {
    if (!designId || designId === NO_DESIGN) { setFabrics([]); if (designId !== NO_DESIGN) setFabricId(''); return; }
    designsApi.get(designId).then((d) => { setFabrics(d.fabrics); setFabricId(d.fabrics[0]?.id ?? ''); }).catch(() => setFabrics([]));
  }, [designId]);

  const openPush = () => {
    setDesignId(''); setFabrics([]); setFabricId(''); setHubId(hubs[0]?.id ?? '');
    setSampleQty('1'); setSellableQty('0'); setLotCode(''); setOpen(true);
  };

  // ── push validation against central (caught here, not at the hub's receive) ──
  const shipTotal = (Number(sellableQty) || 0) + (Number(sampleQty) || 0);
  const centralAvail = fabricId in central ? central[fabricId] : null; // null = not centrally tracked
  const overPush = centralAvail != null && shipTotal > centralAvail;
  const gapRow = fabricId && hubId ? hubStock[`${hubId}-${fabricId}`] : undefined;
  const reorderGap = gapRow && gapRow.reorder_meters != null && numv(gapRow.available_meters) < numv(gapRow.reorder_meters)
    ? numv(gapRow.reorder_meters) - numv(gapRow.available_meters) : 0;

  const openReceive = (r: Distribution) => {
    setReceiveTarget(r);
    setActualMeters(String(Number(r.sellable_qty)));
    setVarianceReason('');
    setRejectedMeters(''); setHeldMeters(''); setQcNotes(''); setQcDefects([]);
    // T1-13b: load the category's QC checklist (if any) so the inspector fills it in.
    setQcChecks([]); setQcAnswers({});
    if (r.garment_category_id) {
      qcTemplatesApi
        .forCategory(r.garment_category_id)
        .then((t) => setQcChecks(t?.checks ?? []))
        .catch(() => {});
    }
  };
  const setAnswer = (key: string, val: number | boolean | null) =>
    setQcAnswers((a) => ({ ...a, [key]: val }));
  // A numeric answer outside its tolerance / a required boolean answered "fail" — flagged.
  const checkFails = (c: QcCheck): boolean => {
    const v = qcAnswers[c.key];
    if (c.type === 'numeric')
      return typeof v === 'number' && ((c.min != null && v < c.min) || (c.max != null && v > c.max));
    return v === false;
  };
  const toggleDefect = (d: string) =>
    setQcDefects((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));

  const handleReceive = async () => {
    if (!receiveTarget) return;
    const pushed = Number(receiveTarget.sellable_qty);
    const actual = Number(actualMeters);
    if (!Number.isFinite(actual) || actual < 0) { toast('error', 'Enter the received meters'); return; }
    const variancePct = pushed > 0 ? Math.abs(actual - pushed) / pushed : 0;
    if (variancePct > 0.05 && !varianceReason.trim()) {
      toast('error', 'Variance reason required', `Received ${actual}m vs pushed ${pushed}m`);
      return;
    }
    const rejected = Number(rejectedMeters) || 0;
    const held = Number(heldMeters) || 0;
    if (rejected + held > actual) { toast('error', 'Rejected + held cannot exceed received'); return; }
    if ((rejected > 0 || held > 0) && !qcNotes.trim()) { toast('error', 'A QC note is required to reject/hold'); return; }
    // T1-13b: every REQUIRED checklist item must be answered (mirrors the backend 400).
    const answeredKeys = new Set(
      qcChecks
        .filter((c) => {
          const v = qcAnswers[c.key];
          return c.type === 'numeric' ? typeof v === 'number' : typeof v === 'boolean';
        })
        .map((c) => c.key),
    );
    const missing = qcChecks.filter((c) => c.required && !answeredKeys.has(c.key));
    if (missing.length) {
      toast('error', 'QC checklist incomplete', `Answer: ${missing.map((c) => c.label).join(', ')}`);
      return;
    }
    const qcCheckResults = qcChecks
      .filter((c) => answeredKeys.has(c.key))
      .map((c) =>
        c.type === 'numeric'
          ? { key: c.key, value: qcAnswers[c.key] as number }
          : { key: c.key, pass: qcAnswers[c.key] as boolean },
      );
    setReceiving(true);
    try {
      const res = await distributionApi.receive(receiveTarget.id, {
        actual_meters: actual,
        ...(varianceReason.trim() ? { variance_reason: varianceReason.trim() } : {}),
        ...(rejected > 0 ? { rejected_meters: rejected } : {}),
        ...(held > 0 ? { held_meters: held } : {}),
        ...(qcNotes.trim() ? { qc_notes: qcNotes.trim() } : {}),
        ...(qcDefects.length ? { qc_defects: qcDefects } : {}),
        ...(qcCheckResults.length ? { qc_check_results: qcCheckResults } : {}),
      });
      const accepted = actual - rejected - held;
      toast('success', `QC: ${res.qc_result}`, `${accepted}m accepted${held ? `, ${held}m held` : ''}${rejected ? `, ${rejected}m rejected` : ''}.`);
      setReceiveTarget(null);
      load();
    } catch (err) {
      toast('error', 'Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setReceiving(false);
    }
  };

  const openInspect = (r: Distribution) => {
    setInspectTarget(r);
    setAcceptMeters(String(Number(r.held_meters ?? 0)));
    setRejMeters(''); setInspectNotes('');
  };
  const handleInspect = async () => {
    if (!inspectTarget) return;
    const accept = Number(acceptMeters) || 0;
    const reject = Number(rejMeters) || 0;
    const held = Number(inspectTarget.held_meters ?? 0);
    if (accept + reject <= 0) { toast('error', 'Enter metres to accept and/or reject'); return; }
    if (accept + reject > held) { toast('error', `Only ${held}m are held`); return; }
    if (reject > 0 && !inspectNotes.trim()) { toast('error', 'A note is required to reject'); return; }
    setInspecting(true);
    try {
      const res = await distributionApi.inspect(inspectTarget.id, {
        ...(accept > 0 ? { accept_meters: accept } : {}),
        ...(reject > 0 ? { reject_meters: reject } : {}),
        ...(inspectNotes.trim() ? { notes: inspectNotes.trim() } : {}),
      });
      toast('success', 'Re-inspected', `${res.accepted}m accepted, ${res.rejected}m rejected, ${res.remaining_held}m still held.`);
      setInspectTarget(null);
      load();
    } catch (err) {
      toast('error', 'Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setInspecting(false);
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await distributionApi.cancel(cancelTarget.id, cancelReason.trim() || undefined);
      toast('success', 'Distribution cancelled');
      setCancelTarget(null); setCancelReason('');
      load();
    } catch (err) {
      toast('error', 'Cancel failed', err instanceof Error ? err.message : undefined);
    } finally {
      setCancelling(false);
    }
  };

  const push = async () => {
    if (!designId || !hubId) { toast('error', restockMode ? 'Pick a hub' : 'Pick a design and a hub'); return; }
    if (restockMode && !fabricId) { toast('error', 'Pick a fabric to restock'); return; }
    if (overPush) { toast('error', 'Not enough central stock', `Central has ${centralAvail}m; you're pushing ${shipTotal}m.`); return; }
    setPushing(true);
    try {
      const pushed = await distributionApi.push({
        design_id: restockMode ? null : designId,
        fabric_id: fabricId || null,
        hub_id: hubId,
        sample_qty: restockMode ? 0 : (Number(sampleQty) || 0),
        sellable_qty: Number(sellableQty) || 0,
        lot_code: lotCode.trim() || undefined,
      });
      // [PRC-15-5] The server converts a design push into a fabric-less one when the hub
      // already stocks the SKU. Saying "the hub will receive and stock it" for that shipment
      // was wrong: no fabric ships and nothing is drawn from central. The list discloses it
      // afterwards ("hub stocks SKU" in the Fabric column) — this says it at the moment the
      // operator is still looking at what they just did.
      if (pushed.fabric_skipped) {
        toast(
          'info',
          'Pushed — no fabric shipped',
          'The hub already stocks this SKU, so no metres were dispatched or drawn from central.',
        );
      } else {
        toast('success', restockMode ? 'Restock pushed to hub' : 'Pushed to hub', 'The hub will receive and stock it.');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast('error', 'Push failed', e instanceof Error ? e.message : undefined);
    } finally {
      setPushing(false);
    }
  };

  const inTransit = rows.filter((r) => r.status === 'pushed');
  const received = rows.filter((r) => r.status === 'received');
  const cancelled = rows.filter((r) => r.status === 'cancelled');

  const renderRow = (r: Distribution) => (
    <tr
      key={r.id}
      className={r.fabric_id ? styles.row : undefined}
      style={r.fabric_id ? { cursor: 'pointer' } : undefined}
       {...(r.fabric_id ? rowActivation(() => navigate(`/admin/procurement/track/${r.hub_id}/${r.fabric_id}`)) : {})}>
      <td className={styles.customerName} style={{ fontWeight: 500 }}>{r.design_name ?? <span style={{ opacity: 0.6 }}>Plain restock</span>}</td>
      <td>
        {r.fabric_name ? (
          <div className={styles.fabricCell}>
            <FabricSwatch imageKeys={r.fabric_image_keys} name={r.fabric_name} />
            <div className={styles.fabricCellText}>
              <span>{r.fabric_name}</span>
              <span className={styles.fabricCellCode}>{r.fabric_code}</span>
            </div>
          </div>
        ) : (
          <span style={{ opacity: 0.5 }}>hub stocks SKU</span>
        )}
      </td>
      <td>{hubName(r.hub_id)}</td>
      <td className={`${styles.total} ${s.numCol}`}>{Number(r.sample_qty).toLocaleString('en-IN')} m</td>
      <td className={`${styles.total} ${s.numCol}`}>{Number(r.sellable_qty).toLocaleString('en-IN')} m</td>
      <td>
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          {/* [PRC-15-6] "Received 50m of 10m" and "Received 80m of 100m" both wore the
              standard green Received badge — no percentage, no grading, and the mandatory
              variance reason visible nowhere but a hover title. A buyer scanning this
              section could not see which receipts were short or over without opening each
              one. The badge now carries the variance and turns on the same 5% threshold
              the server gates on, so what the receipt had to justify is what the row shows. */}
          {(() => {
            const pct = r.variance_pct == null ? null : Number(r.variance_pct);
            const off = pct != null && Math.abs(pct) > 5;
            return (
              <StatusBadge
                status={r.status}
                tone={r.status === 'received' && off ? 'blocked' : undefined}
                title={r.variance_reason ?? r.cancel_reason ?? undefined}
                label={
                  r.status === 'received' && r.received_meters != null && Number(r.received_meters) !== Number(r.sellable_qty)
                    ? `Received ${Number(r.received_meters)}m of ${Number(r.sellable_qty)}m${pct == null ? '' : ` · ${pct > 0 ? '+' : ''}${pct}%`}`
                    : undefined
                }
              />
            );
          })()}
          {r.status === 'pushed' && <AgeCell since={r.created_at} warnAfterH={120} alertAfterH={240} />}
          {r.status === 'pushed' && (
            <>
              {/* [KA4-5] These are opposite acts and were the same brand green, same size,
                  same weight. Receive stays primary-toned; Cancel — which destroys a
                  shipment — carries the error colour. [KA4-6] "Receive…" was being clipped
                  inside its column; a verb the operator has to trust must never be
                  abbreviated by layout, so the cell no longer wraps or truncates it. */}
              <Button variant="ghost" size="sm" className={s.rowVerb} disabled={cancelling} onClick={() => openReceive(r)}>Receive…</Button>
              <Button variant="ghost-danger" size="sm" className={s.rowVerb} disabled={cancelling} onClick={() => { setCancelTarget(r); setCancelReason(''); }}>Cancel</Button>
            </>
          )}
          {/* [PRC-15-13] Who counted it. The page's own banner says procurement records
              receipts on the hub's behalf, which is exactly why the stand-in has to be
              named. Older receipts have nobody recorded and say so rather than guess. */}
          {r.status === 'received' && (
            <span className={s.varianceReason}>
              {r.received_by_name ? `counted by ${r.received_by_name}` : 'counter not recorded'}
            </span>
          )}
          {/* The reason is mandatory to record and was rendered nowhere. A tooltip is not
              a rendering — nothing about the row invites the hover that reveals it. */}
          {r.status === 'received' && r.variance_reason && (
            <span className={s.varianceReason} title={r.variance_reason}>
              {r.variance_reason}
            </span>
          )}
          {r.status === 'cancelled' && r.cancel_reason && (
            <span className={s.varianceReason} title={r.cancel_reason}>
              {r.cancel_reason}
            </span>
          )}
          {r.status === 'received' && Number(r.held_meters ?? 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={() => openInspect(r)}>Re-inspect {Number(r.held_meters)}m held…</Button>
          )}
        </div>
      </td>
      {/* [KA4-9] This rendered "10 Jun" — no year — while the row's age ("67d") is shown
          beside the status pill, which the craft audit calls exactly right for a worklist.
          So the duplication was not the age; it was a date too short to place a 67-day-old
          consignment, which could as easily be last year. The year shows when it is not the
          current one, and the full timestamp plus the age live in the title.
          The inline style this used to carry is now the shared `.date` class. */}
      <td className={styles.date}>
        <span title={`Pushed ${new Date(r.created_at).toLocaleString('en-IN')}`}>
          {new Date(r.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            ...(new Date(r.created_at).getFullYear() === new Date().getFullYear()
              ? {}
              : { year: 'numeric' }),
          })}
        </span>
        {/* T3-4 (W-P3): the physical-world handle — what to quote when a hub says "never arrived". */}
        {r.consignment_ref && <div className={styles.fabricCellCode}>LR {r.consignment_ref}</div>}
      </td>
    </tr>
  );

  const section = (title: string, list: Distribution[], emptyMsg: string) => (
    <section className={s.section}>
      <h2 className={s.sectionTitle}>{title} {!loading && <span className={s.count}>{list.length}</span>}</h2>
      {/* [KA4-10] An empty section used to render its full 7-column header over a single
          "Nothing received yet." row. Column names describe rows that exist; with none, they
          are scaffolding around a sentence. The header now appears only when there is
          something to head — while loading (the skeleton needs its columns) or with rows. */}
      {!loading && list.length === 0 ? (
        <p className={s.sectionEmpty}>{emptyMsg}</p>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            {/* [KA4-8] These were "Sample qty" / "Sellable qty", left-aligned with bare
                integers, on the same console where Central Stock right-aligns its figures
                with the unit attached. They are METRES — the push form's own fields are
                labelled "Sample metres" and the column is NUMERIC(8,2) — so "qty" was
                doubly wrong: no unit, and the wrong noun for a decimal length. */}
            <tr><th>Design</th><th>Fabric</th><th>Hub</th><th className={s.numCol}>Sample metres</th><th className={s.numCol}>Sellable metres</th><th>Status</th><th>Pushed</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : list.map(renderRow)}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow="Procurement · Supply"
        title="Distribution"
        subtitle="Push a published design's fabric from central stock to a hub; the hub receives it into stock."
        actions={<Button variant="primary" onClick={openPush}><UilPlus size={16} /> Push to hub</Button>}
      />

      <Alert
        type="info"
        title="Receiving is normally the hub's job"
        message="In the live flow, hub staff confirm receipt in the ops app. Until that ships, procurement can record receipt here on their behalf."
      />

      <div className={s.toolbar}>
        <select className={s.hubSel} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState title="Nothing distributed yet" body="Push a published design + fabric to a hub to get started." action={{ label: 'Push to hub', onClick: openPush }} />
      ) : (
        <>
          {section('In transit', inTransit, 'Nothing in transit.')}
          {section('Received', received, 'Nothing received yet.')}
          {cancelled.length > 0 && section('Cancelled', cancelled, '')}
        </>
      )}

      {/* Push */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Push to hub"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" state={pushing ? 'loading' : 'default'} disabled={overPush} onClick={push}>Push</Button>
          </>
        }
      >
        <div className={styles.modalStack}>
          <label className={styles.fieldLabel}>Design
            <select className={styles.filterSelect} value={designId} onChange={(e) => setDesignId(e.target.value)}>
              <option value="">
                {designsErr
                  ? isDenied(designsErr)
                    ? 'You do not have access to the design library'
                    : `Designs could not be loaded${errorMessage(designsErr) ? ` — ${errorMessage(designsErr)}` : ''}`
                  : 'Select a published design…'}
              </option>
              <option value={NO_DESIGN}>— No design · plain fabric restock —</option>
              {designs.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.garment_type}</option>)}
            </select>
            {designsErr ? (
              <span className={s.fieldHint}>
                {isDenied(designsErr)
                  ? 'Ask a super admin for design read access — a plain fabric restock still works without it.'
                  : 'A plain fabric restock still works. Reload to try the design list again.'}
              </span>
            ) : null}
          </label>
          <label className={styles.fieldLabel}>Fabric
            {restockMode ? (
              <select className={styles.filterSelect} value={fabricId} onChange={(e) => setFabricId(e.target.value)}>
                <option value="">Select a fabric…</option>
                {allFabrics.map((f) => <option key={f.id} value={f.id}>{f.name}{f.code ? ` (${f.code})` : ''}</option>)}
              </select>
            ) : (
              <select className={styles.filterSelect} value={fabricId} onChange={(e) => setFabricId(e.target.value)} disabled={!designId}>
                <option value="">{designId ? (fabrics.length ? 'Hub already stocks the SKU' : 'No matched fabrics') : 'Pick a design first'}</option>
                {fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}{f.code ? ` (${f.code})` : ''}</option>)}
              </select>
            )}
          </label>
          {fabricId && (
            <p className={s.hint}>
              Central available: <strong>{centralAvail != null ? `${centralAvail.toLocaleString('en-IN')} m` : 'not tracked centrally'}</strong>
            </p>
          )}
          <label className={styles.fieldLabel}>Hub
            <select className={styles.filterSelect} value={hubId} onChange={(e) => setHubId(e.target.value)}>
              <option value="">
                {hubsErr
                  ? isDenied(hubsErr)
                    ? 'You do not have access to the hub list'
                    : `Hubs could not be loaded${errorMessage(hubsErr) ? ` — ${errorMessage(hubsErr)}` : ''}`
                  : 'Select a hub…'}
              </option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            {hubsErr ? (
              <span className={s.fieldHint}>
                Without the hub list there is nothing to push to. Reload, or ask a super admin.
              </span>
            ) : null}
          </label>
          {reorderGap > 0 && (
            <div className={s.suggest}>
              Hub is {reorderGap.toLocaleString('en-IN')} m below its reorder point.
              <button type="button" className={s.useBtn} onClick={() => setSellableQty(String(reorderGap))}>Use {reorderGap} m</button>
            </div>
          )}
          {restockMode ? (
            <Input label="Metres to send" type="number" value={sellableQty} onChange={setSellableQty} />
          ) : (
            <div className={styles.modalGrid}>
              <Input label="Sample metres" type="number" value={sampleQty} onChange={setSampleQty} />
              <Input label="Sellable metres" type="number" value={sellableQty} onChange={setSellableQty} />
            </div>
          )}
          <Input label="Dye-lot code (optional)" value={lotCode} onChange={setLotCode} placeholder="which physical lot you're shipping" />
          {overPush && (
            <p className={`${s.hint} ${s.hintWarn}`}>
              Pushing {shipTotal} m {restockMode ? '' : `(sample ${Number(sampleQty) || 0} + sellable ${Number(sellableQty) || 0}) `}exceeds central available ({centralAvail} m). Receive more into Central Stock first.
            </p>
          )}
        </div>
      </Modal>

      {/* Receive (G-30) */}
      <Modal
        open={receiveTarget !== null}
        onClose={() => !receiving && setReceiveTarget(null)}
        title="Receive at hub"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReceiveTarget(null)} disabled={receiving}>Cancel</Button>
            <Button variant="primary" state={receiving ? 'loading' : 'default'} onClick={handleReceive}>Confirm receipt</Button>
          </>
        }
      >
        {receiveTarget && (
          <div className={styles.modalStack}>
            <p className={styles.fabricCellCode}>
              {receiveTarget.design_name ?? 'Plain restock'} · {receiveTarget.fabric_name ?? 'fabric'} → {hubName(receiveTarget.hub_id)} · pushed {Number(receiveTarget.sellable_qty)}m
            </p>
            <Input label="Actually received (meters)" type="number" value={actualMeters} onChange={setActualMeters} />
            {Number(receiveTarget.sellable_qty) > 0 &&
              Math.abs(Number(actualMeters) - Number(receiveTarget.sellable_qty)) / Number(receiveTarget.sellable_qty) > 0.05 && (
              <Input
                label="Variance reason (required — differs >5% from pushed)"
                value={varianceReason}
                onChange={setVarianceReason}
                placeholder="e.g. 2m short — supplier roll ran out"
              />
            )}
            {/* T1-13: inbound QC gate */}
            <div className={s.qcBox}>
              <div className={s.qcTitle}>Inbound QC — check width / GSM / shade / defects</div>
              {/* T1-13b: the design's category checklist (required checks + tolerances). */}
              {qcChecks.length > 0 && (
                <div className={s.qcChecklist}>
                  {qcChecks.map((c) => {
                    const v = qcAnswers[c.key];
                    const fail = checkFails(c);
                    const tol =
                      c.type === 'numeric' && (c.min != null || c.max != null)
                        ? `${c.min != null ? `≥${c.min}` : ''}${c.min != null && c.max != null ? ' & ' : ''}${c.max != null ? `≤${c.max}` : ''}${c.unit ? ` ${c.unit}` : ''}`
                        : '';
                    return (
                      <div key={c.key} className={s.qcCheckRow}>
                        <span className={s.qcCheckLabel}>
                          {c.label}
                          {c.required ? ' *' : ''}
                          {tol && <span className={s.qcCheckTol}> ({tol})</span>}
                        </span>
                        {c.type === 'numeric' ? (
                          <input
                            className={`${s.qcCheckInput} ${fail ? s.qcCheckFail : ''}`}
                            type="number"
                            value={typeof v === 'number' ? String(v) : ''}
                            onChange={(e) =>
                              setAnswer(c.key, e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        ) : (
                          <span className={s.qcPassFail}>
                            <button
                              type="button"
                              className={`${s.qcChip} ${v === true ? s.qcChipOn : ''}`}
                              onClick={() => setAnswer(c.key, true)}
                            >
                              Pass
                            </button>
                            <button
                              type="button"
                              className={`${s.qcChip} ${v === false ? s.qcChipFail : ''}`}
                              onClick={() => setAnswer(c.key, false)}
                            >
                              Fail
                            </button>
                          </span>
                        )}
                        {fail && <span className={s.qcFailFlag}>out of tolerance</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={s.qcRow}>
                <Input label="Reject (write-off, m)" type="number" value={rejectedMeters} onChange={setRejectedMeters} placeholder="0" />
                <Input label="Hold (quarantine, m)" type="number" value={heldMeters} onChange={setHeldMeters} placeholder="0" />
              </div>
              <div className={s.qcDefects}>
                {['width', 'gsm', 'shade', 'defect', 'other'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${s.qcChip} ${qcDefects.includes(d) ? s.qcChipOn : ''}`}
                    onClick={() => toggleDefect(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {(Number(rejectedMeters) > 0 || Number(heldMeters) > 0) && (
                <Input label="QC note (required)" value={qcNotes} onChange={setQcNotes} placeholder="e.g. shade off on 20m, holes on 10m" />
              )}
              <p className={styles.fabricCellCode}>
                Accepted = {Math.max(0, Number(actualMeters || 0) - (Number(rejectedMeters) || 0) - (Number(heldMeters) || 0))}m enter available. Rejected never do; held wait in quarantine.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Re-inspect held/quarantined metres (T1-13) */}
      <Modal
        open={inspectTarget !== null}
        onClose={() => !inspecting && setInspectTarget(null)}
        title="Re-inspect held fabric"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInspectTarget(null)} disabled={inspecting}>Cancel</Button>
            <Button variant="primary" state={inspecting ? 'loading' : 'default'} onClick={handleInspect}>Clear held</Button>
          </>
        }
      >
        {inspectTarget && (
          <div className={styles.modalStack}>
            <p className={styles.fabricCellCode}>
              {inspectTarget.fabric_name ?? 'fabric'} → {hubName(inspectTarget.hub_id)} · {Number(inspectTarget.held_meters ?? 0)}m held in quarantine
            </p>
            <div className={s.qcRow}>
              <Input label="Accept → available (m)" type="number" value={acceptMeters} onChange={setAcceptMeters} placeholder="0" />
              <Input label="Reject → write-off (m)" type="number" value={rejMeters} onChange={setRejMeters} placeholder="0" />
            </div>
            {Number(rejMeters) > 0 && (
              <Input label="Reject note (required)" value={inspectNotes} onChange={setInspectNotes} placeholder="e.g. shade still off after re-check" />
            )}
          </div>
        )}
      </Modal>

      {/* Cancel (with reason) */}
      <Modal
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="Cancel this distribution?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelling}>Keep</Button>
            <Button variant="primary" state={cancelling ? 'loading' : 'default'} onClick={doCancel}>Yes, cancel it</Button>
          </>
        }
      >
        {cancelTarget && (
          <div className={styles.modalStack}>
            <p className={s.hint}>
              The push of <strong>{Number(cancelTarget.sellable_qty)}m</strong> of <strong>{cancelTarget.fabric_name ?? 'fabric'}</strong> to <strong>{hubName(cancelTarget.hub_id)}</strong> will be cancelled. No stock moves — it never arrived.
            </p>
            <Input label="Reason (optional)" value={cancelReason} onChange={setCancelReason} placeholder="e.g. wrong hub, lost in transit" />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DistributionPage;
