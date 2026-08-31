import { useUrlParam, useUrlEditor } from '../../hooks/useOverviewFilters';
import React from 'react';
import { collectionsApi } from '../../api/adminApi';
import type { Collection } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './CollectionsListPage.module.css';
import { UilImage, UilPlus, UilSearch, UilTimes } from "@iconscout/react-unicons";
import { StatusBadge } from '../../components';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal/Modal';
import { CollectionEditPage } from './CollectionEditPage';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

// Human labels for the collection-type chip (DB values are snake_case).
const TYPE_LABEL: Record<string, string> = {
  standard: 'Standard', new_arrivals: 'New Arrivals', occasion: 'Occasion', featured: 'Featured',
};
const TYPE_CLASS: Record<string, string> = {
  new_arrivals: styles.typeNewArrivals, occasion: styles.typeOccasion, featured: styles.typeFeatured,
};

export const CollectionsListPage: React.FC = () => {
  // [CM-21-10] Search + status filter live in the URL, so refresh and back keep them and
  // a filtered list can be sent to a colleague.
  const [search, setSearch] = useUrlParam('q');
  const [statusFilter, setStatusFilter] = useUrlParam('status', 'All');
  const debouncedSearch = useDebounce(search, 300);

  const [collections, setCollections] = React.useState<Collection[]>([]);
  // [CM-21-3] Published, and empty. Computed from what the list already carries.
  const emptyLive = React.useMemo(
    () => collections.filter(c => c.status === 'Active' && (c.products ?? 0) === 0),
    [collections],
  );
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [archiveTarget, setArchiveTarget] = React.useState<Collection | null>(null);
  const [archiving, setArchiving] = React.useState(false);
  // Create/Edit open in a popup modal (like banners): 'new' | collectionId | null.
  // [CM-21-10] ...and so does the open editor. The route /catalog/collections/:id already
  // renders this same component as a full page, while the list opened it in a modal with
  // no address at all — so "the collection I'm editing" could not be linked, and Back left
  // the list instead of closing the modal.
  const [editorId, setEditorId] = useUrlEditor();

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  const load = React.useCallback(() => {
    setLoading(true);
    setError('');
    collectionsApi.list({
      search: debouncedSearch || undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
    })
      .then(res => { setCollections(res.collections ?? []); setTotal(res.total ?? 0); })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load collections'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await collectionsApi.archive(archiveTarget.id);
      setCollections(prev => prev.filter(c => c.id !== archiveTarget.id));
      setTotal(t => t - 1);
      showToast('success', 'Collection archived', archiveTarget.name);
      setArchiveTarget(null);
    } catch (err) {
      showToast('error', 'Archive failed', err instanceof Error ? err.message : undefined);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Collections</h1>
        <button className={styles.addBtn} onClick={() => setEditorId('new')}>
          <UilPlus size={15}/> Create Collection
        </button>
      </div>

      {/* [CM-21-3] A live collection with nothing in it is a rail that lands the customer
          on an empty page. Nothing blocked publishing one, and nothing marked it
          afterwards — the row honestly showed "0", and a zero in a column reads as a
          quiet fact rather than a problem. This is the same exception strip the Listings
          page uses for out-of-stock: the count was always there; what was missing was
          anyone saying it mattered. */}
      {emptyLive.length > 0 && (
        <div className={styles.emptyLiveWarn} role="status">
          <strong>{emptyLive.length} live {emptyLive.length === 1 ? 'collection has' : 'collections have'} no products.</strong>{' '}
          Each one is a storefront rail that opens an empty page: {emptyLive.map(c => c.name).join(' · ')}
        </div>
      )}

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search collections…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          <option>Active</option>
          <option>Draft</option>
          <option>Archived</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter('All'); }}>
          <UilTimes size={14}/> Clear
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Collection Name</th>
              <th>Type</th>
              <th>Products</th>
              <th>Status</th>
              <th>Sort</th>
              <th>Banner</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j}><div className={styles.skeleton} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  <div>{error}</div>
                  <button className={styles.retryBtn} onClick={() => load()}>Retry</button>
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No collections found.</td></tr>
            ) : (
              collections.map(col => (
                <tr key={col.id} className={`${styles.row} ${styles.clickRow}`} {...rowActivation(() => setEditorId(col.id))}>
                  <td>
                    <button className={styles.nameLink} onClick={e => { e.stopPropagation(); setEditorId(col.id); }}>
                      {col.name}
                    </button>
                    <div className={styles.slug}>/{col.slug}</div>
                  </td>
                  <td>
                    <span className={`${styles.typeChip} ${TYPE_CLASS[col.type ?? 'standard'] ?? ''}`}>
                      {TYPE_LABEL[col.type ?? 'standard'] ?? col.type}
                    </span>
                  </td>
                  <td className={styles.count}>{col.products}</td>
                  <td>
                    <StatusBadge status={col.status.toLowerCase()} label={col.status} />
                  </td>
                  <td className={styles.sortOrder}>#{col.sortOrder}</td>
                  <td>
                    {col.hasBanner
                      ? <div className={styles.bannerThumb}><UilImage size={14}/></div>
                      : <span className={styles.noBanner}>—</span>}
                  </td>
                  <td className={styles.date}>{col.updated}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => setEditorId(col.id)}>Edit</button>
                      <button className={styles.archiveBtn} onClick={e => { e.stopPropagation(); setArchiveTarget(col); }}>Archive</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        {loading ? 'Loading…' : `Showing ${collections.length} of ${total} collections`}
      </div>

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive this collection?"
        message={archiveTarget ? `Archive “${archiveTarget.name}”? It will be hidden from the storefront. You can restore it later.` : ''}
        confirmLabel="Archive"
        variant="danger"
        loading={archiving}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />

      {/* Create / Edit collection — popup modal (like banners) */}
      <Modal
        open={editorId !== null}
        onClose={() => setEditorId(null)}
        title={editorId === 'new' ? 'Create Collection' : 'Edit Collection'}
        size="lg"
        className={styles.editorModal}
      >
        {editorId !== null && (
          <CollectionEditPage
            idProp={editorId}
            onClose={() => setEditorId(null)}
            onSaved={load}
          />
        )}
      </Modal>
    </div>
  );
};
