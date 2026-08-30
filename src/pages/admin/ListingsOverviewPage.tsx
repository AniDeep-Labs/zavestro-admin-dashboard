import { useOverviewFilters } from '../../hooks/useOverviewFilters';
import React from 'react';
import { money } from '../../utils/money'; // ACP-2 [KA11-2]
import { listingsAdminApi, hubsApi } from '../../api/adminApi';
import type { ListingExceptions, ListingOosRow, ListingBelowFloorRow, Hub } from '../../api/adminApi';
import { OverviewExceptions } from './OverviewExceptions';
import type { OvTab } from './OverviewExceptions';

// ACP-2 [KA11-2]: one money formatter (was a local copy).
const inr = (n: number) => money(n);

// T2-21 (SU-1): exceptions-first Listings overview — live listings that can't be fulfilled
// (out of stock) or that lose money (priced below the cost floor).
export const ListingsOverviewPage: React.FC = () => {
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [data, setData] = React.useState<ListingExceptions | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  // [SHL-5-2] Hub + date window live in the URL, so refresh keeps them, browser-back out
  // of a record returns to the same filtered view, and the view can be SENT to someone.
  const { hubId, startDate, endDate, applyFilter } = useOverviewFilters();

  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    listingsAdminApi
      .overviewExceptions({ hub_id: hubId || undefined, start_date: startDate || undefined, end_date: endDate || undefined })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [hubId, startDate, endDate]);

  React.useEffect(() => { load(); }, [load]);

  const oosTab: OvTab<ListingOosRow> = {
    key: 'oos',
    label: 'Live · out of stock',
    rows: data?.live_but_oos ?? [],
    rowKey: (r) => r.listing_id,
    columns: [
      { header: 'Design', cell: (r) => r.design_name },
      { header: 'Hub', cell: (r) => r.hub_name },
      { header: 'Price', cell: (r) => inr(r.price) },
      { header: 'In stock', cell: (r) => `${r.available_meters}m / needs ${r.meters_per_garment}m` },
    ],
    csv: [
      { header: 'Design', value: (r) => r.design_name },
      { header: 'Hub', value: (r) => r.hub_name },
      { header: 'Price', value: (r) => r.price },
      { header: 'Available metres', value: (r) => r.available_meters },
      { header: 'Metres per garment', value: (r) => r.meters_per_garment },
    ],
    peek: (r) => ({
      title: r.design_name,
      subtitle: `${r.hub_name} · live but out of stock`,
      fields: [
        { label: 'Price', value: inr(r.price) },
        { label: 'Available', value: `${r.available_meters}m` },
        { label: 'Needs per garment', value: `${r.meters_per_garment}m` },
      ],
    }),
    emptyBody: 'Every live listing can cover at least one garment.',
  };

  const floorTab: OvTab<ListingBelowFloorRow> = {
    key: 'below_floor',
    label: 'Below cost floor',
    rows: data?.below_floor ?? [],
    rowKey: (r) => r.listing_id,
    columns: [
      { header: 'Design', cell: (r) => r.design_name },
      { header: 'Hub', cell: (r) => r.hub_name },
      { header: 'Price', cell: (r) => inr(r.price) },
      { header: 'Cost floor', cell: (r) => inr(r.cost_floor) },
      { header: 'Loss/unit', cell: (r) => inr(r.cost_floor - r.price) },
    ],
    csv: [
      { header: 'Design', value: (r) => r.design_name },
      { header: 'Hub', value: (r) => r.hub_name },
      { header: 'Price', value: (r) => r.price },
      { header: 'Cost floor', value: (r) => r.cost_floor },
      { header: 'Loss per unit', value: (r) => r.cost_floor - r.price },
    ],
    peek: (r) => ({
      title: r.design_name,
      subtitle: `${r.hub_name} · priced below cost`,
      fields: [
        { label: 'Price', value: inr(r.price) },
        { label: 'Cost floor', value: inr(r.cost_floor) },
        { label: 'Loss per unit', value: inr(r.cost_floor - r.price) },
      ],
    }),
    emptyBody: 'No live listing is priced below its cost floor.',
  };

  // Two tabs carry different row types; the shell is generic per-tab, so widen at the boundary.
  const tabs = [oosTab, floorTab] as unknown as OvTab<ListingOosRow & ListingBelowFloorRow>[];

  return (
    <OverviewExceptions<ListingOosRow & ListingBelowFloorRow>
      title="Listings Overview"
      subtitle="Exceptions first — live listings that can't be fulfilled or that lose money on every sale."
      loading={loading}
      error={error}
      onRetry={load}
      hubs={hubs}
      hubId={hubId}
      startDate={startDate}
      endDate={endDate}
      onFilter={applyFilter}
      tabs={tabs}
      csvName="listings-overview"
    />
  );
};

export default ListingsOverviewPage;
