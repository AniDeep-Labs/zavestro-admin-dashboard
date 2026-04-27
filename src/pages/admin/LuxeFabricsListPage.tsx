import React from 'react';
import { useNavigate } from 'react-router-dom';
import { luxeFabrics } from '../../data/adminMockData';
import styles from './LuxeFabricsListPage.module.css';

const MATERIALS = ['All', 'Silk', 'Banarasi', 'Organza', 'Handloom', 'Cotton Blend', 'Chiffon', 'Velvet', 'Georgette', 'Crepe'];
const OCCASIONS = ['All', 'Wedding', 'Festive', 'Formal', 'Celebration'];

export const LuxeFabricsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [materialFilter, setMaterialFilter] = React.useState('All');
  const [occasionFilter, setOccasionFilter] = React.useState('All');
  const [statusFilter, setStatusFilter] = React.useState('All');

  const filtered = luxeFabrics.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchMaterial = materialFilter === 'All' || f.material === materialFilter;
    const matchOccasion = occasionFilter === 'All' || f.occasions.includes(occasionFilter);
    const matchStatus = statusFilter === 'All' || f.status === statusFilter;
    return matchSearch && matchMaterial && matchOccasion && matchStatus;
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Luxe Fabrics</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/catalog/luxe-fabrics/new')}>
          + Add Fabric
        </button>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          placeholder="Search fabrics…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
          Clear
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
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No fabrics found.</td></tr>
            ) : (
              filtered.map(f => (
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
                  <td>
                    <div className={styles.swatchThumb}>🎨</div>
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status${f.status}`]}`}>
                      {f.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => navigate(`/admin/catalog/luxe-fabrics/${f.id}`)}>Edit</button>
                      <button className={styles.archiveBtn}>Archive</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        Showing {filtered.length} of {luxeFabrics.length} fabrics
      </div>
    </div>
  );
};
