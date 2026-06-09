import React from 'react';
import { distributionApi, designsApi, hubsApi } from '../../api/adminApi';
import type { Distribution, DesignSummary, DesignFabricRef, Hub } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import { UilPlus } from '@iconscout/react-unicons';

const STATUS_LABELS: Record<string, string> = { pushed: 'Pushed', received: 'Received', cancelled: 'Cancelled' };
const STATUS_CSS: Record<string, string> = { pushed: 'stageWarning', received: 'stageSuccess', cancelled: 'stageNeutral' };

export const DistributionPage: React.FC = () => {
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
                <tr key={r.id}>
                  <td className={styles.customerName} style={{ fontWeight: 500 }}>{r.design_name}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{r.fabric_name ?? <span style={{ opacity: 0.5 }}>hub stocks SKU</span>}</td>
                  <td>{hubName(r.hub_id)}</td>
                  <td className={styles.total}>{Number(r.sample_qty)}</td>
                  <td className={styles.total}>{Number(r.sellable_qty)}</td>
                  <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[r.status] ?? 'stageNeutral']}`}>{STATUS_LABELS[r.status] ?? r.status}</span></td>
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
    </div>
  );
};

export default DistributionPage;
