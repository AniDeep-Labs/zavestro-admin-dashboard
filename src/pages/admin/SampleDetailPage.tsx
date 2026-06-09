import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { sampleJobsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { SampleJobDetail } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Textarea } from '../../components/Textarea/Textarea';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import styles from './SampleDetailPage.module.css';
import { UilArrowLeft, UilImage, UilCheckCircle } from '@iconscout/react-unicons';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  cutting: 'Cutting',
  stitching: 'Stitching',
  design_review: 'Awaiting Review',
  reviewed: 'Reviewed',
  approved: 'Approved',
  rejected: 'Rejected',
};
const STATUS_CSS: Record<string, string> = {
  requested: 'stageNeutral',
  cutting: 'stageBlue',
  stitching: 'stageBlue',
  design_review: 'stageWarning',
  reviewed: 'stageSuccess',
  approved: 'stageSuccess',
  rejected: 'stageNeutral',
};
const url = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

/** A labelled spec row; renders nothing if the value is empty. */
const Spec: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value === null || value === undefined || value === '' ? null : (
    <div className={styles.specRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

const Gallery: React.FC<{ title: string; keys: string[]; emptyHint: string }> = ({
  title,
  keys,
  emptyHint,
}) => {
  const [active, setActive] = React.useState(0);
  const urls = keys.map(url).filter(Boolean);
  return (
    <section className={styles.gallery}>
      <h3 className={styles.galleryTitle}>{title}</h3>
      {urls.length === 0 ? (
        <div className={styles.galleryEmpty}>
          <UilImage size={28} />
          <span>{emptyHint}</span>
        </div>
      ) : (
        <>
          <a href={urls[active]} target="_blank" rel="noreferrer" className={styles.hero}>
            <img src={urls[active]} alt={`${title} ${active + 1}`} />
          </a>
          {urls.length > 1 && (
            <div className={styles.thumbs}>
              {urls.map((u, i) => (
                <button
                  key={u}
                  className={`${styles.thumb} ${i === active ? styles.thumbActive : ''}`}
                  onClick={() => setActive(i)}
                  type="button"
                >
                  <img src={u} alt={`${title} thumbnail ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export const SampleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [sample, setSample] = React.useState<SampleJobDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState(false);
  const [newComment, setNewComment] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((x) => [...x, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    sampleJobsApi
      .get(id)
      .then(setSample)
      .catch((e) => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const markReviewed = async () => {
    if (!sample) return;
    setActing(true);
    try {
      await sampleJobsApi.review(sample.id);
      setSample({ ...sample, status: 'reviewed' });
      showToast('success', 'Marked reviewed', 'The catalog manager can now list it.');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActing(false);
    }
  };

  const postComment = async () => {
    if (!sample || !newComment.trim()) return;
    setPosting(true);
    try {
      const c = await sampleJobsApi.addComment(sample.id, newComment.trim());
      setSample({ ...sample, comments: [...sample.comments, c] });
      setNewComment('');
    } catch (e) {
      showToast('error', 'Comment failed', e instanceof Error ? e.message : undefined);
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className={base.page}>
        <div className={styles.center}>
          <Spinner />
        </div>
      </div>
    );
  }
  if (!sample) {
    return (
      <div className={base.page}>
        <Link to="/admin/design/samples" className={styles.back}>
          <UilArrowLeft size={16} /> Back to samples
        </Link>
        <div className={styles.center}>Sample not found.</div>
      </div>
    );
  }

  const { design, fabric } = sample;
  const painPoints = sample.design.pain_point_menu
    ? Object.keys(sample.design.pain_point_menu)
    : [];
  const captureSet = Array.isArray(design.capture_set) ? (design.capture_set as string[]) : [];

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <Link to="/admin/design/samples" className={styles.back}>
        <UilArrowLeft size={16} /> Back to samples
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{design.name}</h1>
          <p className={styles.subtitle}>
            {design.garment_type}
            {design.gender ? ` · ${design.gender}` : ''} · {fabric.name}
          </p>
        </div>
        <span className={`${base.stagePill} ${base[STATUS_CSS[sample.status] ?? 'stageNeutral']}`}>
          {STATUS_LABELS[sample.status] ?? sample.status}
        </span>
      </div>

      {sample.status === 'rejected' && sample.rejection_reason && (
        <div className={styles.rejectBanner}>
          <strong>Rejected:</strong> {sample.rejection_reason}
        </div>
      )}

      <div className={styles.layout}>
        {/* Left — what was actually stitched, next to what it should look like */}
        <div className={styles.media}>
          <Gallery
            title="Stitched sample"
            keys={sample.photo_keys}
            emptyHint="The hub hasn't uploaded sample photos yet."
          />
          <Gallery
            title="Design reference"
            keys={design.reference_image_keys}
            emptyHint="No reference images on the design."
          />
        </div>

        {/* Right — spec the sample is judged against */}
        <div className={styles.panels}>
          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Design spec</h3>
            <dl className={styles.specs}>
              <Spec label="Garment" value={design.garment_type} />
              <Spec label="Gender" value={design.gender} />
              <Spec label="Style" value={design.style} />
              <Spec label="Fit preset" value={design.fit_preset} />
              <Spec
                label="Fabric needed"
                value={design.meters_per_garment ? `${design.meters_per_garment} m` : null}
              />
              <Spec label="Design status" value={design.status} />
            </dl>

            {captureSet.length > 0 && (
              <div className={styles.tagsBlock}>
                <span className={styles.tagsLabel}>Measured fields</span>
                <div className={styles.tags}>
                  {captureSet.map((c) => (
                    <span key={c} className={styles.tag}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {painPoints.length > 0 && (
              <div className={styles.tagsBlock}>
                <span className={styles.tagsLabel}>Pain-point options</span>
                <div className={styles.tags}>
                  {painPoints.map((p) => (
                    <span key={p} className={styles.tag}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {design.tech_pack && Object.keys(design.tech_pack).length > 0 && (
              <div className={styles.techPack}>
                <span className={styles.tagsLabel}>Construction / tech-pack</span>
                <dl className={styles.specs}>
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

          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Fabric</h3>
            {url(fabric.image_keys?.[0]) && (
              <a
                href={url(fabric.image_keys[0])}
                target="_blank"
                rel="noreferrer"
                className={styles.swatch}
              >
                <img src={url(fabric.image_keys[0])} alt={fabric.name} />
              </a>
            )}
            <dl className={styles.specs}>
              <Spec label="Name" value={fabric.name} />
              <Spec label="Code" value={fabric.code} />
              <Spec label="Composition" value={fabric.composition} />
              <Spec label="Weave" value={fabric.weave} />
              <Spec label="Finish" value={fabric.finish} />
              <Spec label="Weight" value={fabric.weight_gsm ? `${fabric.weight_gsm} gsm` : null} />
              <Spec label="Origin" value={fabric.origin} />
              <Spec label="Care" value={fabric.care_instructions} />
              <Spec
                label="Price"
                value={fabric.price_per_meter ? `₹${fabric.price_per_meter}/m` : null}
              />
            </dl>
          </section>

          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Job</h3>
            <dl className={styles.specs}>
              <Spec label="Hub" value={sample.hub_name} />
              <Spec label="Tailor" value={sample.tailor_name ?? 'Unassigned'} />
              <Spec
                label="Requested"
                value={new Date(sample.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              />
            </dl>
          </section>
        </div>
      </div>

      {/* Advisory review — improvement comments (no approve/reject; design suggests, CM lists) */}
      <section className={styles.reviewPanel}>
        <h3 className={styles.panelTitle}>Review &amp; comments</h3>
        {sample.comments.length === 0 ? (
          <p className={styles.modalHint}>
            No comments yet. Leave improvement notes for the hub — this is advisory, not a rejection.
          </p>
        ) : (
          <div className={styles.commentList}>
            {sample.comments.map((c) => (
              <div key={c.id} className={styles.comment}>
                <div className={styles.commentMeta}>
                  <strong>{c.author_name ?? 'Design'}</strong>
                  <span>
                    {new Date(c.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className={styles.commentBody}>{c.body}</div>
              </div>
            ))}
          </div>
        )}
        <div className={styles.commentForm}>
          <Textarea
            value={newComment}
            onChange={setNewComment}
            placeholder="Suggest an improvement… (e.g. collar uneven, sleeve +1cm)"
          />
          <Button
            variant="outline"
            disabled={!newComment.trim()}
            state={posting ? 'loading' : 'default'}
            onClick={postComment}
          >
            Post comment
          </Button>
        </div>
      </section>

      {sample.status === 'design_review' && (
        <div className={styles.actionBar}>
          <Button variant="primary" state={acting ? 'loading' : 'default'} onClick={markReviewed}>
            <UilCheckCircle size={16} /> Mark reviewed
          </Button>
        </div>
      )}
    </div>
  );
};

export default SampleDetailPage;
