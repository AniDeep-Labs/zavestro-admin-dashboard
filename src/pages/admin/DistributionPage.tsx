import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { distributionApi, designsApi, hubsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { Distribution, DesignSummary, DesignFabricRef, Hub } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { AgeCell } from '../../components/DataCells';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import { UilPlus } from '@iconscout/react-unicons';

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');

export const DistributionPage: React.FC = () => {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [acting, setActing] = React.useState('');
  const [confirm, setConfirm] = React.useState<null | { title: string; message: React.ReactNode; label: string; run: () => Promise<void> }>(null);
  const [confirming, setConfirming] = React.useState(false);
  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try { await confirm.run(); } finally { setConfirming(false); setConfirm(null); }
  };
  const [rows, setRows] = React.useState<Distribution[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hubFilter, setHubFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // push modal
  const [open, setOpen] = React.useState(false);
  const [designId, setDesignId] = React.useState('');
  const [fabrics, setFabrics] = React.useState<DesignFabricRef[]>([]);
  const [fabricId, setFabricId] = React.useState('');
  const [hubId, setHubId] = React.useState('');
  const [sampleQty, setSampleQty] = React.useState('1');
  const [sellableQty, setSellableQty] = React.useState('0');
  const [pushing, setPushing] = React.useState(false);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    distributionApi
      .list({ status: statusFilter || undefined, hub_id: hubFilter || undefined })
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
    designsApi.list({ status: 'published' }).then(setDesigns).catch(() => {});
  }, []);

  // Deep-link from Cross-hub Stock "Create distribution →": open the push modal
  // with the hub preset (the design choice stays with procurement).
  const prefillApplied = React.useRef(false);
  React.useEffect(() => {
    if (prefillApplied.current) return;
    const hub = sp.get('hub_id');
    if (hub && hubs.length > 0) {
      prefillApplied.current = true;
      setHubId(hub);
      setOpen(true);
    }
  }, [sp, hubs]);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';

  // when a design is picked, pull its matched fabrics
  React.useEffect(() => {
    if (!designId) { setFabrics([]); setFabricId(''); return; }
    designsApi.get(designId).then((d) => { setFabrics(d.fabrics); setFabricId(d.fabrics[0]?.id ?? ''); }).catch(() => setFabrics([]));
  }, [designId]);

  const openPush = () => {
    setDesignId(''); setFabrics([]); setFabricId(''); setHubId(hubs[0]?.id ?? '');
    setSampleQty('1'); setSellableQty('0'); setOpen(true);
  };

  // G-30: receive records the ACTUAL meters that arrived (variance > 5% needs a reason)
  const [receiveTarget, setReceiveTarget] = React.useState<Distribution | null>(null);
  const [actualMeters, setActualMeters] = React.useState('');
  const [varianceReason, setVarianceReason] = React.useState('');
  const [receiving, setReceiving] = React.useState(false);

  const openReceive = (r: Distribution) => {
    setReceiveTarget(r);
    setActualMeters(String(Number(r.sellable_qty)));
    setVarianceReason('');
  };

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
    setReceiving(true);
    try {
      const res = await distributionApi.receive(receiveTarget.id, {
        actual_meters: actual,
        ...(varianceReason.trim() ? { variance_reason: varianceReason.trim() } : {}),
      });
      toast('success', 'Received at hub', res.stocked_meters ? `${res.stocked_meters}m landed in stock.` : undefined);
      setReceiveTarget(null);
      load();
    } catch (err) {
      toast('error', 'Failed', err instanceof Error ? err.message : undefined);
    } finally {
      setReceiving(false);
    }
  };

  // G-30: cancel an in-transit push (no stock moves — it never landed)
  const cancelPush = async (r: Distribution) => {
    setActing(r.id);
    try {
      await distributionApi.cancel(r.id);
      toast('success', 'Distribution cancelled');
      load();
    } catch (err) {
      toast('error', 'Cancel failed', err instanceof Error ? err.message : undefined);
    } finally {
      setActing('');
    }
  };

  const push = async () => {
    if (!designId || !hubId) { toast('error', 'Pick a design and a hub'); return; }
    setPushing(true);
    try {
      await distributionApi.push({
        design_id: designId,
        fabric_id: fabricId || null,
        hub_id: hubId,
        sample_qty: Number(sampleQty) || 0,
        sellable_qty: Number(sellableQty) || 0,
      });
      toast('success', 'Pushed to hub', 'The hub will receive and stock it.');
      setOpen(false);
      load();
    } catch (e) {
      toast('error', 'Push failed', e instanceof Error ? e.message : undefined);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Distribution</h1>
        <Button variant="primary" onClick={openPush}><UilPlus size={16} /> Push to hub</Button>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pushed">Pushed</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Design</th><th>Fabric</th><th>Hub</th><th>Sample qty</th><th>Sellable qty</th><th>Status</th><th>Pushed</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>Nothing distributed yet. Push a design + fabric to a hub.</td></tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={r.fabric_id ? styles.row : undefined}
                  style={r.fabric_id ? { cursor: 'pointer' } : undefined}
                  onClick={r.fabric_id ? () => navigate(`/admin/procurement/track/${r.hub_id}/${r.fabric_id}`) : undefined}
                >
                  <td className={styles.customerName} style={{ fontWeight: 500 }}>{r.design_name}</td>
                  <td>
                    {r.fabric_name ? (
                      <div className={styles.fabricCell}>
                        {swatch(r.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
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
                  <td className={styles.total}>{Number(r.sample_qty)}</td>
                  <td className={styles.total}>{Number(r.sellable_qty)}</td>
                  <td>
                    <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                      <StatusBadge
                        status={r.status}
                        title={r.variance_reason ?? undefined}
                        label={r.status === 'received' && r.received_meters != null && Number(r.received_meters) !== Number(r.sellable_qty)
                          ? `Received ${Number(r.received_meters)}m of ${Number(r.sellable_qty)}m`
                          : undefined}
                      />
                      {r.status === 'pushed' && <AgeCell since={r.created_at} warnAfterH={120} alertAfterH={240} />}
                      {r.status === 'pushed' && (
                        <>
                          <Button variant="ghost" size="sm" disabled={acting === r.id} onClick={() => openReceive(r)}>
                            Receive…
                          </Button>
                          <Button variant="ghost" size="sm" disabled={acting === r.id} onClick={() => setConfirm({
                            title: 'Cancel this distribution?', label: 'Yes, cancel it',
                            message: <>The push of <strong>{Number(r.sellable_qty)}m</strong> of <strong>{r.fabric_name ?? 'fabric'}</strong> to <strong>{hubName(r.hub_id)}</strong> will be cancelled. No stock moves — it never arrived.</>,
                            run: () => cancelPush(r),
                          })}>Cancel</Button>
                        </>
                      )}
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Push to hub"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" state={pushing ? 'loading' : 'default'} onClick={push}>Push</Button>
          </>
        }
      >
        <div className={styles.modalStack}>
          <label className={styles.fieldLabel}>Design
            <select className={styles.filterSelect} value={designId} onChange={(e) => setDesignId(e.target.value)}>
              <option value="">Select a published design…</option>
              {designs.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.garment_type}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>Fabric
            <select className={styles.filterSelect} value={fabricId} onChange={(e) => setFabricId(e.target.value)} disabled={!designId}>
              <option value="">{designId ? (fabrics.length ? 'Hub already stocks the SKU' : 'No matched fabrics') : 'Pick a design first'}</option>
              {fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}{f.code ? ` (${f.code})` : ''}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>Hub
            <select className={styles.filterSelect} value={hubId} onChange={(e) => setHubId(e.target.value)}>
              <option value="">Select a hub…</option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
          <div className={styles.modalGrid}>
            <Input label="Sample metres" type="number" value={sampleQty} onChange={setSampleQty} />
            <Input label="Sellable metres" type="number" value={sellableQty} onChange={setSellableQty} />
          </div>
        </div>
      </Modal>

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
              {receiveTarget.design_name} · {receiveTarget.fabric_name ?? 'fabric'} → {hubName(receiveTarget.hub_id)} · pushed {Number(receiveTarget.sellable_qty)}m
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
            <p className={styles.fabricCellCode}>
              The received meters land in the hub's stock and can't be undone here.
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label}
        loading={confirming}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default DistributionPage;
