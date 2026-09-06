import { useUrlParam, useUrlFlag } from '../../hooks/useOverviewFilters';
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { designsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { DesignSummary } from '../../api/adminApi';
import DesignEditorModal from './DesignEditorPage';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import styles from './DesignLibraryPage.module.css';
import { UilImage, UilAngleRightB, UilLayerGroup, UilPlus } from '@iconscout/react-unicons';
import { Button } from '../../components/Button/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components';

// G-34 lifecycle chip: where is this design in its life? (sampled → reviewed → live)
function lifecycle(d: DesignSummary): { status: string; label: string } | null {
  if ((d.live_hub_count ?? 0) > 0)
    return { status: 'done', label: `Live · ${d.live_hub_count} hub${d.live_hub_count === 1 ? '' : 's'}` };
  if (d.has_reviewed_sample) return { status: 'fit', label: 'Reviewed — ready to list' };
  if ((d.sample_count ?? 0) > 0) return { status: 'making', label: 'Sampled' };
  if (d.status === 'published') return { status: 'qc', label: 'Never listed' }; // dead design
  return null;
}

const photoUrl = (key?: string | null) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return dv;
}

export const DesignLibraryPage: React.FC<{ autoNew?: boolean }> = ({ autoNew }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // [DSG-10-3] The wizard's open state IS the URL. It used to be local state that the
  // "New design" button set directly, so the button pushed no history entry: a designer
  // five steps in who pressed browser-back — the reflexive "close this" gesture — left the
  // page entirely and lost the work, with the ● Unsaved badge on screen and no prompt
  // (`beforeunload` does not fire for an in-app route change). The /new route already
  // existed and already behaved; the button just wasn't using it.
  //
  // Deriving from the URL rather than syncing to it matters: navigating /library → /new
  // renders the same component with a different prop, so React does not remount and an
  // initial-state read of `autoNew` would never fire.
  const editorOpen = Boolean(autoNew);
  const openEditor = () => navigate('/admin/design/library/new');
  const closeEditor = () => {
    // `replace` so closing doesn't leave /new in history for back to re-open.
    if (location.pathname.endsWith('/new')) navigate('/admin/design/library', { replace: true });
  };
  // [DSG-9-3] The THIRD console with this gap (after SHL-5-2 oversight and the CMS lists),
  // against the repo's own convention: "deep-links carry context; back must preserve list
  // filters". Selecting "Published, never listed" left the URL bare, so refresh, back and
  // sharing all lost the view — and that view is an exception queue someone is meant to
  // hand to a colleague. One shared helper, as the finding asked, not a third bespoke fix.
  const [status, setStatus] = useUrlParam('status');
  const [gender, setGender] = useUrlParam('gender');
  const [search, setSearch] = useUrlParam('q');
  const [sortParam, setSort] = useUrlParam('sort', 'newest');
  const sort = (sortParam === 'best_fit' ? 'best_fit' : 'newest') as 'newest' | 'best_fit';
  const [deadOnly, setDeadOnly] = useUrlFlag('dead'); // G-34: published, never listed
  const [samplePending, setSamplePending] = useUrlFlag('sample_pending'); // §4C: not yet sample-reviewed
  const [tag, setTag] = useUrlParam('tag'); // T3-5 (W-D3): active tag/drop filter
  const [tagOptions, setTagOptions] = React.useState<{ tag: string; count: number }[]>([]);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const q = useDebounce(search, 350);

  const anyFilter = Boolean(status || gender || search || deadOnly || samplePending || tag);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const PAGE = 48;
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);

  // load(reset=true) replaces the list (filter change); load(false) appends the next page.
  const load = React.useCallback(
    (reset: boolean, offset = 0) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      designsApi
        // T1-28: the money chips are now server-side, so they're correct across pagination.
        .list({ status: status || undefined, gender: gender || undefined, q: q || undefined, tag: tag || undefined, dead: deadOnly || undefined, sample_pending: samplePending || undefined, sort, limit: PAGE, offset })
        .then((rows) => {
          setDesigns((prev) => (reset ? rows : [...prev, ...rows]));
          setHasMore(rows.length === PAGE);
        })
        .catch((e) => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
        .finally(() => (reset ? setLoading(false) : setLoadingMore(false)));
    },
    [status, gender, q, sort, deadOnly, samplePending, tag],
  );

  React.useEffect(() => { load(true, 0); }, [load]);

  // T3-5 (W-D3): the tag/drop options for the filter — refreshed when the editor closes
  // (a save may add a new tag).
  React.useEffect(() => {
    if (editorOpen) return;
    designsApi.tags().then(setTagOptions).catch(() => {});
  }, [editorOpen]);

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={base.pageHeader}>
        <div>
          <h1 className={base.title}>Design Library</h1>
          <p className={base.subtitle}>
            Every design you've created. Author it here, pair it with fabric, request a sample — then catalog lists it for customers to buy.
          </p>
        </div>
        <Button variant="primary" onClick={openEditor}>
          <UilPlus size={16} /> New design
        </Button>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search designs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select className={styles.sel} value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">All genders</option>
          <option value="men">Men</option>
          <option value="women">Women</option>
          <option value="unisex">Unisex</option>
        </select>
        {/* T3-5 (W-D3): jump to a drop/tag without remembering exact spelling. */}
        {tagOptions.length > 0 && (
          <select className={styles.sel} value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tagOptions.map((t) => (
              <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>
            ))}
          </select>
        )}
        <select className={styles.sel} value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'best_fit')}>
          <option value="newest">Sort: Newest</option>
          <option value="best_fit">Sort: Best fit</option>
        </select>
        <span className={styles.toolbarDivider} aria-hidden="true" />
        <button
          className={`${base.viewChip} ${deadOnly ? base.viewChipActive : ''}`}
          onClick={() => setDeadOnly(!deadOnly)}
          title="Published designs that aren't listed at any hub"
        >
          Published, never listed
        </button>
        <button
          className={`${base.viewChip} ${samplePending ? base.viewChipActive : ''}`}
          onClick={() => setSamplePending(!samplePending)}
          title="Designs that haven't passed sample review yet"
        >
          Sample pending
        </button>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.cardSkeleton}`}>
              <div className={styles.thumbSkeleton} />
              <div className={styles.cardBody}>
                <div className={styles.lineSkeleton} />
                <div className={`${styles.lineSkeleton} ${styles.lineShort}`} />
              </div>
            </div>
          ))}
        </div>
      ) : (() => {
        // T1-28: the chip filters (dead / sample-pending) are applied server-side now, so the
        // list is correct across pagination — no client-side filtering that misses later pages.
        const shown = designs;
        if (shown.length === 0)
          return anyFilter ? (
            <EmptyState
              icon={<UilImage size={30} />}
              title="Nothing matches these filters"
              body="Clear the filters to see the full library."
              action={{ label: 'Clear filters', onClick: () => { setStatus(''); setGender(''); setSearch(''); setDeadOnly(false); setSamplePending(false); setTag(''); } }}
            />
          ) : (
            <EmptyState
              icon={<UilImage size={30} />}
              title="No designs yet"
              body="Create your first design — pair it with fabric, sample it, then list it."
              action={{ label: 'New design', onClick: openEditor }}
            />
          );
        return (
        <div className={styles.grid}>
          {shown.map((d) => {
            const cover = photoUrl(d.cover_key);
            const lc = lifecycle(d);
            return (
              <Link key={d.id} to={`/admin/design/library/${d.id}`} className={styles.card}>
                <div className={`${styles.thumb} ${cover ? '' : styles.thumbNone}`}>
                  {cover ? (
                    <img src={cover} alt={d.name} />
                  ) : (
                    <div className={styles.thumbEmpty}>
                      <UilImage size={28} />
                      <span>No image</span>
                    </div>
                  )}
                  <span className={styles.cardPill}>
                    <StatusBadge status={d.status} size="sm" />
                  </span>
                  {/* [KA3-3] This rendered ONLY when the design has no sample, so a design
                      that already has one lost the slot entirely and the row of cards looked
                      inconsistent for no stated reason. A card that silently drops an action
                      teaches the operator that the UI is unreliable rather than that the
                      state differs. The slot always says something now: request one, or how
                      many exist and a way to them. */}
                  {(d.sample_count ?? 0) > 0 && (
                    <button
                      type="button"
                      className={styles.quickAction}
                      title="View this design's samples"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/admin/design/samples?design=${d.id}`);
                      }}
                    >
                      {d.sample_count} sample{d.sample_count === 1 ? '' : 's'} →
                    </button>
                  )}
                  {(d.sample_count ?? 0) === 0 && (
                    <button
                      type="button"
                      className={styles.quickAction}
                      title="Request a sample for this design"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/admin/design/samples?design=${d.id}`);
                      }}
                    >
                      <UilPlus size={13} /> Request sample
                    </button>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{d.name}</div>
                  <div className={styles.cardSub}>
                    {d.garment_type}
                    {d.design_garment_type ? ` · ${d.design_garment_type}` : ''}
                    {d.gender ? ` · ${d.gender}` : ''}
                    {d.fit_preset ? ` · ${d.fit_preset}` : ''}
                  </div>
                  {lc && (
                    <div className={styles.lifecycleRow}>
                      <StatusBadge status={lc.status} label={lc.label} size="sm" />
                    </div>
                  )}
                  {/* T3-5 (W-D3): tags / drop labels — click to filter to that drop. */}
                  {d.tags && d.tags.length > 0 && (
                    <div className={styles.tagRow}>
                      {d.tags.slice(0, 4).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={styles.tagPill}
                          onClick={(e) => { e.preventDefault(); setTag(t); }}
                          title={`Filter to “${t}”`}
                        >
                          {t}
                        </button>
                      ))}
                      {d.tags.length > 4 && <span className={styles.tagMore}>+{d.tags.length - 4}</span>}
                    </div>
                  )}
                  {d.fabric_swatches && d.fabric_swatches.length > 0 && (
                    <div className={styles.swatchChips}>
                      {d.fabric_swatches.slice(0, 5).map((k, i) => (
                        <span key={i} className={styles.swatchChip}><img src={photoUrl(k)} alt="" /></span>
                      ))}
                      {d.fabric_swatches.length > 5 && <span className={styles.swatchMore}>+{d.fabric_swatches.length - 5}</span>}
                    </div>
                  )}
                  <div className={styles.cardMeta}>
                    <span>
                      <UilLayerGroup size={13} /> {d.fabric_count} fabric
                      {d.fabric_count === 1 ? '' : 's'}
                      {d.avg_fit != null ? ` · ★ ${d.avg_fit} fit` : ''}
                    </span>
                    <span className={styles.reviewLink}>
                      Open <UilAngleRightB size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        );
      })()}

      {!loading && hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-lg)' }}>
          <Button variant="outline" state={loadingMore ? 'loading' : 'default'} onClick={() => load(false, designs.length)}>
            Load more
          </Button>
        </div>
      )}

      <DesignEditorModal
        open={editorOpen}
        onClose={closeEditor}
        onSaved={() => { closeEditor(); load(true, 0); }}
      />
    </div>
  );
};

export default DesignLibraryPage;
