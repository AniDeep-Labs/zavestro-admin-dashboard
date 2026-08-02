// T3-2 — Brand ledger (finance). Pick a brand → see its append-only ledger + running balance,
// and record a manual payout-marked entry. Corrections are new adjustment rows (never edits).
import React from 'react';
import { brandLedgerApi } from '../../api/adminApi';
import type { BrandSummary, BrandLedgerEntry } from '../../api/adminApi';
import { PageHeader, Badge } from '../../components';
import { Button } from '../../components/Button/Button';
import { Can } from '../../components/Can/Can';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import s from './BrandLedgerPage.module.css';

const inr = (v: string | number) =>
  `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

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
        const house = r.brands.find((b) => b.is_house_brand) ?? r.brands[0];
        if (house) setBrandId(house.id);
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
