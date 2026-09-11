import { useOverviewFilters } from '../../hooks/useOverviewFilters';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { money } from '../../utils/money';
import { ordersApi, financeApi, hubsApi, hasCapability } from '../../api/adminApi';
import type { AdminOrder, Hub, SettlementReport, SettlementHub } from '../../api/adminApi';
import { OverviewExceptions } from './OverviewExceptions';
import type { OvTab } from './OverviewExceptions';

/**
 * [SHL-5-5] The oversight shell, extended into orders and money.
 *
 * `SA-L7` asks whether the overviews cover the whole business — design → supply → listings →
 * orders → money → hub constraints. Design, listings, supply and hub constraints were present;
 * orders and money were not, so the founder's exceptions-first view stopped exactly where the
 * money starts. Super held `orders:read` and got the raw list; it held `finance:read` and got
 * finance's OPERATING pages, not an oversight framing.
 *
 * Composition, not new machinery: this is the same `OverviewExceptions` shell the other three
 * use, so filters, tab-in-URL, CSV and the peek drawer come for free.
 *
 * ⚠️ TWO OF THE FIVE TABS THE FINDING ASKS FOR ARE NOT HERE, and the reason is a capability
 * boundary rather than effort. "Refunds outstanding" and "COD undeposited" both read endpoints
 * gated on `refunds:approve`, which **super_admin does not hold** — it has `orders:read`,
 * `customers:read`, `reports:read`, `finance:read`, `system:manage`, `staff:manage`, `qc:write`.
 * Adding them would 403 for the exact role this page exists for. Widening those reads is a
 * who-may-see decision, so it is flagged rather than taken. See [SHL-1-6] for the same shape.
 */
const inr = (n: number) => money(n);

import { ageHours, agedOrders, AGED_DAYS } from './ordersMoneyStats';

export const OrdersMoneyOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [stuck, setStuck] = React.useState<AdminOrder[]>([]);
  const [open, setOpen] = React.useState<AdminOrder[]>([]);
  const [settlement, setSettlement] = React.useState<SettlementReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  // [RC-3] The hub list feeds the FILTER, not the table, so a failure here must not blank the
  // page — but it must not be discarded either: an empty hub dropdown is indistinguishable
  // from "this deployment has no hubs", and the operator would filter by nothing and believe
  // they had filtered by something.
  const [hubsErr, setHubsErr] = React.useState(false);
  const { hubId, startDate, endDate, applyFilter } = useOverviewFilters();

  const canMoney = hasCapability('finance:read');

  React.useEffect(() => {
    hubsApi
      .list()
      .then((r) => {
        setHubs(r.hubs);
        setHubsErr(false);
      })
      .catch(() => setHubsErr(true));
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    const scope = { hub_id: hubId || undefined, from: startDate || undefined, to: endDate || undefined };
    Promise.all([
      // `stuck` is decided SERVER-side (T2-17) — the same predicate the orders list and the
      // nav badge use, so this page cannot disagree with them about what "stuck" means.
      ordersApi.list({ ...scope, stuck: true, limit: 200 }),
      ordersApi.list({ ...scope, limit: 200 }),
      canMoney ? financeApi.settlement(scope) : Promise.resolve(null),
    ])
      .then(([s, o, f]) => {
        setStuck(s.orders);
        setOpen(o.orders);
        setSettlement(f);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [hubId, startDate, endDate, canMoney]);

  React.useEffect(load, [load]);

  const openOrder = (o: AdminOrder) => navigate(`/admin/orders/${o.uuid ?? o.id}`);

  // Aged: still moving through the floor and older than the threshold. Delivered and
  // cancelled orders are not exceptions however old they are.
  const aged = agedOrders(open);

  const orderTab = (key: string, label: string, rows: AdminOrder[], emptyBody: string): OvTab<AdminOrder> => ({
    key,
    label,
    rows,
    rowKey: (o) => o.id,
    emptyBody,
    columns: [
      { header: 'Order', cell: (o) => o.reference_id ?? o.id },
      { header: 'Stage', cell: (o) => o.stage },
      { header: 'Hub', cell: (o) => o.hub || '—' },
      { header: 'Age', cell: (o) => `${Math.floor(ageHours(o) / 24)}d` },
      { header: 'Value', cell: (o) => inr(o.total) },
    ],
    csv: [
      { header: 'Order', value: (o) => o.reference_id ?? o.id },
      { header: 'Stage', value: (o) => o.stage },
      { header: 'Hub', value: (o) => o.hub || '' },
      { header: 'Age (hours)', value: (o) => ageHours(o) },
      { header: 'Value', value: (o) => o.total },
    ],
    peek: (o) => ({
      title: o.reference_id ?? o.id,
      subtitle: o.hub || undefined,
      status: o.stage,
      fields: [
        { label: 'Age in stage', value: `${ageHours(o)}h` },
        { label: 'Value', value: inr(o.total) },
        { label: 'Payment', value: o.payment_method ?? '—' },
        { label: 'Owner', value: o.exception_owner ?? 'Unowned' },
      ],
      fullLink: { label: 'Open order', onClick: () => openOrder(o) },
    }),
  });

  const tabs: OvTab<never>[] = [
    orderTab('stuck', 'Stuck', stuck, 'No order is stuck — every one is moving.'),
    orderTab('aged', `Aged > ${AGED_DAYS}d`, aged, `Nothing has been on the floor longer than ${AGED_DAYS} days.`),
  ] as unknown as OvTab<never>[];

  if (canMoney && settlement) {
    // The settlement gap: what the books expect to be deposited against what actually was.
    // A non-zero variance is the exception — it is the number that says the money moved
    // differently from the way the orders say it did.
    const rows: SettlementHub[] = settlement.hubs ?? [];
    const moneyTab: OvTab<SettlementHub> = {
      key: 'settlement',
      label: 'Settlement',
      rows,
      rowKey: (h) => h.hub_id ?? 'unassigned',
      emptyBody: 'No online settlement in this window.',
      columns: [
        { header: 'Hub', cell: (h) => h.hub_name ?? 'Unassigned' },
        { header: 'Orders', cell: (h) => h.orders },
        { header: 'Gross online', cell: (h) => inr(h.gross_online) },
        { header: 'Refunded', cell: (h) => inr(h.refunded) },
        { header: 'Net settled', cell: (h) => inr(h.net_settled) },
      ],
      csv: [
        { header: 'Hub', value: (h) => h.hub_name ?? 'Unassigned' },
        { header: 'Orders', value: (h) => h.orders },
        { header: 'Gross online', value: (h) => h.gross_online },
        { header: 'Refunded', value: (h) => h.refunded },
        { header: 'Net settled', value: (h) => h.net_settled },
      ],
      peek: (h) => ({
        title: h.hub_name ?? 'Unassigned',
        fields: [
          { label: 'Orders', value: String(h.orders) },
          { label: 'Gross online', value: inr(h.gross_online) },
          { label: 'Refunded', value: inr(h.refunded) },
          { label: 'Net settled', value: inr(h.net_settled) },
        ],
      }),
    };
    tabs.push(moneyTab as unknown as OvTab<never>);
  }

  const recon = settlement?.reconciliation;

  return (
    <OverviewExceptions<never>
      title="Orders & money"
      subtitle="Where orders stall, and where the money does not match them."
      loading={loading}
      error={error}
      onRetry={load}
      hubs={hubs}
      hubId={hubId}
      startDate={startDate}
      endDate={endDate}
      onFilter={applyFilter}
      tabs={tabs}
      csvName="orders-money-overview"
      headerExtra={
        hubsErr ? (
          <p>
            The hub list could not be loaded, so the hub filter is empty — that is a loading
            failure, not a deployment without hubs. Figures below are unfiltered by hub.
          </p>
        ) : recon ? (
          <p>
            Book expects {inr(recon.book.expected_deposit)} deposited; {inr(recon.actual.net_deposited)}{' '}
            actually arrived — variance {inr(recon.variance)} across {recon.settlements} settlement
            {recon.settlements === 1 ? '' : 's'}.
          </p>
        ) : undefined
      }
    />
  );
};

export default OrdersMoneyOverviewPage;
