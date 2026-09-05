// T3-2 — Brand ledger (finance). Pick a brand → see its append-only ledger + running balance,
// and record a manual payout-marked entry. Corrections are new adjustment rows (never edits).
import React from 'react';
import { money } from '../../utils/money'; // ACP-2 [KA11-2]
import { brandLedgerApi } from '../../api/adminApi';
import type { BrandSummary, BrandLedgerEntry } from '../../api/adminApi';
import { PageHeader, Badge } from '../../components';
import { Button } from '../../components/Button/Button';
import { Can } from '../../components/Can/Can';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import s from './BrandLedgerPage.module.css';

// ACP-2 [KA11-2]: one money formatter. This page had its own, with
// `maximumFractionDigits: 2` and no minimum — so ₹1,499.50 rendered as "₹1,499.5",
// a ledger column where the paise column was one digit wide on some rows and two on
// others. A ledger is a record that genuinely HAS paise, so it opts into them, and
// gets a consistent two.
const inr = (v: string | number) => money(v, { paise: true });
// ACP-6 [KA11-6]: one date formatter for the admin.
import { fmtDate } from '../../utils/date';

const TYPE_TONE: Record<string, 'success' | 'error' | 'secondary' | 'warning' | 'info'> = {
  sale: 'success',
  refund: 'error',
  stitching_fee: 'secondary',
  fabric_consumption: 'secondary',
  commission: 'secondary',
  payout_marked: 'warning',
  adjustment: 'info',
};

export const BrandLedgerPage: React.FC = () => {
  const [brands, setBrands] = React.useState<BrandSummary[]>([]);
  const [brandId, setBrandId] = React.useState('');
  const [data, setData] = React.useState<{ entries: BrandLedgerEntry[]; balance: number } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const toast = (t: ToastData['type'], title: string, msg?: string) =>
    setToasts((x) => [...x, createToast(t, title, msg)]);
  const dismiss = (id: string) => setToasts((x) => x.filter((y) => y.id !== id));

  React.useEffect(() => {
    brandLedgerApi
      .listBrands()
      .then((r) => {
        setBrands(r.brands);
        // [FIN-36-5] Open on a brand that HAS something to look at.
        //
        // This defaulted to the house brand, whose ledger is empty BY DESIGN — the house
        // brand is not paid out — so the page reliably opened on "Balance owed: ₹0 · No
        // ledger entries yet." while the only brand with entries sat second in the list.
        // An empty first impression on a payouts page reads as "nothing is owed", which is
        // a statement about the business rather than about the default selection.
        //
        // Largest outstanding balance first, because that is the row a finance operator
        // opens this page to act on; then any brand with a non-zero balance; then the old
        // house default, so a genuinely empty ledger still lands somewhere sensible.
        const withBalance = r.brands
          .filter((b) => typeof b.ledger_balance === 'number' && b.ledger_balance !== 0)
          .sort((a, b) => Math.abs(b.ledger_balance ?? 0) - Math.abs(a.ledger_balance ?? 0));
        const pick =
          withBalance[0] ?? r.brands.find((b) => b.is_house_brand) ?? r.brands[0];
        if (pick) setBrandId(pick.id);
      })
      .catch((e) => toast('error', 'Failed to load brands', e instanceof Error ? e.message : undefined));
  }, []);

  const load = React.useCallback((id: string) => {
    if (!id) return;
    setLoading(true);
    brandLedgerApi
      .ledger(id)
      .then(setData)
      .catch((e) => toast('error', 'Failed to load ledger', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => {
    load(brandId);
  }, [brandId, load]);

  const submitPayout = async () => {
    const amt = parseFloat(amount);
    if (!brandId || !(amt > 0)) {
      toast('error', 'Enter a positive payout amount');
      return;
    }
    setSaving(true);
    try {
      await brandLedgerApi.recordPayout(brandId, amt, note || undefined);
      toast('success', `Payout of ${inr(amt)} recorded`);
      setAmount('');
      setNote('');
      load(brandId);
    } catch (err) {
      toast('error', 'Payout failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.page}>
      <PageHeader
        title="Brand ledger"
        subtitle="Append-only money proof per brand — corrections are new adjustment rows, never edits."
      />

      <div className={s.controls}>
        <label className={s.field}>
          <span>Brand</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.is_house_brand ? ' (house)' : ''}
              </option>
            ))}
          </select>
        </label>
        {data && (
          <div className={s.balance}>
            Balance owed: <strong>{inr(data.balance)}</strong>
          </div>
        )}
      </div>

      {/* Recording a payout is a money WRITE — finance operates it; super_admin is read-only. */}
      <Can cap="finance:write">
        <div className={s.payoutForm}>
          <label className={s.field}>
            <span>Mark payout (₹)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className={s.field}>
            <span>Note</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="UTR / reference"
            />
          </label>
          <Button onClick={submitPayout} disabled={saving}>
            {saving ? 'Recording…' : 'Record payout'}
          </Button>
        </div>
      </Can>

      {loading ? (
        <div className={s.muted}>Loading…</div>
      ) : !data ? null : data.entries.length === 0 ? (
        <div className={s.muted}>No ledger entries yet.</div>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th className={s.right}>Amount</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((en) => (
              <tr key={en.id}>
                <td>{fmtDate(en.created_at)}</td>
                <td>
                  <Badge variant={TYPE_TONE[en.entry_type] ?? 'secondary'} size="sm">
                    {en.entry_type.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className={s.right}>{inr(en.amount)}</td>
                <td>{en.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default BrandLedgerPage;
