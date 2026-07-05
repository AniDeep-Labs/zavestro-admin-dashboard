import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fabricsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { FabricAtHub, FabricMovement, FabricStockMovement } from '../../api/adminApi';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import baseCss from './OrdersListPage.module.css';
import s from './FabricAtHubPage.module.css';
import kpi from './CodReconciliationPage.module.css';
import { UilArrowLeft, UilImage } from '@iconscout/react-unicons';
import { StatusBadge } from '../../components';
import { Can } from '../../components/Can/Can';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';

const url = (k?: string) => (k && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${k}` : '');

const KIND_LABEL: Record<string, string> = { distribution: 'Distributed', restock: 'Restock', listing: 'Fabric for listing' };
// Movement status → canonical StatusBadge key (for tone) + flow-specific label.
const STATUS_META: Record<string, { key: string; label: string }> = {
  pushed: { key: 'in_transit', label: 'Sent · in transit' },
  received: { key: 'received', label: 'Received · in stock' },
  requested: { key: 'requested', label: 'Requested' },
  shipped: { key: 'in_transit', label: 'Sent · in transit' },
  fulfilled: { key: 'received', label: 'Received · in stock' },
  approved: { key: 'in_transit', label: 'Sent · in transit' },
  cancelled: { key: 'cancelled', label: 'Cancelled' },
  rejected: { key: 'rejected', label: 'Rejected' },
};

export const FabricAtHubPage: React.FC = () => {
  const { hubId, fabricId } = useParams<{ hubId: string; fabricId: string }>();
  const navigate = useNavigate();
  // Back to wherever we came from (Cross-hub Stock OR a Distribution row), not always stock.
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/admin/procurement/stock'));
  const [data, setData] = React.useState<FabricAtHub | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [imgBroken, setImgBroken] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  // T1-10: count / adjust the hub shelf to the physical truth.
  const [countOpen, setCountOpen] = React.useState(false);
  const [counted, setCounted] = React.useState('');
  const [countNote, setCountNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    if (!hubId || !fabricId) return;
    fabricsApi
      .atHub(hubId, fabricId)
      .then(setData)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [hubId, fabricId]);

  React.useEffect(() => { load(); }, [load]);

  const submitCount = async () => {
    if (!hubId || !fabricId) return;
    const m = Number(counted);
    if (!(m >= 0)) return toast('error', 'Enter the counted metres');
    if (!countNote.trim()) return toast('error', 'A reason is required');
    setSaving(true);
    try {
      const res = await fabricsApi.adjustHubStock({ hub_id: hubId, fabric_id: fabricId, counted_meters: m, note: countNote.trim() });
      setData(res.at_hub);
      const v = res.variance;
      toast('success', 'Shelf count recorded', v === 0 ? 'No variance — ledger matched the shelf.' : `Ledger corrected by ${v > 0 ? '+' : ''}${v}m.`);
      setCountOpen(false); setCounted(''); setCountNote('');
    } catch (e) {
      toast('error', 'Count failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={baseCss.page}><div className={s.center}><Spinner /></div></div>;
  if (!data) return <div className={baseCss.page}><div className={s.center}>Not found.</div></div>;

  const f = data.fabric;
  const hero = url(f.image_keys?.[0]);
  const avail = Number(data.stock.available_meters);
  const reserved = Number(data.stock.reserved_meters);
  const ppm = f.price_per_meter != null ? Number(f.price_per_meter) : null;
  const capital = ppm != null ? Math.round(avail * ppm) : null;
  const reorder = data.stock.reorder_meters != null ? Number(data.stock.reorder_meters) : null;
  const belowReorder = reorder != null && avail < reorder;

  // True stock ledger (mig 120): in/out with running balance.
  const STOCK_KIND: Record<string, { label: string; tone: string }> = {
    received: { label: 'Received', tone: 'received' },
    in: { label: 'Stock in', tone: 'received' },
    released: { label: 'Released', tone: 'active' },
    reserved: { label: 'Reserved', tone: 'qc' },
    reconciled: { label: 'Reconciled (cut)', tone: 'in_transit' },
    out: { label: 'Stock out', tone: 'qc' },
    count_adjust: { label: 'Count adjust', tone: 'active' },
  };
  const ledgerRow = (m: FabricStockMovement, i: number) => {
    const meta = STOCK_KIND[m.kind] ?? { label: m.kind, tone: m.kind };
    const delta = Number(m.delta_meters);
    return (
      <div key={`sm-${i}`} className={s.move}>
        <div className={s.moveDot} />
        <div className={s.moveBody}>
          <div className={s.moveTop}>
            <StatusBadge status={meta.tone} label={meta.label} size="sm" />
            <strong>{delta > 0 ? `+${delta}` : delta}m</strong>
          </div>
          <div className={s.moveMeta}>
            balance after: <strong>{Number(m.balance_after)}m</strong>
            {m.lot_code ? ` · lot ${m.lot_code}` : ''}
            {m.note ? ` · “${m.note}”` : ''}
          </div>
          <div className={s.moveTime}>{new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    );
  };
  const line = (m: FabricMovement) => {
    const meta = STATUS_META[m.status] ?? { key: m.status, label: m.status };
    return (
      <div key={`${m.kind}-${m.id}`} className={s.move}>
        <div className={s.moveDot} />
        <div className={s.moveBody}>
          <div className={s.moveTop}>
            <strong>{KIND_LABEL[m.kind] ?? m.kind}</strong>
            <StatusBadge status={meta.key} label={meta.label} />
          </div>
          <div className={s.moveMeta}>
            {Number(m.qty)}m{m.design_name ? ` · for ${m.design_name}` : ''}
            {m.note ? ` · “${m.note}”` : ''}
          </div>
          <div className={s.moveTime}>{new Date(m.updated_at || m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={baseCss.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <button type="button" onClick={goBack} className={s.back}><UilArrowLeft size={16} /> Back to stock</button>

      <div className={s.head}>
        <div className={s.swatch}>{hero && !imgBroken ? <img src={hero} alt={f.name} onError={() => setImgBroken(true)} /> : <UilImage size={28} />}</div>
        <div className={s.headInfo}>
          <div className={s.code}>{f.code}{f.color_name ? ` · ${f.color_name}` : ''}</div>
          <h1 className={s.name}>
            <Link to={`/admin/procurement/fabrics/${fabricId}`} className={s.nameLink}>{f.name}</Link>
          </h1>
          <div className={s.sub}>{f.composition}{f.weave ? ` · ${f.weave}` : ''} · at <strong>{data.hub_name}</strong></div>
        </div>
      </div>

      <div className={kpi.summary}>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Available</div>
          <div className={kpi.summaryValue}>{avail.toLocaleString('en-IN')} m</div>
        </div>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Reserved</div>
          <div className={kpi.summaryValue}>{reserved.toLocaleString('en-IN')} m</div>
        </div>
        {Number(data.stock.quarantine_meters ?? 0) > 0 && (
          <div className={kpi.summaryCard}>
            <div className={kpi.summaryLabel}>Quarantine (QC hold)</div>
            <div className={kpi.summaryValue}>{Number(data.stock.quarantine_meters).toLocaleString('en-IN')} m</div>
          </div>
        )}
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Capital (avail)</div>
          <div className={kpi.summaryValue}>{capital != null ? `₹${capital.toLocaleString('en-IN')}` : '—'}</div>
        </div>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Reorder at</div>
          <div className={`${kpi.summaryValue} ${belowReorder ? s.belowReorder : ''}`}>
            {reorder != null ? `${reorder.toLocaleString('en-IN')} m` : '—'}{belowReorder ? ' · low' : ''}
          </div>
        </div>
      </div>

      {/* T1-10: count / adjust the shelf to the physical truth. */}
      <Can cap="distribution:write">
        <div className={s.countBar}>
          <span className={s.countMeta}>
            Last counted: {data.stock.last_counted_at
              ? new Date(data.stock.last_counted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'never'}
          </span>
          {!countOpen ? (
            <Button variant="outline" onClick={() => { setCounted(String(avail)); setCountOpen(true); }}>
              Count / adjust shelf
            </Button>
          ) : (
            <div className={s.countForm}>
              <Input label="Counted metres on the shelf" type="number" value={counted} onChange={setCounted} placeholder={`ledger says ${avail}`} />
              <Input label="Reason / note" value={countNote} onChange={setCountNote} placeholder="e.g. monthly count · mis-scan on receive" />
              <div className={s.countActions}>
                <Button variant="ghost" onClick={() => { setCountOpen(false); setCountNote(''); }}>Cancel</Button>
                <Button onClick={submitCount} state={saving ? 'loading' : 'default'}>Record count</Button>
              </div>
            </div>
          )}
        </div>
      </Can>

      <div className={s.cols}>
        <section>
          <h3 className={s.sectionTitle}>Stock ledger <span className={s.sectionHint}>· every metre in &amp; out, with running balance</span></h3>
          {!data.stock_movements || data.stock_movements.length === 0 ? (
            avail > 0 ? (
              // T1-26: only call it an "Opening balance" if the stock genuinely predates the
              // movement ledger. Otherwise the ledger doesn't explain the on-hand figure — show
              // "Unreconciled" (don't dress up an unexplained discrepancy as explained).
              <div className={s.timeline}>
                <div className={s.move}>
                  <div className={s.moveDot} />
                  <div className={s.moveBody}>
                    <div className={s.moveTop}>
                      {data.opening_reconciled === false ? (
                        <StatusBadge status="blocked" label="Unreconciled" size="sm" />
                      ) : (
                        <StatusBadge status="received" label="Opening balance" size="sm" />
                      )}
                      <strong>{avail}m</strong>
                    </div>
                    <div className={s.moveMeta}>
                      balance: <strong>{avail}m</strong> ·{' '}
                      {data.opening_reconciled === false
                        ? 'no ledger movement explains this on-hand stock — count/adjust to reconcile'
                        : 'recorded before the movement ledger — new movements appear here'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={s.empty}>No stock movements yet — appears when fabric is received, reserved, or released here.</div>
            )
          ) : (
            <div className={s.timeline}>{data.stock_movements.map(ledgerRow)}</div>
          )}
        </section>

        <section>
          <h3 className={s.sectionTitle}>Request history <span className={s.sectionHint}>· distribution / restock / listing</span></h3>
          {data.movements.length === 0 ? (
            <div className={s.empty}>No requests recorded for this fabric at this hub.</div>
          ) : (
            <div className={s.timeline}>{data.movements.map(line)}</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FabricAtHubPage;
