import React from 'react';
import { money } from '../../utils/money'; // ACP-2 [KA11-2]
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { designsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { DesignDetail, DesignStatus, DesignVersionRow } from '../../api/adminApi';
import DesignEditorModal from './DesignEditorPage';
import CutSheetModal from './CutSheetPage';
import { PageHeader, DetailShell, Tabs, StatusBadge } from '../../components';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button/Button';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import base from './OrdersListPage.module.css';
import s from './SampleDetailPage.module.css';
import dd from './DesignDetailPage.module.css';
import { UilAngleLeft, UilImage, UilEdit, UilPlus, UilFileAlt, UilCopy } from '@iconscout/react-unicons';

const url = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');
// ACP-2 [KA11-2]: one money formatter (was a local copy).
const inr = (v: string | number | null | undefined) => money(v);

/**
 * [DSG-9-6] One side of a change, as a reader can take in at a glance.
 *
 * `null` is rendered as an em dash rather than the word "null", and an object as compact
 * JSON — a tech pack shown as [object Object] would make the history useless for exactly
 * the field most likely to be argued about.
 */
const renderVal = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(none)';
  if (typeof v === 'object') return JSON.stringify(v);
  if (v === '') return '(empty)';
  return String(v);
};
// ACP-6 [KA11-6]: one date formatter for the admin.
import { fmtDate, fmtDateTime } from '../../utils/date';
import { isDenied } from '../../components/EmptyState/asyncState';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]
import { SafeImg } from '../../components/Image/SafeImg';

export const DesignDetailPage: React.FC<{ autoEdit?: boolean; autoCutSheet?: boolean }> = ({ autoEdit, autoCutSheet }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // A modal opened via a deep-link route (/edit, /cut-sheet) should restore the clean detail
  // URL when closed, so the breadcrumb + URL don't linger on the sub-page.
  const closeAndCleanUrl = (clear: () => void, suffix: string) => {
    clear();
    if (location.pathname.endsWith(suffix)) navigate(`/admin/design/library/${id}`, { replace: true });
  };
  const [design, setDesign] = React.useState<DesignDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editorOpen, setEditorOpen] = React.useState(Boolean(autoEdit));
  const [cutSheetOpen, setCutSheetOpen] = React.useState(Boolean(autoCutSheet));
  const [busy, setBusy] = React.useState(false);
  const [dupBusy, setDupBusy] = React.useState(false);
  const [pending, setPending] = React.useState<DesignStatus | null>(null);
  const [fitChart, setFitChart] = React.useState<Record<string, number | string>[]>([]);
  // [DSG-9-6] The revision history. Three states, not two: a 403 means "you may not see
  // this", which is not the same claim as "this design has never been edited".
  const [versions, setVersions] = React.useState<DesignVersionRow[]>([]);
  const [versionsState, setVersionsState] = React.useState<'loading' | 'ok' | 'denied' | 'failed'>('loading');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((x) => [...x, createToast(type, title, msg)]);

  useBreadcrumbTitle(design?.name);

  const changeStatus = async (status: DesignStatus) => {
    if (!design) return;
    setBusy(true);
    try {
      const updated = await designsApi.setStatus(design.id, status);
      setDesign(updated);
      toast('success', `Design ${status}`);
      setPending(null);
    } catch (e) {
      toast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const reload = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    designsApi
      .get(id)
      .then(setDesign)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => { reload(); }, [reload]);

  // #4: the standard finished-garment chart this (garment type, fit) follows — lower garments
  // only (the endpoint returns empty otherwise).
  React.useEffect(() => {
    if (!design?.fit_preset || !design?.garment_category_id) { setFitChart([]); return; }
    let cancelled = false;
    designsApi
      .fitChart(design.garment_category_id, design.fit_preset)
      .then((r) => { if (!cancelled) setFitChart(Array.isArray(r.chart) ? r.chart : []); })
      .catch(() => { if (!cancelled) setFitChart([]); });
    return () => { cancelled = true; };
  }, [design?.garment_category_id, design?.fit_preset]);

  // [DSG-9-6] Revision history.
  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setVersionsState('loading');
    designsApi
      .versions(id)
      .then((rows) => {
        if (cancelled) return;
        setVersions(rows);
        setVersionsState('ok');
      })
      .catch((e) => {
        if (cancelled) return;
        setVersions([]);
        setVersionsState(isDenied(e) ? 'denied' : 'failed');
      });
    return () => { cancelled = true; };
  }, [id]);

  // #3: clone this design into a fresh draft (a variant to tweak).
  const duplicate = async () => {
    if (!design) return;
    setDupBusy(true);
    try {
      const created = await designsApi.create({
        name: `${design.name} (copy)`,
        garment_category_id: design.garment_category_id,
        garment_type: design.design_garment_type ?? null,
        gender: design.gender ?? 'men',
        fit_preset: design.fit_preset ?? null,
        meters_per_garment: design.meters_per_garment ? Number(design.meters_per_garment) : 0,
        meters_by_size: design.meters_by_size ?? {},
        tech_pack: design.tech_pack ?? null,
        capture_set: (design.capture_set as string[] | null) ?? null,
        pain_point_menu: design.pain_point_menu ?? null,
        reference_image_keys: design.reference_image_keys ?? [],
        spec_sheet_key: design.spec_sheet_key ?? null,
        fabrics: design.fabrics.map((f) => ({ fabric_id: f.id, meters_per_garment: f.meters_per_garment ? Number(f.meters_per_garment) : null })),
      });
      toast('success', 'Design duplicated', 'Opening the new draft…');
      setTimeout(() => navigate(`/admin/design/library/${created.id}`), 500);
    } catch (e) {
      toast('error', 'Duplicate failed', e instanceof Error ? e.message : undefined);
      setDupBusy(false);
    }
  };

  if (loading)
    return (
      <div className={base.page}>
        <div className={s.center}><Spinner /></div>
      </div>
    );
  if (!design)
    return (
      <div className={base.page}>
        <button className={base.backBtn} onClick={() => navigate('/admin/design/library')}>
          <UilAngleLeft size={15} /> Back to library
        </button>
        <div className={s.center}>Design not found.</div>
      </div>
    );

  const refUrls = design.reference_image_keys.map(url).filter(Boolean);
  const captureSet = Array.isArray(design.capture_set)
    ? (design.capture_set as string[])
    : Array.isArray(design.template_capture_set)
      ? (design.template_capture_set as string[])
      : [];
  const painPoints = Object.keys(design.pain_point_menu ?? design.template_pain_point_menu ?? {});

  // ── lifecycle chip (G-34) ──
  const lifecycle =
    (design.live_hub_count ?? 0) > 0
      ? { status: 'done', label: `Live · ${design.live_hub_count} hub${design.live_hub_count === 1 ? '' : 's'}` }
      : design.has_reviewed_sample
        ? { status: 'fit', label: 'Reviewed — ready to list' }
        : (design.sample_count ?? 0) > 0
          ? { status: 'making', label: `Sampled (${design.sample_count})` }
          : design.status === 'published'
            ? { status: 'qc', label: 'Published, never listed' }
            : { status: 'neutral', label: 'Not sampled yet' };

  // ── lifecycle stepper: where this design is + the single next step ──
  const steps = [
    { key: 'draft', label: 'Draft', done: true },
    { key: 'fabric', label: 'Fabric paired', done: design.fabrics.length > 0 },
    { key: 'sampled', label: 'Sampled', done: (design.sample_count ?? 0) > 0 },
    { key: 'reviewed', label: 'Reviewed', done: !!design.has_reviewed_sample },
    { key: 'listed', label: 'Listed', done: (design.live_hub_count ?? 0) > 0 },
  ];
  const firstTodo = steps.findIndex((st) => !st.done);
  const activeIdx = firstTodo === -1 ? steps.length : firstTodo;
  const nextStep: { text: string; action?: { label: string; onClick: () => void } } =
    design.status === 'archived'
      ? { text: 'This design is archived — restore it to draft to continue.' }
      : design.fabrics.length === 0
        ? { text: 'Next: pair at least one fabric so this design can be sampled.', action: { label: 'Add fabric', onClick: () => setEditorOpen(true) } }
        : (design.sample_count ?? 0) === 0
          ? { text: 'Next: request a sample from a hub to validate the make.', action: { label: 'Request sample', onClick: () => navigate(`/admin/design/samples?design=${design.id}`) } }
          : !design.has_reviewed_sample
            ? { text: 'A sample is in progress — review it once the hub submits it.', action: { label: 'Open review queue', onClick: () => navigate('/admin/design/samples') } }
            : (design.live_hub_count ?? 0) === 0
              ? { text: 'Reviewed and ready — the catalog manager can now list it for customers.' }
              : { text: `Live at ${design.live_hub_count} hub${design.live_hub_count === 1 ? '' : 's'}. Nothing more to do here.` };

  const header = (
    <PageHeader
      above={
        <button className={base.backBtn} onClick={() => navigate('/admin/design/library')}>
          <UilAngleLeft size={15} /> Back to library
        </button>
      }
      eyebrow={
        design.design_garment_type
          ? `${design.garment_type} · ${design.design_garment_type}`
          : design.garment_type
      }
      title={design.name}
      subtitle={[design.gender, design.fit_preset ? `${design.fit_preset} fit` : null]
        .filter(Boolean)
        .join(' · ')}
      meta={
        <>
          <StatusBadge status={design.status} />
          <StatusBadge status={lifecycle.status} label={lifecycle.label} size="sm" />
        </>
      }
      actions={
        <>
          <Button variant="outline" onClick={() => setEditorOpen(true)}>
            <UilEdit size={15} /> Edit
          </Button>
          <Button variant="outline" onClick={() => setCutSheetOpen(true)}>
            <UilFileAlt size={15} /> Cut sheet
          </Button>
          <Button variant="outline" state={dupBusy ? 'loading' : 'default'} onClick={duplicate}>
            <UilCopy size={15} /> Duplicate
          </Button>
          {design.status === 'draft' && (
            <Button
              variant="primary"
              disabled={busy || design.fabrics.length === 0 || design.reference_image_keys.length === 0}
              onClick={() => setPending('published')}
            >
              Publish
            </Button>
          )}
          {design.status === 'published' && (
            <Button variant="ghost" disabled={busy} onClick={() => setPending('archived')}>Archive</Button>
          )}
          {design.status === 'archived' && (
            <Button variant="ghost" disabled={busy} onClick={() => changeStatus('draft')}>Restore to draft</Button>
          )}
        </>
      }
    />
  );

  // ── right rail: reference image + lifecycle + actions ──
  const aside = (
    <>
      <div className={s.panel}>
        <h3 className={s.panelTitle}>Reference images</h3>
        {refUrls.length === 0 ? (
          <div className={dd.refEmpty}>
            <UilImage size={20} />
            <span>None yet.</span>
            <button type="button" className={dd.refEmptyLink} onClick={() => setEditorOpen(true)}>Add →</button>
          </div>
        ) : (
          <div className={s.gallery}>
            <a href={refUrls[0]} target="_blank" rel="noreferrer" className={s.hero}>
              <SafeImg src={refUrls[0]} alt={design.name} fallback={<UilImage size={28} />} />
            </a>
            {refUrls.length > 1 && (
              <div className={s.thumbs}>
                {refUrls.slice(1).map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className={s.thumb}>
                    <SafeImg src={u} alt="reference" fallback={<UilImage size={16} />} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={s.panel}>
        <h3 className={s.panelTitle}>Lifecycle</h3>
        <div className={dd.lifeCard}>
          <div className={dd.lifeRow}><span className={dd.lifeLabel}>Status</span><span className={dd.lifeValue}>{design.status}</span></div>
          <div className={dd.lifeRow}><span className={dd.lifeLabel}>Stage</span><StatusBadge status={lifecycle.status} label={lifecycle.label} size="sm" /></div>
          <div className={dd.lifeRow}><span className={dd.lifeLabel}>Samples</span><span className={dd.lifeValue}>{design.sample_count ?? 0}</span></div>
          <div className={dd.lifeRow}><span className={dd.lifeLabel}>Live hubs</span><span className={dd.lifeValue}>{design.live_hub_count ?? 0}</span></div>
          <div className={dd.lifeRow}><span className={dd.lifeLabel}>FTR</span><span className={dd.lifeValue}>{design.fit.ftr == null ? '—' : `${design.fit.ftr}%`}</span></div>
        </div>
      </div>
      <div className={s.panel}>
        <h3 className={s.panelTitle}>Actions</h3>
        <div className={dd.lifeCard}>
          <Button variant="outline" onClick={() => navigate(`/admin/design/samples?design=${design.id}`)}>
            <UilPlus size={14} /> Request sample
          </Button>
        </div>
      </div>
    </>
  );

  // ── tab content ──
  const samplesTab = design.samples.length === 0 ? (
    <div className={dd.empty}>No samples requested for this design yet.</div>
  ) : (
    <table className={dd.table}>
      <thead><tr><th>Hub</th><th>Status</th><th>Requested</th><th>Verdict / note</th></tr></thead>
      <tbody>
        {design.samples.map((sm) => (
          <tr key={sm.id} className={base.row} {...rowActivation(() => navigate(`/admin/design/samples/${sm.id}`))}>
            <td>{sm.hub_name ?? '—'}</td>
            <td><StatusBadge status={sm.status} size="sm" /></td>
            <td>{fmtDate(sm.created_at)}</td>
            <td>{sm.rejection_reason ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // [DSG-9-6] What this design looked like before, and who moved it.
  const historyTab = (() => {
    if (versionsState === 'loading') return <p className={dd.empty}>Loading history…</p>;
    if (versionsState === 'denied')
      return <p className={dd.empty}>You do not have permission to see this design&rsquo;s history.</p>;
    if (versionsState === 'failed')
      return <p className={dd.empty}>The history could not be loaded. This is not the same as a design that has never been edited &mdash; try again.</p>;
    if (versions.length === 0)
      return (
        <p className={dd.empty}>
          No edits recorded yet. History starts at the first save after this design&rsquo;s
          revision spine was added &mdash; a design nobody has edited is still exactly what
          created it.
        </p>
      );
    return (
      <ol className={dd.history}>
        {versions.map((v) => (
          <li key={v.version} className={dd.historyItem}>
            <div className={dd.historyHead}>
              <span className={dd.historyVersion}>v{v.version}</span>
              {v.source === 'baseline' && (
                <span className={dd.historyTag} title="The state found when history began — not an edit.">
                  baseline
                </span>
              )}
              {v.source === 'restore' && <span className={dd.historyTag}>restored</span>}
              {v.material && (
                <span
                  className={dd.historyMaterial}
                  title="Touched tech-pack, fit, fabric, garment type or metreage — the fields that re-open sample review on a locked design."
                >
                  material
                </span>
              )}
              <span className={dd.historyWho}>
                {v.created_by ? v.created_by.name : 'system'} &middot; {fmtDateTime(v.created_at)}
              </span>
            </div>
            {v.note && <p className={dd.historyNote}>{v.note}</p>}
            {v.source === 'baseline' ? (
              <p className={dd.historyEmpty}>The state this design was in when history began.</p>
            ) : v.changed === 0 ? (
              <p className={dd.historyEmpty}>Saved with no change to any recorded field.</p>
            ) : (
              <>
                <table className={dd.table}>
                  <thead>
                    <tr><th>Field</th><th>Was</th><th>Became</th></tr>
                  </thead>
                  <tbody>
                    {v.changes.map((c, i) => (
                      <tr key={`${c.path}-${i}`}>
                        <td>{c.path}</td>
                        <td className={dd.historyFrom}>{renderVal(c.from)}</td>
                        <td className={dd.historyTo}>{renderVal(c.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {v.truncated && (
                  <p className={dd.historyEmpty}>
                    Showing {v.changes.length} of {v.changed} changes.
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    );
  })();

  const listingsTab = design.listings.length === 0 ? (
    <div className={dd.empty}>Not listed at any hub yet. The catalog manager lists a reviewed sample.</div>
  ) : (
    <table className={dd.table}>
      <thead><tr><th>Hub</th><th>Fabric</th><th>Price</th><th>State</th></tr></thead>
      <tbody>
        {design.listings.map((l) => (
          <tr key={l.id}>
            <td>{l.hub_name}</td>
            <td>{l.fabric_name ?? '—'}</td>
            <td>{inr(l.price)}</td>
            <td><StatusBadge status={l.is_active ? 'active' : 'inactive'} label={l.is_active ? 'Live' : 'Draft'} size="sm" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const fitTab = design.fit.responded === 0 ? (
    <div className={dd.empty}>Fit data appears as delivered orders for this design are rated.</div>
  ) : (
    <>
      <div className={dd.fitKpis}>
        <div className={dd.fitKpi}><div className={dd.fitKpiValue}>{design.fit.ftr ?? '—'}%</div><div className={dd.fitKpiLabel}>First-time-right</div></div>
        <div className={dd.fitKpi}><div className={dd.fitKpiValue}>{design.fit.avg_fit ?? '—'}</div><div className={dd.fitKpiLabel}>Avg fit (1–5)</div></div>
        <div className={dd.fitKpi}><div className={dd.fitKpiValue}>{design.fit.responded}</div><div className={dd.fitKpiLabel}>Responses</div></div>
      </div>
      <table className={dd.table}>
        <thead><tr><th>Fit</th><th>Note</th><th>When</th></tr></thead>
        <tbody>
          {design.fit.recent.map((r) => (
            <tr key={r.id}>
              <td>{r.overall_fit}/5</td>
              <td>{r.notes ?? '—'}</td>
              <td>{fmtDate(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <DetailShell header={header} aside={aside}>
        {/* Lifecycle stepper — where this design is, and the one next step */}
        <section className={s.panel}>
          <div className={dd.stepper}>
            {steps.map((st, i) => (
              <React.Fragment key={st.key}>
                {i > 0 && <span className={`${dd.stepBar} ${i <= activeIdx ? dd.stepBarOn : ''}`} />}
                <div className={`${dd.step} ${st.done ? dd.stepDone : i === activeIdx ? dd.stepCurrent : ''}`}>
                  <span className={dd.stepDot}>{st.done ? '✓' : i + 1}</span>
                  <span className={dd.stepLabel}>{st.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className={dd.nextStep}>
            <span className={dd.nextStepText}>{nextStep.text}</span>
            {nextStep.action && (
              <Button size="sm" variant="primary" onClick={nextStep.action.onClick}>{nextStep.action.label}</Button>
            )}
          </div>
        </section>

        {/* Fabric pairings — swatch · ₹/m · hubs holding (the procurement join) */}
        <section className={s.panel}>
          <h3 className={s.panelTitle}>
            Fabric pairings ({design.fabrics.length})
            {design.meters_per_garment ? <span className={dd.fabricMeta}> · ~{Number(design.meters_per_garment)} m/garment</span> : null}
          </h3>
          {design.fabrics.length === 0 ? (
            <div className={dd.empty}>No fabrics paired yet — required before publishing.</div>
          ) : (
            <table className={dd.table}>
              <thead><tr><th>Fabric</th><th>₹/m</th><th>Hubs holding</th></tr></thead>
              <tbody>
                {design.fabrics.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className={dd.fabricCell}>
                        <span className={dd.swatch}>
                          <SafeImg
                            src={url(f.image_keys?.[0])}
                            alt={f.name}
                            fallback={<UilImage size={16} />}
                          />
                        </span>
                        <span>
                          <span className={dd.fabricName}>{f.name}</span>
                          <span className={dd.fabricMeta}>{[f.code, f.color_name, f.composition].filter(Boolean).join(' · ')}</span>
                        </span>
                      </div>
                    </td>
                    <td>{inr(f.price_per_meter)}</td>
                    <td>
                      {f.hubs.length === 0 ? (
                        <span className={dd.noHub}>Not at any hub</span>
                      ) : (
                        <span className={dd.hubChips}>
                          {f.hubs.map((h) => (
                            <span key={h.hub_name} className={dd.hubChip}>{h.hub_name} · {Number(h.available_meters)}m</span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* #4: standard size chart this design's (garment type, fit) follows (lower garments) */}
        {fitChart.length > 0 && (() => {
          const ORDER = ['size', 'waist', 'hip', 'thigh', 'knee', 'leg_opening', 'rise', 'inseam'];
          const keys = Object.keys(fitChart[0]);
          const cols = [...ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !ORDER.includes(k))];
          return (
            <section className={s.panel}>
              <h3 className={s.panelTitle}>
                Standard size chart <span className={dd.fabricMeta}>· {design.garment_type} · {design.fit_preset} (inches)</span>
              </h3>
              <div className={dd.chartScroll}>
                <table className={dd.table}>
                  <thead><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                  <tbody>
                    {fitChart.map((row, i) => (
                      <tr key={i}>{cols.map((c) => <td key={c}>{String(row[c] ?? '—')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}

        {/* Samples | Listings | Fit */}
        <section className={s.panel}>
          <Tabs
            tabs={[
              { id: 'samples', label: `Samples (${design.samples.length})`, content: samplesTab },
              { id: 'listings', label: `Listings (${design.listings.length})`, content: listingsTab },
              { id: 'fit', label: 'Fit', content: fitTab },
              {
                id: 'history',
                label: versionsState === 'ok' ? `History (${versions.length})` : 'History',
                content: historyTab,
              },
            ]}
          />
        </section>

        {/* Construction / fit-engine spec */}
        {(captureSet.length > 0 || painPoints.length > 0 || (design.tech_pack && Object.keys(design.tech_pack).length > 0)) && (
          <section className={s.panel}>
            <h3 className={s.panelTitle}>Construction &amp; fit spec</h3>
            {captureSet.length > 0 && (
              <div className={s.tagsBlock}>
                <span className={s.tagsLabel}>Measured fields (capture-set)</span>
                <div className={s.tags}>{captureSet.map((c) => <span key={c} className={s.tag}>{c}</span>)}</div>
              </div>
            )}
            {painPoints.length > 0 && (
              <div className={s.tagsBlock}>
                <span className={s.tagsLabel}>Pain-point options</span>
                <div className={s.tags}>{painPoints.map((p) => <span key={p} className={s.tag}>{p}</span>)}</div>
              </div>
            )}
            {design.tech_pack && Object.keys(design.tech_pack).length > 0 && (
              <div className={s.techPack}>
                <span className={s.tagsLabel}>Tech-pack</span>
                <dl className={s.specs}>
                  {Object.entries(design.tech_pack).map(([k, v]) => (
                    <div key={k} className={s.specRow}>
                      <dt>{k.replace(/_/g, ' ')}</dt>
                      <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>
        )}
      </DetailShell>

      <ConfirmDialog
        open={pending !== null}
        title={pending === 'archived' ? 'Archive design' : 'Publish design'}
        variant={pending === 'archived' ? 'danger' : 'primary'}
        confirmLabel={pending === 'archived' ? 'Archive' : 'Publish'}
        loading={busy}
        message={
          pending === 'archived'
            ? (design.live_hub_count ?? 0) > 0
              ? `"${design.name}" is live at ${design.live_hub_count} hub${design.live_hub_count === 1 ? '' : 's'}. Archiving removes it from the active library; existing listings stay until the catalog manager unlists them. Continue?`
              : `Archive "${design.name}"? It moves out of the active library and can be restored to draft later.`
            : `Publish "${design.name}"? It becomes available for the catalog manager to sample and list.`
        }
        onConfirm={() => pending && changeStatus(pending)}
        onCancel={() => setPending(null)}
      />

      <DesignEditorModal
        open={editorOpen}
        designId={design.id}
        onClose={() => closeAndCleanUrl(() => setEditorOpen(false), '/edit')}
        onSaved={() => { setEditorOpen(false); reload(); }}
      />

      <CutSheetModal
        open={cutSheetOpen}
        designId={design.id}
        onClose={() => closeAndCleanUrl(() => setCutSheetOpen(false), '/cut-sheet')}
      />
    </div>
  );
};

export default DesignDetailPage;
