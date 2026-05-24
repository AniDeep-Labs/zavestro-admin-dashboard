import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Plus, GripVertical, Image } from 'lucide-react';
import { collectionsApi } from '../../api/adminApi';
import type { Collection } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './CollectionsListPage.module.css';

export const CollectionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('All');

  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    setLoading(true);
    setError('');
    collectionsApi.list({
      search: search || undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
    })
      .then(res => { setCollections(res.collections ?? []); setTotal(res.total ?? 0); })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load collections'))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  const handleArchive = async (e: React.MouseEvent, col: Collection) => {
    e.stopPropagation();
    if (!confirm(`Archive "${col.name}"?`)) return;
    try {
      await collectionsApi.archive(col.id);
      setCollections(prev => prev.filter(c => c.id !== col.id));
      setTotal(t => t - 1);
      showToast('success', 'Collection archived', col.name);
    } catch (err) {
      showToast('error', 'Archive failed', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Collections</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/catalog/collections/new')}>
          <Plus size={15}/> Create Collection
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
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
          <X size={14}/> Clear
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
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
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j}><div className={styles.skeleton} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  <div>{error}</div>
                  <button className={styles.retryBtn} onClick={() => { setError(''); }}>Retry</button>
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No collections found.</td></tr>
            ) : (
              collections.map(col => (
                <tr key={col.id} className={styles.row} onClick={() => navigate(`/admin/catalog/collections/${col.id}`)} style={{ cursor: 'pointer' }}>
                  <td className={styles.dragHandle} onClick={e => e.stopPropagation()}><GripVertical size={14}/></td>
                  <td>
                    <button className={styles.nameLink} onClick={e => { e.stopPropagation(); navigate(`/admin/catalog/collections/${col.id}`); }}>
                      {col.name}
                    </button>
                    <div className={styles.slug}>/{col.slug}</div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: col.type === 'new_arrivals' ? '#e6f3ee' : col.type === 'occasion' ? '#f3e6f0' : col.type === 'featured' ? '#fef3e6' : 'var(--color-bg-secondary)',
                      color: col.type === 'new_arrivals' ? '#1C5C42' : col.type === 'occasion' ? '#7a1c5c' : col.type === 'featured' ? '#9a5c00' : 'var(--color-text-secondary)',
                    }}>
                      {col.type ?? 'standard'}
                    </span>
                  </td>
                  <td className={styles.count}>{col.products}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status${col.status}`]}`}>
                      {col.status}
                    </span>
                  </td>
                  <td className={styles.sortOrder}>#{col.sortOrder}</td>
                  <td>
                    {col.hasBanner
                      ? <div className={styles.bannerThumb}><Image size={14}/></div>
                      : <span className={styles.noBanner}>—</span>}
                  </td>
                  <td className={styles.date}>{col.updated}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => navigate(`/admin/catalog/collections/${col.id}`)}>Edit</button>
                      <button className={styles.archiveBtn} onClick={e => handleArchive(e, col)}>Archive</button>
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
    </div>
  );
};
