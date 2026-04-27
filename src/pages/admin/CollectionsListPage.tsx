import React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminCollections } from '../../data/adminMockData';
import styles from './CollectionsListPage.module.css';

export const CollectionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState('All');
  const [statusFilter, setStatusFilter] = React.useState('All');

  const filtered = adminCollections.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchMode = modeFilter === 'All' || c.mode === modeFilter;
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchMode && matchStatus;
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Collections</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/catalog/collections/new')}>
          + Create Collection
        </button>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          placeholder="Search collections…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filterSelect} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
          <option>All</option>
          <option>Simplified</option>
          <option>Luxe</option>
          <option>Both</option>
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option>Active</option>
          <option>Draft</option>
          <option>Archived</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setModeFilter('All'); setStatusFilter('All'); }}>
          Clear
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Collection Name</th>
              <th>Mode</th>
              <th>Products</th>
              <th>Status</th>
              <th>Sort</th>
              <th>Banner</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No collections found.</td></tr>
            ) : (
              filtered.map(col => (
                <tr key={col.id} className={styles.row}>
                  <td className={styles.dragHandle}>⠿</td>
                  <td>
                    <button className={styles.nameLink} onClick={() => navigate(`/admin/catalog/collections/${col.id}`)}>
                      {col.name}
                    </button>
                    <div className={styles.slug}>/{col.slug}</div>
                  </td>
                  <td>
                    <span className={`${styles.modePill} ${col.mode === 'Luxe' ? styles.modeLuxe : col.mode === 'Both' ? styles.modeBoth : styles.modeSimplified}`}>
                      {col.mode}
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
                    {col.hasBanner ? (
                      <div className={styles.bannerThumb}>🖼</div>
                    ) : (
                      <span className={styles.noBanner}>—</span>
                    )}
                  </td>
                  <td className={styles.date}>{col.updated}</td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => navigate(`/admin/catalog/collections/${col.id}`)}>Edit</button>
                      <button className={styles.actionBtn}>Duplicate</button>
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
        Showing {filtered.length} of {adminCollections.length} collections
      </div>
    </div>
  );
};
