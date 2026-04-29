import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Plus, Palette } from 'lucide-react';
import { luxeFabricsApi } from '../../api/adminApi';
import type { LuxeFabric } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './LuxeFabricsListPage.module.css';

const MATERIALS = ['All', 'Silk', 'Banarasi', 'Organza', 'Handloom', 'Cotton Blend', 'Chiffon', 'Velvet', 'Georgette', 'Crepe'];
const OCCASIONS = ['All', 'Wedding', 'Festive', 'Formal', 'Celebration'];

export const LuxeFabricsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [materialFilter, setMaterialFilter] = React.useState('All');
  const [occasionFilter, setOccasionFilter] = React.useState('All');
  const [statusFilter, setStatusFilter] = React.useState('All');

  const [fabrics, setFabrics] = React.useState<LuxeFabric[]>([]);
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
    luxeFabricsApi.list({
      search: search || undefined,
      material: materialFilter !== 'All' ? materialFilter : undefined,
      occasion: occasionFilter !== 'All' ? occasionFilter : undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
    })
      .then(res => { setFabrics(res.fabrics ?? []); setTotal(res.total ?? 0); })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load fabrics'))
      .finally(() => setLoading(false));
  }, [search, materialFilter, occasionFilter, statusFilter]);

  const handleArchive = async (e: React.MouseEvent, fabric: LuxeFabric) => {
    e.stopPropagation();
    if (!confirm(`Archive "${fabric.name}"?`)) return;
    try {
      await luxeFabricsApi.update(fabric.id, { status: 'Archived' });
      setFabrics(prev => prev.filter(f => f.id !== fabric.id));
      setTotal(t => t - 1);
      showToast('success', 'Fabric archived', fabric.name);
    } catch (err) {
      showToast('error', 'Archive failed', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Luxe Fabrics</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/catalog/luxe-fabrics/new')}>
          <Plus size={15}/> Add Fabric
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search fabrics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className={styles.filterSelect} value={materialFilter} onChange={e => setMaterialFilter(e.target.value)}>
          {MATERIALS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select className={styles.filterSelect} value={occasionFilter} onChange={e => setOccasionFilter(e.target.value)}>
          {OCCASIONS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option>Active</option>
          <option>Draft</option>
          <option>Archived</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setMaterialFilter('All'); setOccasionFilter('All'); setStatusFilter('All'); }}>
          <X size={14}/> Clear
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fabric Name</th>
              <th>Material</th>
              <th>Origin</th>
              <th>Occasions</th>
              <th>Swatch</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j}><div className={styles.skeleton} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  <div>{error}</div>
                  <button className={styles.retryBtn} onClick={() => { setError(''); }}>Retry</button>
                </td>
              </tr>
            ) : fabrics.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No fabrics found.</td></tr>
            ) : (
              fabrics.map(f => (
                <tr key={f.id} className={styles.row}>
                  <td>
                    <button className={styles.nameLink} onClick={() => navigate(`/admin/catalog/luxe-fabrics/${f.id}`)}>
                      {f.name}
                    </button>
                    {f.featuredForSwatchKit && <span className={styles.swatchBadge}>Swatch Kit</span>}
                  </td>
                  <td className={styles.material}>{f.material}</td>
                  <td className={styles.origin}>{f.origin}</td>
                  <td>
                    <div className={styles.occasionChips}>
                      {f.occasions.map(o => <span key={o} className={styles.occasionChip}>{o}</span>)}
                    </div>
                  </td>
                  <td><div className={styles.swatchThumb}><Palette size={14}/></div></td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status${f.status}`]}`}>
                      {f.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => navigate(`/admin/catalog/luxe-fabrics/${f.id}`)}>Edit</button>
                      {f.status !== 'Archived' && (
                        <button className={styles.archiveBtn} onClick={e => handleArchive(e, f)}>Archive</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        {loading ? 'Loading…' : `Showing ${fabrics.length} of ${total} fabrics`}
      </div>
    </div>
  );
};
