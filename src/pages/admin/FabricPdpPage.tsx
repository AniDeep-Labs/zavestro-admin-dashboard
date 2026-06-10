import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { fabricsApi, designsApi, hubsApi, sampleJobsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { Fabric, DesignSummary, Hub } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
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

export const FabricPdpPage: React.FC<{ mode?: 'procurement' | 'design' }> = ({ mode = 'procurement' }) => {
  const { id } = useParams<{ id: string }>();
  const isDesign = mode === 'design';
  const backPath = isDesign ? '/admin/design/fabrics' : '/admin/procurement/fabrics';
  const [fabric, setFabric] = React.useState<Fabric | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState(0);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));

  // design-mode: compare + request-sample
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [selDesign, setSelDesign] = React.useState('');
  const [selHub, setSelHub] = React.useState('');
  const [requesting, setRequesting] = React.useState(false);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (!id) return;
    fabricsApi
      .get(id)
      .then(setFabric)
      .catch((e) => setToasts((t) => [...t, createToast('error', 'Load failed', e instanceof Error ? e.message : undefined)]))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    if (!isDesign) return;
    designsApi.list({ status: 'published' }).then(setDesigns).catch(() => {});
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, [isDesign]);

  const requestSample = async () => {
    if (!id || !selDesign || !selHub) { toast('error', 'Pick a design and a hub'); return; }
    setRequesting(true);
    try {
      await sampleJobsApi.request({ design_id: selDesign, fabric_id: id, hub_id: selHub });
      toast('success', 'Sample requested', 'Sent to the hub to stitch.');
      setSelDesign(''); setSelHub('');
    } catch (e) {
      toast('error', 'Request failed', e instanceof Error ? e.message : undefined);
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className={base.page}><div className={s.center}><Spinner /></div></div>;
  if (!fabric) return (
    <div className={base.page}>
      <Link to={backPath} className={s.back}><UilArrowLeft size={16} /> Back</Link>
      <div className={s.center}>Fabric not found.</div>
    </div>
  );

  const imgs = (fabric.image_keys ?? []).map(url).filter(Boolean);

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Link to={backPath} className={s.back}><UilArrowLeft size={16} /> {isDesign ? 'Back to Fabrics' : 'Back to Fabrics Master'}</Link>

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

      {isDesign && (
        <section className={s.useFabric}>
          <h3 className={s.useTitle}>Use this fabric in a design</h3>
          <label className={s.useField}>Design
            <select value={selDesign} onChange={(e) => setSelDesign(e.target.value)}>
              <option value="">Select a published design…</option>
              {designs.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.garment_type}</option>)}
            </select>
          </label>

          {selDesign && (
            <div className={s.compare}>
              <div className={s.compareCol}>
                <span className={s.compareLabel}>Fabric</span>
                {imgs[0] ? <img src={imgs[0]} alt="fabric" /> : <div className={s.compareEmpty}>no swatch</div>}
              </div>
              <div className={s.compareCol}>
                <span className={s.compareLabel}>Design</span>
                {(() => {
                  const cover = url(designs.find((d) => d.id === selDesign)?.cover_key ?? undefined);
                  return cover ? <img src={cover} alt="design" /> : <div className={s.compareEmpty}>no design image</div>;
                })()}
              </div>
            </div>
          )}

          <div className={s.useRow}>
            <label className={s.useField}>Hub
              <select value={selHub} onChange={(e) => setSelHub(e.target.value)}>
                <option value="">Select a hub…</option>
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <Button variant="primary" state={requesting ? 'loading' : 'default'} disabled={!selDesign || !selHub} onClick={requestSample}>
              Request sample
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};

export default FabricPdpPage;
