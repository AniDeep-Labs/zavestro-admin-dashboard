import { useOverviewFilters } from '../../hooks/useOverviewFilters';
import React from 'react';
import { fabricsApi, distributionApi, restockApi, listingRequestsApi, hubsApi } from '../../api/adminApi';
import type { FabricStockRow, Distribution, RestockRequest, ListingRequest, Hub } from '../../api/adminApi';
import { OverviewExceptions } from './OverviewExceptions';
import type { OvTab } from './OverviewExceptions';
import local from './DesignAnalyticsPage.module.css';

// ACP-6 [KA11-6]: one date formatter for the admin.
import { fmtDate } from '../../utils/date';

type Motion = {
  id: string;
  kind: string;
  fabric: string;
  code: string;
  /** [SHL-5-3] The hub's ID — what a filter compares. `hub` below is for READING. */
  hub_id: string;
  hub: string;
  qty: number;
  state: 'In transit' | 'Awaiting procurement';
  created_at: string;
};

// T2-21 (SU-1) retrofit: Supply Overview on the shared exceptions-first shell — stock in motion
// (in-transit deliveries + awaiting-procurement requests), with hub/date filters, CSV and PeekDrawer.
export const SupplyOverviewPage: React.FC = () => {
  const [stock, setStock] = React.useState<FabricStockRow[]>([]);
  const [dist, setDist] = React.useState<Distribution[]>([]);
  const [restock, setRestock] = React.useState<RestockRequest[]>([]);
  const [listing, setListing] = React.useState<ListingRequest[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  // [SHL-5-2] Hub + date window live in the URL, so refresh keeps them, browser-back out
  // of a record returns to the same filtered view, and the view can be SENT to someone.
  const { hubId, startDate, endDate, applyFilter } = useOverviewFilters();

  // [SHL-5-3] Ask the SERVER for the hub, instead of pulling the whole network and
  // sifting it in the browser. All four of these already accepted `hub_id`; the page
  // simply never passed it, so it fetched every hub's rows on every load and then threw
  // most of them away. Fine at seed volume, which is exactly why it would have shipped.
  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    const scope = hubId ? { hub_id: hubId } : {};
    Promise.all([
      fabricsApi.stock(scope),
      distributionApi.list(scope),
      restockApi.list(scope),
      listingRequestsApi.list(scope),
      hubsApi.list(),
    ])
      .then(([s, d, r, l, h]) => { setStock(s); setDist(d); setRestock(r); setListing(l); setHubs(h.hubs); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [hubId]);

  React.useEffect(() => { load(); }, [load]);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';

  const motion = React.useMemo<Motion[]>(() => {
    const rows: Motion[] = [
      ...dist.filter((d) => d.status === 'pushed').map((d, i) => ({ id: `d${i}`, kind: 'Distribution', fabric: d.fabric_name ?? '—', code: d.fabric_code ?? '', hub_id: d.hub_id, hub: hubName(d.hub_id), qty: Number(d.sellable_qty), state: 'In transit' as const, created_at: d.created_at })),
      ...restock.filter((r) => r.status === 'shipped').map((r, i) => ({ id: `rs${i}`, kind: 'Restock', fabric: r.fabric_name, code: r.fabric_code ?? '', hub_id: r.hub_id, hub: hubName(r.hub_id), qty: Number(r.qty), state: 'In transit' as const, created_at: r.created_at })),
      ...listing.filter((l) => l.status === 'approved').map((l, i) => ({ id: `la${i}`, kind: 'Listing', fabric: l.fabric_name, code: l.fabric_code, hub_id: l.hub_id, hub: l.hub_name, qty: Number(l.qty), state: 'In transit' as const, created_at: l.created_at })),
      ...restock.filter((r) => r.status === 'requested').map((r, i) => ({ id: `rr${i}`, kind: 'Restock', fabric: r.fabric_name, code: r.fabric_code ?? '', hub_id: r.hub_id, hub: hubName(r.hub_id), qty: Number(r.qty), state: 'Awaiting procurement' as const, created_at: r.created_at })),
      ...listing.filter((l) => l.status === 'requested').map((l, i) => ({ id: `lr${i}`, kind: 'Listing', fabric: l.fabric_name, code: l.fabric_code, hub_id: l.hub_id, hub: l.hub_name, qty: Number(l.qty), state: 'Awaiting procurement' as const, created_at: l.created_at })),
    ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    // [SHL-5-3] Hub is filtered by ID, and by the SERVER (see `load`). This second pass
    // is a belt-and-braces on the id, not the name: comparing `hubName(hubId)` to a row's
    // rendered hub meant two hubs sharing a name merged silently, and any row whose hub
    // lookup missed rendered '—' and then failed every comparison — dropping rows the
    // operator had not filtered out.
    //
    // Dates stay client-side: none of these endpoints accepts a date range yet. Said
    // plainly rather than left to look server-side like the hub filter now is.
    return rows.filter((m) => {
      if (hubId && m.hub_id !== hubId) return false;
      if (startDate && m.created_at.slice(0, 10) < startDate) return false;
      if (endDate && m.created_at.slice(0, 10) > endDate) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist, restock, listing, hubs, hubId, startDate, endDate]);

  const totalStock = stock.reduce((s, r) => s + Number(r.available_meters), 0);
  const hubCount = new Set(stock.map((s) => s.hub_id)).size;

  const cols = [
    { header: 'Type', cell: (m: Motion) => m.kind },
    { header: 'Fabric', cell: (m: Motion) => m.fabric },
    { header: 'Code', cell: (m: Motion) => m.code || '—' },
    { header: 'Hub', cell: (m: Motion) => m.hub || '—' },
    { header: 'Metres', cell: (m: Motion) => m.qty },
  ];
  const csv = [
    { header: 'Type', value: (m: Motion) => m.kind },
    { header: 'Fabric', value: (m: Motion) => m.fabric },
    { header: 'Code', value: (m: Motion) => m.code },
    { header: 'Hub', value: (m: Motion) => m.hub },
    { header: 'Metres', value: (m: Motion) => m.qty },
    { header: 'Since', value: (m: Motion) => fmtDate(m.created_at) },
  ];
  const peek = (m: Motion) => ({
    title: m.fabric,
    subtitle: `${m.kind} · ${m.hub}`,
    fields: [
      { label: 'Code', value: m.code || '—' },
      { label: 'Hub', value: m.hub || '—' },
      { label: 'Metres', value: m.qty },
      { label: 'State', value: m.state },
      { label: 'Since', value: fmtDate(m.created_at) },
    ],
  });

  const tabs: OvTab<Motion>[] = [
    {
      key: 'in_transit',
      label: 'In transit',
      rows: motion.filter((m) => m.state === 'In transit'),
      rowKey: (m) => m.id,
      columns: cols,
      csv,
      peek,
      emptyBody: 'Nothing is in transit to a hub right now.',
    },
    {
      key: 'awaiting',
      label: 'Awaiting procurement',
      rows: motion.filter((m) => m.state === 'Awaiting procurement'),
      rowKey: (m) => m.id,
      columns: cols,
      csv,
      peek,
      emptyBody: 'No open procurement requests.',
    },
  ];

  const kpis = (
    <div className={local.kpiRow}>
      <div className={local.kpiCard}>
        <span className={local.kpiLabel}>In stock (all hubs)</span>
        <span className={local.kpiValue}>{loading ? '…' : `${totalStock.toLocaleString('en-IN')}m`}</span>
      </div>
      <div className={local.kpiCard}>
        <span className={local.kpiLabel}>Hubs stocked</span>
        <span className={local.kpiValue}>{loading ? '…' : String(hubCount)}</span>
      </div>
    </div>
  );

  return (
    <OverviewExceptions<Motion>
      title="Supply Overview"
      subtitle="Exceptions first — fabric stock in motion: deliveries in transit and requests awaiting procurement."
      loading={loading}
      error={error}
      onRetry={load}
      hubs={hubs}
      hubId={hubId}
      startDate={startDate}
      endDate={endDate}
      onFilter={applyFilter}
      tabs={tabs}
      csvName="supply-overview"
      headerExtra={kpis}
    />
  );
};

export default SupplyOverviewPage;
