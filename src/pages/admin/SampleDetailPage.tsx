import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { sampleJobsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { SampleJobDetail } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Textarea } from '../../components/Textarea/Textarea';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import styles from './SampleDetailPage.module.css';
import { UilArrowLeft, UilImage, UilCheckCircle, UilAngleRightB, UilClock } from '@iconscout/react-unicons';
import { StatusBadge, Modal } from '../../components';
import { SampleProgress } from './SampleProgress';
import { Can } from '../../components/Can/Can';

// In-progress stage → human phrase for the "being made" placeholder.
const STAGE_PHRASE: Record<string, string> = {
  requested: 'queued for production',
  cutting: 'being cut',
  stitching: 'being stitched',
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
  const navigate = useNavigate();
  // Back preserves the queue's tab + filters (spec §248): return to wherever we came
  // from, falling back to the samples list on a cold/direct load.
  const goBack = () =>
    window.history.length > 1 ? navigate(-1) : navigate('/admin/design/samples');
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
      const updated = await sampleJobsApi.review(sample.id);
      setSample({ ...sample, status: updated.status });
      showToast('success', 'Approved', 'The catalog manager can now list it (D13).');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActing(false);
    }
  };

  // "Needs changes" — reject with a reason (D13: a rejected sample can't be listed).
  const [showReject, setShowReject] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const rejectSample = async () => {
    if (!sample || !rejectReason.trim()) {
      showToast('error', 'Add what needs changing');
      return;
    }
    setActing(true);
    try {
      const updated = await sampleJobsApi.reject(sample.id, rejectReason.trim());
      setSample({
        ...sample,
        status: updated.status,
        rejection_reason: updated.rejection_reason ?? rejectReason.trim(),
      });
      setShowReject(false);
      setRejectReason('');
      showToast('success', 'Sent back', 'Marked needs-changes — a fresh sample can be requested.');
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

  // Lifecycle-aware UI (spec §248/§244): the review apparatus only makes sense once a
  // stitched sample exists to judge. Before that the sample is still being made; after
  // cancellation it's dead.
  const cancelled = sample.status === 'cancelled';
  const inProgress = ['requested', 'cutting', 'stitching'].includes(sample.status);
  const reviewable = sample.status === 'design_review';
  const hasSample = !cancelled && !inProgress; // design_review / reviewed / rejected
  // "Stalled" — sitting in the same stage too long (spec flags samples idle > 5d).
  const stageAgeDays = Math.floor((Date.now() - new Date(sample.updated_at).getTime()) / 86_400_000);
  const idle = inProgress && stageAgeDays >= 5;

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <button type="button" className={styles.back} onClick={goBack}>
        <UilArrowLeft size={16} /> Back to samples
      </button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{design.name}</h1>
          <p className={styles.subtitle}>
            {design.garment_type}
            {design.gender ? ` · ${design.gender}` : ''} · {fabric.name}
          </p>
          <Link to={`/admin/design/library/${design.id}`} className={styles.designLink}>
            View design <UilAngleRightB size={14} />
          </Link>
        </div>
        <StatusBadge status={sample.status} />
      </div>

      {sample.status === 'rejected' && sample.rejection_reason && (
        <div className={styles.rejectBanner}>
          <strong>Rejected:</strong> {sample.rejection_reason}
        </div>
      )}
      {cancelled && (
        <div className={styles.cancelBanner}>
          This sample request was cancelled — no sample was stitched against it. The spec below
          is kept for reference.
        </div>
      )}

      {/* Comparison — what was actually stitched vs what it should look like. Before a
          sample exists (in-progress), the stitched slot shows production progress, not a
          misleading "not uploaded yet" empty box. */}
      <div className={`${styles.compare} ${cancelled ? styles.compareSingle : ''}`}>
        {inProgress && (
          <section className={styles.gallery}>
            <h3 className={styles.galleryTitle}>Stitched sample</h3>
            <div className={styles.makingBox}>
              <SampleProgress status={sample.status} />
              <p className={styles.makingText}>
                The sample is {STAGE_PHRASE[sample.status] ?? 'in production'} at{' '}
                {sample.hub_name ?? 'the hub'}. Photos appear here when it's submitted for review.
              </p>
              {idle && (
                <p className={styles.idleNote}>
                  <UilClock size={14} /> Stalled — {stageAgeDays} days in this stage.
                </p>
              )}
            </div>
          </section>
        )}
        {hasSample && (
          <Gallery
            title="Stitched sample"
            keys={sample.photo_keys}
            emptyHint="The hub hasn't uploaded sample photos yet."
          />
        )}
        <Gallery
          title="Design reference"
          keys={design.reference_image_keys}
          emptyHint="No reference images on the design."
        />
      </div>

      {/* Spec cards the sample is judged against */}
      <div className={styles.specGrid}>
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
              <Spec
                label="Care"
                value={fabric.care_instructions?.length ? fabric.care_instructions.join(' · ') : null}
              />
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

      {/* Measured-vs-chart deviation (§249) — gated on QC capture (Problem 6). It's an
          explanatory placeholder, so it reads as a slim full-width note, not a card that
          towers over the label/value spec cards. Only meaningful once a sample exists. */}
      {hasSample && (
        <p className={styles.measuredNote}>
          <strong>Measured vs chart</strong> — a size-deviation table (the stitched sample measured
          against the garment-type chart) appears here once QC capture ships (Problem&nbsp;6). For now,
          judge fit from the photos against the design spec above and leave notes below.
        </p>
      )}

      {/* Advisory review — improvement comments. The form only shows once a sample exists
          to comment on (design_review onward); in-progress/cancelled show history if any. */}
      {(hasSample || sample.comments.length > 0) && (
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
          {hasSample && (
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
          )}
        </section>
      )}

      {reviewable && (
        <Can cap="designs:write">
          <div className={styles.actionBar}>
            <span className={styles.gateNote}>
              Your verdict gates the first listing of this design at {sample.hub_name ?? 'this hub'} (D13).
            </span>
            <Button variant="primary" state={acting ? 'loading' : 'default'} onClick={markReviewed}>
              <UilCheckCircle size={16} /> Approve — ready to list
            </Button>
            <Button variant="ghost" state={acting ? 'loading' : 'default'} onClick={() => setShowReject(true)}>
              Needs changes
            </Button>
          </div>
        </Can>
      )}

      <Modal
        open={showReject}
        onClose={() => setShowReject(false)}
        title="What needs changing?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="primary" state={acting ? 'loading' : 'default'} onClick={rejectSample}>
              Send back
            </Button>
          </>
        }
      >
        <div className={styles.rejectForm}>
          <p className={styles.modalNote}>
            This marks the sample rejected — it can't be listed (D13). Request a fresh
            sample once the fix is made.
          </p>
          <textarea
            className={styles.rejectInput}
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Collar sits high — re-cut to the spec; topstitch uneven on the placket"
          />
        </div>
      </Modal>
    </div>
  );
};

export default SampleDetailPage;
