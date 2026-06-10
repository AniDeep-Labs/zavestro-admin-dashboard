import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { fabricsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { FabricAtHub, FabricMovement } from '../../api/adminApi';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import baseCss from './OrdersListPage.module.css';
import s from './FabricAtHubPage.module.css';
import { UilArrowLeft, UilImage } from '@iconscout/react-unicons';

const url = (k?: string) => (k && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${k}` : '');

const KIND_LABEL: Record<string, string> = { distribution: 'Distributed', restock: 'Restock', listing: 'Fabric for listing' };
// is the metre actually in stock at this hub for this movement's status?
const STATUS_META: Record<string, { label: string; css: string }> = {
  pushed: { label: 'Sent · in transit', css: 'stageWarning' },
  received: { label: 'Received · in stock', css: 'stageSuccess' },
  requested: { label: 'Requested', css: 'stageNeutral' },
  shipped: { label: 'Sent · in transit', css: 'stageWarning' },
  fulfilled: { label: 'Received · in stock', css: 'stageSuccess' },
  approved: { label: 'Sent · in transit', css: 'stageWarning' },
  cancelled: { label: 'Cancelled', css: 'stageNeutral' },
  rejected: { label: 'Rejected', css: 'stageNeutral' },
};

export const FabricAtHubPage: React.FC = () => {
  const { hubId, fabricId } = useParams<{ hubId: string; fabricId: string }>();
  const [data, setData] = React.useState<FabricAtHub | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));

  React.useEffect(() => {
    if (!hubId || !fabricId) return;
    fabricsApi
      .atHub(hubId, fabricId)
      .then(setData)
      .catch((e) => setToasts((t) => [...t, createToast('error', 'Load failed', e instanceof Error ? e.message : undefined)]))
      .finally(() => setLoading(false));
  }, [hubId, fabricId]);

  if (loading) return <div className={baseCss.page}><div className={s.center}><Spinner /></div></div>;
  if (!data) return <div className={baseCss.page}><div className={s.center}>Not found.</div></div>;

  const f = data.fabric;
  const hero = url(f.image_keys?.[0]);
  const line = (m: FabricMovement) => {
    const meta = STATUS_META[m.status] ?? { label: m.status, css: 'stageNeutral' };
    return (
      <div key={`${m.kind}-${m.id}`} className={s.move}>
        <div className={s.moveDot} />
        <div className={s.moveBody}>
          <div className={s.moveTop}>
            <strong>{KIND_LABEL[m.kind] ?? m.kind}</strong>
            <span className={`${baseCss.stagePill} ${baseCss[meta.css]}`}>{meta.label}</span>
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
      <Link to="/admin/procurement/stock" className={s.back}><UilArrowLeft size={16} /> Back to stock</Link>

      <div className={s.head}>
        <div className={s.swatch}>{hero ? <img src={hero} alt={f.name} /> : <UilImage size={28} />}</div>
        <div className={s.headInfo}>
          <div className={s.code}>{f.code}{f.color_name ? ` · ${f.color_name}` : ''}</div>
          <h1 className={s.name}>{f.name}</h1>
          <div className={s.sub}>{f.composition}{f.weave ? ` · ${f.weave}` : ''} · at <strong>{data.hub_name}</strong></div>
        </div>
        <div className={s.stockBox}>
          <div className={s.stockNum}>{Number(data.stock.available_meters)}<span>m</span></div>
          <div className={s.stockLabel}>available{Number(data.stock.reserved_meters) > 0 ? ` · ${Number(data.stock.reserved_meters)}m reserved` : ''}</div>
        </div>
      </div>

      <h3 className={s.sectionTitle}>Movement timeline</h3>
      {data.movements.length === 0 ? (
        <div className={s.empty}>No movements recorded for this fabric at this hub.</div>
      ) : (
        <div className={s.timeline}>{data.movements.map(line)}</div>
      )}
    </div>
  );
};

export default FabricAtHubPage;
