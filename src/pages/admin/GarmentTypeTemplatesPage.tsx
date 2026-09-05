import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { designsApi } from '../../api/adminApi';
import type { GarmentCategoryOption } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal/Modal';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import styles from './OrdersListPage.module.css';
import { UilAngleRightB, UilPlus, UilTimes, UilTrashAlt } from '@iconscout/react-unicons';
import { StatusBadge } from '../../components';
import {
  DRAFTING_BLOCKS,
  DRAFTING_BLOCK_HINTS,
  DRAFTING_BLOCK_LABELS,
  type DraftingBlock,
} from '../../constants/draftingBlock';

export const GarmentTypeTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [cats, setCats] = React.useState<GarmentCategoryOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  // ── guarded delete ──
  const [delTarget, setDelTarget] = React.useState<GarmentCategoryOption | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const confirmDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await designsApi.deleteGarmentCategory(delTarget.id);
      setCats((prev) => prev.filter((c) => c.id !== delTarget.id));
      toast('success', `Deleted "${delTarget.name}"`);
      setDelTarget(null);
    } catch (e) {
      toast('error', 'Could not delete', e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  // ── create-category form (design self-serve) ──
  const [showCreate, setShowCreate] = React.useState(false);
  const [cName, setCName] = React.useState('');
  // [DSG-11-7] The author picks the BLOCK, and the body region follows from it. Before this
  // the choice was upper/lower only, so every womenswear garment was created "upper" and
  // drafted through the men's block — the engine's women's path (bust, bust dart,
  // silhouette) was unreachable from this console for the whole womenswear catalogue.
  const [cBlock, setCBlock] = React.useState<DraftingBlock>('mens_upper');
  const cRegion: 'upper' | 'lower' = cBlock === 'lower' ? 'lower' : 'upper';
  const [cTypes, setCTypes] = React.useState<string[]>([]);
  const [typeDraft, setTypeDraft] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const resetCreate = () => {
    setShowCreate(false); setCName(''); setCBlock('mens_upper'); setCTypes([]); setTypeDraft('');
  };
  const addType = () => {
    const t = typeDraft.trim();
    if (t && !cTypes.includes(t)) setCTypes([...cTypes, t]);
    setTypeDraft('');
  };
  const submitCreate = async () => {
    if (!cName.trim()) { toast('error', 'Name the garment type'); return; }
    setCreating(true);
    try {
      const created = await designsApi.createGarmentCategory({
        name: cName.trim(), body_region: cRegion, drafting_block: cBlock, garment_types: cTypes,
      });
      toast('success', `Created "${created.name}"`, 'Now set its chart, capture-set & fit presets.');
      resetCreate();
      navigate(`/admin/design/templates/${created.id}`);
    } catch (e) {
      toast('error', 'Could not create', e instanceof Error ? e.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  // [DSG-11-12] A failed load is not an empty library.
  //
  // The catch toasted "Load failed" and left `cats` at [], so the counter flipped to
  // "0 of 0" and the table said "No garment types yet — create your first." — inviting the
  // designer to author a duplicate of a garment type that already exists. That either 409s
  // on the slug or, under a different name, silently forks the fit recipe.
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    designsApi
      .garmentCategories()
      .then(setCats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load garment types.'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const captureCount = (c: GarmentCategoryOption) =>
    Array.isArray(c.capture_set) ? (c.capture_set as string[]).length : 0;

  const [query, setQuery] = React.useState('');
  const shown = query.trim()
    ? cats.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : cats;

  if (error) {
    // The server's own message, and a way back — not an invitation to create something
    // that may already exist.
    return (
      <div className={styles.page}>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
        <EmptyState
          title="Couldn't load garment types"
          body={error}
          action={{ label: 'Retry', onClick: load }}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Garment Types &amp; Fit</h1>
          <p className={styles.subtitle}>
            The fit recipe behind every design. For each garment type, set the size chart (measurements per size), the ease for each fit (slim / regular / relaxed) and what the agent measures. Every design of this type inherits it.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <UilPlus size={16} /> New garment type
        </Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', margin: '0 0 var(--spacing-md)' }}>
        <input
          className={styles.searchInput}
          style={{ maxWidth: 340 }}
          placeholder="Search garment types…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className={styles.pagination}>{loading ? '' : `${shown.length} of ${cats.length}`}</span>
      </div>

      {/* [KA3-8] "N of 7 have no fit recipe" is the single most important fact in this
          console, and the page presented it only as N identical rows saying "Needs setup" —
          a reader had to count them, and a count of rows is not a summary. It says the
          number once, up front, and what it costs: a garment type with no recipe cannot be
          drafted, so every design of that type is blocked behind it. */}
      {!loading && cats.length > 0 && (() => {
        const ready = cats.filter(
          (c) => captureCount(c) > 0 ||
            ((c.calibrated_fit_presets != null ? c.calibrated_fit_presets : (c.available_fit_presets ?? [])).length > 0),
        ).length;
        const missing = cats.length - ready;
        if (missing === 0) {
          return (
            <p className={styles.rollup}>
              All {cats.length} garment types have a fit recipe.
            </p>
          );
        }
        return (
          <p className={`${styles.rollup} ${styles.rollupWarn}`}>
            <strong>{missing} of {cats.length}</strong> garment types have no fit recipe yet —
            the engine cannot draft them, so every design of those types is blocked until one exists.
          </p>
        );
      })()}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Garment type</th><th>Cuts</th><th>Body region</th><th>Measured fields</th><th>Fits</th><th>Used by</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : shown.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>{cats.length === 0 ? 'No garment types yet — create your first.' : 'No garment types match your search.'}</td></tr>
            ) : (
              shown.map((c) => {
                // [DSG-11-5] Read what the ENGINE can run, not what somebody typed.
                //
                // This graded readiness from `available_fit_presets` and `capture_set` — both
                // authored columns, both NULL on all seven garment types — so every row read
                // "FITS none · Needs setup", including Trouser with a 7-size chart, 3 calibrated
                // presets, 3 length bands and a live design. The same API response already
                // carries `calibrated_fit_presets` (['loose','skinny','straight'] for Trouser),
                // whose own declaration says *use THIS, not the authored column above*.
                //
                // Two screens disagreed about one template: this index said "Needs setup" while
                // the editor of the same template said "✓ Ready to use". The editor was right.
                const authored = c.available_fit_presets ?? [];
                const calibrated = c.calibrated_fit_presets ?? [];
                // Prefer calibrated; fall back to authored only when the derived field is absent
                // (an older API response), never when it is present and empty.
                const presets = c.calibrated_fit_presets != null ? calibrated : authored;
                const configured = captureCount(c) > 0 || presets.length > 0;
                const usedBy = c.used_by_designs ?? 0;
                // [DSG-11-13] The server refuses a delete on designs OR customer fit
                // profiles OR storefront categories. The button knew only the first, so a
                // type used by 50 fit profiles and 0 designs offered an enabled bin, opened
                // the confirm, and failed with a 409 — after the operator had committed to
                // it. On this data 5 of 18 types are in exactly that state.
                const blockers = [
                  usedBy > 0 ? `${usedBy} design${usedBy === 1 ? '' : 's'}` : null,
                  (c.used_by_storefront_categories ?? 0) > 0
                    ? `${c.used_by_storefront_categories} storefront categor${c.used_by_storefront_categories === 1 ? 'y' : 'ies'}`
                    : null,
                  (c.used_by_fit_profiles ?? 0) > 0
                    ? `${c.used_by_fit_profiles} customer fit profile${c.used_by_fit_profiles === 1 ? '' : 's'}`
                    : null,
                ].filter(Boolean) as string[];
                const deleteBlocked = blockers.length > 0;
                return (
                  <tr key={c.id} className={styles.row}>
                    <td className={styles.customerName} style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {c.garment_types && c.garment_types.length
                        ? c.garment_types.join(', ')
                        : <span style={{ opacity: 0.5 }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {c.drafting_block
                        ? DRAFTING_BLOCK_LABELS[c.drafting_block as DraftingBlock] ?? c.drafting_block
                        : (c.body_region ?? '—')}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {captureCount(c) > 0 ? `${captureCount(c)} fields` : <span style={{ opacity: 0.5 }}>none</span>}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {presets.length ? presets.join(', ') : <span style={{ opacity: 0.5 }}>none</span>}
                      {/* An authored preset the engine cannot run is the state worth seeing: the
                          template looks configured and a draft from it would fail. */}
                      {authored.filter((p) => !calibrated.includes(p)).length > 0 && (
                        <span
                          className={styles.uncalibratedNote}
                          title={`Authored but not calibrated — the engine cannot run: ${authored
                            .filter((p) => !calibrated.includes(p))
                            .join(', ')}`}
                        >
                          (+{authored.filter((p) => !calibrated.includes(p)).length} uncalibrated)
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {usedBy > 0 ? `${usedBy} design${usedBy === 1 ? '' : 's'}` : <span style={{ opacity: 0.5 }}>—</span>}
                    </td>
                    <td>
                      <StatusBadge status={configured ? 'configured' : 'incomplete'} label={configured ? 'Configured' : 'Needs setup'} />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title={deleteBlocked ? `In use by ${blockers.join(', ')} — can't delete` : 'Delete this garment type'}
                          disabled={deleteBlocked}
                          onClick={() => setDelTarget(c)}
                          style={{ padding: '4px 8px', opacity: deleteBlocked ? 0.35 : 1, cursor: deleteBlocked ? 'not-allowed' : 'pointer' }}
                        >
                          <UilTrashAlt size={14} />
                        </button>
                        <Link
                          to={`/admin/design/templates/${c.id}`}
                          className={styles.actionBtn}
                          style={{ textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          Edit template <UilAngleRightB size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={resetCreate} title="New garment type" size="sm">
        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Name</label>
            <input
              className={styles.formControl}
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="e.g. Shirt, Trouser, Kurta"
              autoFocus
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Body region</label>
            <select className={styles.formControl} value={cBlock} onChange={(e) => setCBlock(e.target.value as DraftingBlock)}>
              {DRAFTING_BLOCKS.map((b) => (
                <option key={b} value={b}>{DRAFTING_BLOCK_LABELS[b]}</option>
              ))}
            </select>
            <p className={styles.formHint}>{DRAFTING_BLOCK_HINTS[cBlock]}</p>
            <p className={styles.formHint}>Decides which measurements the engine asks for and how the garment is drafted. You can't change this later, so pick carefully.</p>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Cuts it can make (optional)</label>
            <div className={styles.chipAdd}>
              <input
                className={styles.formControl}
                value={typeDraft}
                onChange={(e) => setTypeDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addType(); } }}
                placeholder="e.g. chino, cargo — press Enter"
              />
              <Button variant="ghost" onClick={addType} disabled={!typeDraft.trim()}>Add</Button>
            </div>
            {cTypes.length > 0 && (
              <div className={styles.chipRow}>
                {cTypes.map((t) => (
                  <span key={t} className={styles.typeChip}>
                    {t}
                    <button className={styles.typeChipX} onClick={() => setCTypes(cTypes.filter((x) => x !== t))} type="button" aria-label={`Remove ${t}`}>
                      <UilTimes size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className={styles.formHint}>The cuts within this garment type (e.g. for Trouser: chino, cargo, formal). They all share its measurements &amp; fit.</p>
          </div>
          <p className={styles.formHint} style={{ marginTop: 4 }}>
            We’ll pre-fill the <strong>standard measurement fields + fits</strong> for the body region you pick — you just fill in the size-chart numbers and ease.
          </p>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={resetCreate}>Cancel</Button>
            <Button variant="primary" disabled={!cName.trim() || creating} onClick={submitCreate}>
              {creating ? 'Creating…' : 'Create & set up fit'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={delTarget !== null}
        title={`Delete "${delTarget?.name ?? ''}"?`}
        message="This removes the garment type and its fit recipe (size chart, fits, bands). It's blocked if any design, storefront category, or customer fit profile still uses it."
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
};

export default GarmentTypeTemplatesPage;
