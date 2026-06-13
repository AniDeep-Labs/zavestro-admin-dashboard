import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { designsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { DesignDetail } from '../../api/adminApi';
import { StatusBadge } from '../../components/StatusBadge';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button/Button';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import type { DesignStatus } from '../../api/adminApi';
import base from './OrdersListPage.module.css';
import s from './SampleDetailPage.module.css';
import { UilArrowLeft, UilImage, UilEdit } from '@iconscout/react-unicons';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: 'stageWarning',
  published: 'stageSuccess',
  archived: 'stageNeutral',
};
const url = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

const Spec: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value === null || value === undefined || value === '' ? null : (
    <div className={s.specRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

export const DesignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [design, setDesign] = React.useState<DesignDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((x) => [...x, createToast(type, title, msg)]);

  const changeStatus = async (status: DesignStatus) => {
    if (!design) return;
    setBusy(true);
    try {
      const updated = await designsApi.setStatus(design.id, status);
      setDesign(updated);
      toast('success', `Design ${status}`);
    } catch (e) {
      toast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    designsApi
      .get(id)
      .then(setDesign)
      .catch((e) =>
        setToasts((x) => [
          ...x,
          createToast('error', 'Load failed', e instanceof Error ? e.message : undefined),
        ]),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className={base.page}>
        <div className={s.center}>
          <Spinner />
        </div>
      </div>
    );
  if (!design)
    return (
      <div className={base.page}>
        <Link to="/admin/design/library" className={s.back}>
          <UilArrowLeft size={16} /> Back to library
        </Link>
        <div className={s.center}>Design not found.</div>
      </div>
    );

  const refUrls = design.reference_image_keys.map(url).filter(Boolean);
  const captureSet = Array.isArray(design.capture_set)
    ? (design.capture_set as string[])
    : Array.isArray(design.template_capture_set)
      ? (design.template_capture_set as string[])
      : [];
  const painMenu = design.pain_point_menu ?? design.template_pain_point_menu ?? {};
  const painPoints = Object.keys(painMenu);

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Link to="/admin/design/library" className={s.back}>
        <UilArrowLeft size={16} /> Back to library
      </Link>

      <div className={s.header}>
        <div>
          <h1 className={s.title}>{design.name}</h1>
          <p className={s.subtitle}>
            {design.garment_type}
            {design.gender ? ` · ${design.gender}` : ''}
            {design.fit_preset ? ` · ${design.fit_preset} fit` : ''}
          </p>
          {/* G-34 lifecycle line */}
          <div className={s.lifecycle}>
            <StatusBadge
              status={
                (design.live_hub_count ?? 0) > 0 ? 'done'
                  : design.has_reviewed_sample ? 'fit'
                  : (design.sample_count ?? 0) > 0 ? 'making'
                  : design.status === 'published' ? 'qc' : 'neutral'
              }
              label={
                (design.live_hub_count ?? 0) > 0 ? `Live · ${design.live_hub_count} hub${design.live_hub_count === 1 ? '' : 's'}`
                  : design.has_reviewed_sample ? 'Reviewed — ready to list'
                  : (design.sample_count ?? 0) > 0 ? `Sampled (${design.sample_count})`
                  : design.status === 'published' ? 'Published, never listed'
                  : 'Not sampled yet'
              }
              size="sm"
            />
          </div>
        </div>
        <div className={s.headerActions}>
          <span className={`${base.stagePill} ${base[STATUS_CSS[design.status] ?? 'stageNeutral']}`}>
            {STATUS_LABELS[design.status] ?? design.status}
          </span>
          <Link to={`/admin/design/library/${design.id}/edit`}>
            <Button variant="outline">
              <UilEdit size={15} /> Edit
            </Button>
          </Link>
          {design.status === 'draft' && (
            <Button
              variant="primary"
              disabled={busy || design.fabrics.length === 0}
              onClick={() => changeStatus('published')}
            >
              Publish
            </Button>
          )}
          {design.status === 'published' && (
            <Button variant="ghost" disabled={busy} onClick={() => changeStatus('archived')}>
              Archive
            </Button>
          )}
          {design.status === 'archived' && (
            <Button variant="ghost" disabled={busy} onClick={() => changeStatus('draft')}>
              Restore to draft
            </Button>
          )}
        </div>
      </div>

      <div className={s.layout}>
        <div className={s.media}>
          <section className={s.gallery}>
            <h3 className={s.galleryTitle}>Reference images</h3>
            {refUrls.length === 0 ? (
              <div className={s.galleryEmpty}>
                <UilImage size={28} />
                <span>No reference images on this design.</span>
              </div>
            ) : (
              <a href={refUrls[0]} target="_blank" rel="noreferrer" className={s.hero}>
                <img src={refUrls[0]} alt={design.name} />
              </a>
            )}
            {refUrls.length > 1 && (
              <div className={s.thumbs}>
                {refUrls.slice(1).map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className={s.thumb}>
                    <img src={u} alt="reference" />
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Fabric match — the design team's required fabric SKU(s) */}
          <section className={s.panel}>
            <h3 className={s.panelTitle}>Fabric match ({design.fabrics.length})</h3>
            {design.fabrics.length === 0 ? (
              <p className={s.modalHint}>No fabrics paired yet — required before publishing.</p>
            ) : (
              <div className={s.fabricList}>
                {design.fabrics.map((f) => (
                  <div key={f.id} className={s.fabricRow}>
                    <div className={s.fabricSwatch}>
                      {url(f.image_keys?.[0]) ? (
                        <img src={url(f.image_keys[0])} alt={f.name} />
                      ) : (
                        <UilImage size={18} />
                      )}
                    </div>
                    <div>
                      <div className={s.fabricName}>{f.name}</div>
                      <div className={s.fabricMeta}>
                        {[f.code, f.color_name, f.composition].filter(Boolean).join(' · ')}
                        {f.meters_per_garment ? ` · ${Number(f.meters_per_garment)}m/garment` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className={s.panels}>
          <section className={s.panel}>
            <h3 className={s.panelTitle}>Design spec</h3>
            <dl className={s.specs}>
              <Spec label="Garment" value={design.garment_type} />
              <Spec label="Gender" value={design.gender} />
              <Spec label="Style" value={design.style} />
              <Spec label="Fit preset" value={design.fit_preset} />
              <Spec
                label="Fabric / garment"
                value={design.meters_per_garment ? `${design.meters_per_garment} m` : null}
              />
            </dl>

            {captureSet.length > 0 && (
              <div className={s.tagsBlock}>
                <span className={s.tagsLabel}>Measured fields (capture-set)</span>
                <div className={s.tags}>
                  {captureSet.map((c) => (
                    <span key={c} className={s.tag}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {painPoints.length > 0 && (
              <div className={s.tagsBlock}>
                <span className={s.tagsLabel}>Pain-point options</span>
                <div className={s.tags}>
                  {painPoints.map((p) => (
                    <span key={p} className={s.tag}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {design.tech_pack && Object.keys(design.tech_pack).length > 0 && (
              <div className={s.techPack}>
                <span className={s.tagsLabel}>Construction / tech-pack</span>
                <dl className={s.specs}>
                  {Object.entries(design.tech_pack).map(([k, v]) => (
                    <Spec
                      key={k}
                      label={k.replace(/_/g, ' ')}
                      value={typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    />
                  ))}
                </dl>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default DesignDetailPage;
