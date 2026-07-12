import React from 'react';
import { dispositionApi } from '../../api/adminApi';
import type { DispositionResponse, DispositionKind } from '../../api/adminApi';
import { Can } from '../Can/Can';
import s from './DispositionPanel.module.css';

// T2-12 (O-17): disposition + write-off for a returned / RTO'd made-for-one garment. Shared by
// ReturnDetail (source="return") and OrderDetail when the order is RTO (source="rto").
const OPTIONS: { value: DispositionKind; label: string }[] = [
  { value: 'pending', label: 'Pending decision' },
  { value: 'donate', label: 'Donate' },
  { value: 'scrap', label: 'Scrap (write off)' },
  { value: 'salvage', label: 'Salvage (reuse parts)' },
  { value: 'remake_source', label: 'Remake source (reuse fabric)' },
];

export const DispositionPanel: React.FC<{ orderId: string; source: 'return' | 'rto' }> = ({
  orderId,
  source,
}) => {
  const [data, setData] = React.useState<DispositionResponse | null>(null);
  const [disposition, setDisposition] = React.useState<DispositionKind>('pending');
  const [writeOff, setWriteOff] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(() => {
    dispositionApi
      .get(orderId)
      .then((d) => {
        setData(d);
        if (d.disposition) {
          setDisposition(d.disposition.disposition);
          setWriteOff(String(d.disposition.write_off_amount));
          setNote(d.disposition.note ?? '');
        } else {
          setWriteOff(String(d.suggested_write_off));
        }
      })
      .catch(() => {});
  }, [orderId]);
  React.useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        source,
        disposition,
        write_off_amount: writeOff.trim() === '' ? undefined : Number(writeOff),
        note: note.trim() || undefined,
      };
      const d = await dispositionApi.set(orderId, body);
      setData(d);
      setMsg({ ok: true, text: 'Disposition saved' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.panel}>
      <h3 className={s.title}>Garment disposition</h3>
      <p className={s.hint}>
        A made-for-one garment can't be resold — record what happens to it and the ₹ written off.
      </p>
      {data && (
        <p className={s.cost}>
          Suggested write-off <strong>₹{data.suggested_write_off.toLocaleString('en-IN')}</strong>{' '}
          <span className={s.costBreak}>
            (fabric ₹{data.fabric_cost.toLocaleString('en-IN')} + make ₹
            {data.make_cost.toLocaleString('en-IN')})
          </span>
        </p>
      )}
      <div className={s.row}>
        <label className={s.field}>
          <span className={s.label}>Disposition</span>
          <select
            className={s.input}
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as DispositionKind)}
          >
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          <span className={s.label}>Write-off ₹</span>
          <input
            className={s.input}
            type="number"
            min="0"
            value={writeOff}
            onChange={(e) => setWriteOff(e.target.value)}
          />
        </label>
      </div>
      <label className={s.field}>
        <span className={s.label}>Note (optional)</span>
        <input
          className={s.input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. donated to shelter / fabric reclaimed for order #…"
        />
      </label>
      <Can
        cap="refunds:approve"
        fallback={<p className={s.hint}>Finance (refunds:approve) records the disposition + write-off.</p>}
      >
        <button className={s.saveBtn} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : data?.disposition ? 'Update disposition' : 'Record disposition'}
        </button>
      </Can>
      {msg && <p className={msg.ok ? s.ok : s.err}>{msg.text}</p>}
    </div>
  );
};

export default DispositionPanel;
