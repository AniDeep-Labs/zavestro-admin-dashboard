import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { fabricsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { Fabric } from '../../api/adminApi';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './FabricPdpPage.module.css';
import { UilArrowLeft, UilImage } from '@iconscout/react-unicons';

const url = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

const Spec: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value === null || value === undefined || value === '' ? null : (
    <div className={s.specRow}><dt>{label}</dt><dd>{value}</dd></div>
  );

export const FabricPdpPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [fabric, setFabric] = React.useState<Fabric | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState(0);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));

  React.useEffect(() => {
    if (!id) return;
    fabricsApi
      .get(id)
      .then(setFabric)
      .catch((e) => setToasts((t) => [...t, createToast('error', 'Load failed', e instanceof Error ? e.message : undefined)]))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={base.page}><div className={s.center}><Spinner /></div></div>;
  if (!fabric) return (
    <div className={base.page}>
      <Link to="/admin/procurement/fabrics" className={s.back}><UilArrowLeft size={16} /> Back</Link>
      <div className={s.center}>Fabric not found.</div>
    </div>
  );

  const imgs = (fabric.image_keys ?? []).map(url).filter(Boolean);

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Link to="/admin/procurement/fabrics" className={s.back}><UilArrowLeft size={16} /> Back to Fabrics Master</Link>

      <div className={s.layout}>
        {/* Gallery */}
        <div className={s.gallery}>
          {imgs.length === 0 ? (
            <div className={s.heroEmpty}><UilImage size={32} /><span>No swatch image</span></div>
          ) : (
            <>
              <a href={imgs[active]} target="_blank" rel="noreferrer" className={s.hero}>
                <img src={imgs[active]} alt={fabric.name} />
              </a>
              {imgs.length > 1 && (
                <div className={s.thumbs}>
                  {imgs.map((u, i) => (
                    <button key={u} type="button" className={`${s.thumb} ${i === active ? s.thumbActive : ''}`} onClick={() => setActive(i)}>
                      <img src={u} alt={`${fabric.name} ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Details */}
        <div className={s.details}>
          <div className={s.codeRow}>
            <span className={s.code}>{fabric.code}</span>
            <span className={`${base.stagePill} ${fabric.is_active ? base.stageSuccess : base.stageNeutral}`}>
              {fabric.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <h1 className={s.name}>{fabric.name}{fabric.color_name ? <span className={s.color}> · {fabric.color_name}</span> : null}</h1>
          {fabric.price_per_meter && <div className={s.price}>₹{Number(fabric.price_per_meter).toLocaleString('en-IN')}<span> / metre</span></div>}

          <dl className={s.specs}>
            <Spec label="Composition" value={fabric.composition} />
            <Spec label="Weave" value={fabric.weave} />
            <Spec label="Finish" value={fabric.finish} />
            <Spec label="Weight" value={fabric.weight_gsm ? `${fabric.weight_gsm} gsm` : null} />
            <Spec label="Origin" value={fabric.origin} />
            <Spec label="Supplier / mill" value={fabric.supplier} />
            <Spec label="Care" value={fabric.care_instructions?.length ? fabric.care_instructions.join(' · ') : null} />
          </dl>

          <div className={s.usedBy}>
            Used by <strong>{fabric.design_count ?? 0}</strong> design{(fabric.design_count ?? 0) === 1 ? '' : 's'} · <strong>{fabric.listing_count ?? 0}</strong> listing{(fabric.listing_count ?? 0) === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FabricPdpPage;
