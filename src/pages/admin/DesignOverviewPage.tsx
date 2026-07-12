import React from 'react';
import { designsApi, hubsApi } from '../../api/adminApi';
import type { DesignExceptions, DesignExceptionRow, Hub } from '../../api/adminApi';
import { OverviewExceptions } from './OverviewExceptions';
import type { OvTab } from './OverviewExceptions';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// T2-21 (SU-1): exceptions-first Design overview — the money leaks super needs to see without
// entering the Design console: published designs no one listed, and published designs no one buys.
export const DesignOverviewPage: React.FC = () => {
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [data, setData] = React.useState<DesignExceptions | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [hubId, setHubId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    designsApi
      .overviewExceptions({ hub_id: hubId || undefined, start_date: startDate || undefined, end_date: endDate || undefined })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [hubId, startDate, endDate]);

  React.useEffect(() => { load(); }, [load]);

  const peek = (r: DesignExceptionRow) => ({
    title: r.name,
    subtitle: r.garment_type,
    fields: [
      { label: 'Gender', value: r.gender ?? '—' },
      { label: 'Published', value: fmtDate(r.created_at) },
      { label: 'Days published', value: `${r.days_published}d` },
      { label: 'Live hubs', value: r.live_hub_count },
      { label: 'Units sold', value: r.units_sold },
    ],
  });

  const tabs: OvTab<DesignExceptionRow>[] = [
    {
      key: 'never_listed',
      label: 'Published · never listed',
      rows: data?.published_never_listed ?? [],
      rowKey: (r) => r.id,
      columns: [
        { header: 'Design', cell: (r) => r.name },
        { header: 'Garment', cell: (r) => r.garment_type },
        { header: 'Gender', cell: (r) => r.gender ?? '—' },
        { header: 'Days published', cell: (r) => `${r.days_published}d` },
      ],
      csv: [
        { header: 'Design', value: (r) => r.name },
        { header: 'Garment', value: (r) => r.garment_type },
        { header: 'Gender', value: (r) => r.gender ?? '' },
        { header: 'Published', value: (r) => fmtDate(r.created_at) },
        { header: 'Days published', value: (r) => r.days_published },
      ],
      peek,
      emptyBody: 'Every published design is listed somewhere.',
    },
    {
      key: 'aging',
      label: `Aging (${data?.aging_days ?? 30}d, unsold)`,
      rows: data?.aging ?? [],
      rowKey: (r) => r.id,
      columns: [
        { header: 'Design', cell: (r) => r.name },
        { header: 'Garment', cell: (r) => r.garment_type },
        { header: 'Days published', cell: (r) => `${r.days_published}d` },
        { header: 'Live hubs', cell: (r) => r.live_hub_count },
      ],
      csv: [
        { header: 'Design', value: (r) => r.name },
        { header: 'Garment', value: (r) => r.garment_type },
        { header: 'Published', value: (r) => fmtDate(r.created_at) },
        { header: 'Days published', value: (r) => r.days_published },
        { header: 'Live hubs', value: (r) => r.live_hub_count },
        { header: 'Units sold', value: (r) => r.units_sold },
      ],
      peek,
      emptyBody: 'No published design has aged without a sale.',
    },
  ];

  return (
    <OverviewExceptions<DesignExceptionRow>
      title="Design Overview"
      subtitle="Exceptions first — published designs that never got listed, and published designs that never sold."
      loading={loading}
      error={error}
      onRetry={load}
      hubs={hubs}
      hubId={hubId}
      startDate={startDate}
      endDate={endDate}
      onFilter={(p) => {
        if (p.hubId !== undefined) setHubId(p.hubId);
        if (p.startDate !== undefined) setStartDate(p.startDate);
        if (p.endDate !== undefined) setEndDate(p.endDate);
      }}
      tabs={tabs}
      csvName="design-overview"
    />
  );
};

export default DesignOverviewPage;
