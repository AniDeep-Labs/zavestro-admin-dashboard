import React from 'react';
import { fabricsApi, distributionApi, restockApi, listingRequestsApi, hubsApi } from '../../api/adminApi';
import type { FabricStockRow, Distribution, RestockRequest, ListingRequest, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import local from './DesignAnalyticsPage.module.css';

type Motion = { kind: string; fabric: string; code: string; hub: string; qty: number; state: 'In transit' | 'Awaiting procurement'; created_at: string };

export const SupplyOverviewPage: React.FC = () => {
  const [stock, setStock] = React.useState<FabricStockRow[]>([]);
  const [dist, setDist] = React.useState<Distribution[]>([]);
  const [restock, setRestock] = React.useState<RestockRequest[]>([]);
  const [listing, setListing] = React.useState<ListingRequest[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  React.useEffect(() => {
    Promise.all([fabricsApi.stock(), distributionApi.list(), restockApi.list(), listingRequestsApi.list(), hubsApi.list()])
      .then(([s, d, r, l, h]) => { setStock(s); setDist(d); setRestock(r); setListing(l); setHubs(h.hubs); })
      .catch((e) => setToasts((t) => [...t, createToast('error', 'Load failed', e instanceof Error ? e.message : undefined)]))
      .finally(() => setLoading(false));
  }, []);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';

  const totalStock = stock.reduce((s, r) => s + Number(r.available_meters), 0);
  const hubCount = new Set(stock.map((s) => s.hub_id)).size;

  const motion: Motion[] = [
    ...dist.filter((d) => d.status === 'pushed').map((d) => ({ kind: 'Distribution', fabric: d.fabric_name ?? '—', code: d.fabric_code ?? '', hub: hubName(d.hub_id), qty: Number(d.sellable_qty), state: 'In transit' as const, created_at: d.created_at })),
    ...restock.filter((r) => r.status === 'shipped').map((r) => ({ kind: 'Restock', fabric: r.fabric_name, code: r.fabric_code ?? '', hub: hubName(r.hub_id), qty: Number(r.qty), state: 'In transit' as const, created_at: r.created_at })),
    ...listing.filter((l) => l.status === 'approved').map((l) => ({ kind: 'Listing', fabric: l.fabric_name, code: l.fabric_code, hub: l.hub_name, qty: Number(l.qty), state: 'In transit' as const, created_at: l.created_at })),
    ...restock.filter((r) => r.status === 'requested').map((r) => ({ kind: 'Restock', fabric: r.fabric_name, code: r.fabric_code ?? '', hub: hubName(r.hub_id), qty: Number(r.qty), state: 'Awaiting procurement' as const, created_at: r.created_at })),
    ...listing.filter((l) => l.status === 'requested').map((l) => ({ kind: 'Listing', fabric: l.fabric_name, code: l.fabric_code, hub: l.hub_name, qty: Number(l.qty), state: 'Awaiting procurement' as const, created_at: l.created_at })),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const inTransit = motion.filter((m) => m.state === 'In transit').length;
  const awaiting = motion.filter((m) => m.state === 'Awaiting procurement').length;

  const kpis = [
    { label: 'In stock (all hubs)', value: loading ? '…' : `${totalStock.toLocaleString('en-IN')}m` },
    { label: 'Hubs stocked', value: loading ? '…' : String(hubCount) },
    { label: 'In transit', value: loading ? '…' : String(inTransit) },
    { label: 'Awaiting procurement', value: loading ? '…' : String(awaiting) },
  ];

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Supply Overview</h1>
        <span className={styles.pagination}>Fabric stock + what's moving, across the network</span>
      </div>

      <div className={local.kpiRow}>
        {kpis.map((k) => (
          <div key={k.label} className={local.kpiCard}>
            <span className={local.kpiLabel}>{k.label}</span>
            <span className={local.kpiValue}>{k.value}</span>
          </div>
        ))}
      </div>

      <h2 className={local.sectionHeading}>In motion</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Type</th><th>Fabric</th><th>Code</th><th>Hub</th><th>Metres</th><th>State</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : motion.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>Nothing in motion — all requests settled.</td></tr>
            ) : (
              motion.map((m, i) => (
                <tr key={i}>
                  <td>{m.kind}</td>
                  <td className={styles.customerName} style={{ fontWeight: 500 }}>{m.fabric}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>{m.code}</td>
                  <td>{m.hub || '—'}</td>
                  <td className={styles.total}>{m.qty}</td>
                  <td>
                    <span className={`${styles.stagePill} ${m.state === 'In transit' ? styles.stageWarning : styles.stageNeutral}`}>{m.state}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplyOverviewPage;
