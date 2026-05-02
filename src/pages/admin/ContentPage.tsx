import React from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import styles from './ContentPage.module.css';

type Section = 'lookbook' | 'craftspeople' | 'stories' | 'journal';

const SECTIONS: Record<Section, { title: string; columns: string[]; items: Record<string, string>[] }> = {
  lookbook: {
    title: 'Lookbook',
    columns: ['Title', 'Occasion', 'Status', 'Products', 'Published', 'Actions'],
    items: [],
  },
  craftspeople: {
    title: 'Craftspeople',
    columns: ['Name', 'Role', 'Hub', 'Status', 'Published', 'Actions'],
    items: [],
  },
  stories: {
    title: 'Customer Stories',
    columns: ['Customer', 'City', 'Rating', 'Mode', 'Status', 'Actions'],
    items: [],
  },
  journal: {
    title: 'Journal',
    columns: ['Title', 'Category', 'Author', 'Status', 'Read Time', 'Published', 'Actions'],
    items: [],
  },
};

export const ContentPage: React.FC = () => {
  const { section = 'lookbook' } = useParams<{ section?: string }>();
  const [search, setSearch] = React.useState('');

  const validSection = (section as Section) in SECTIONS ? (section as Section) : 'lookbook';
  const data = SECTIONS[validSection];
  const firstKey = data.columns[0];

  const filtered = data.items.filter(item =>
    !search || Object.values(item).some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{data.title}</h1>
        <button className={styles.addBtn}><Plus size={15}/> Add Entry</button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder={`Search ${data.title.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className={styles.clearBtn} onClick={() => setSearch('')}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {data.columns.map(col => <th key={col}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={data.columns.length} className={styles.empty}>No entries found.</td></tr>
            ) : (
              filtered.map((item, i) => (
                <tr key={i} className={styles.row}>
                  {data.columns.map(col => (
                    <td key={col}>
                      {col === 'Actions' ? (
                        <div className={styles.actions}>
                          <button className={styles.actionBtn}>Edit</button>
                          <button className={styles.actionBtn}>Duplicate</button>
                          <button className={styles.archiveBtn}>Archive</button>
                        </div>
                      ) : col === 'Status' ? (
                        <span className={`${styles.statusPill} ${item[col] === 'Active' ? styles.statusActive : styles.statusDraft}`}>
                          {item[col]}
                        </span>
                      ) : col === firstKey ? (
                        <span className={styles.primaryCell}>{item[col]}</span>
                      ) : (
                        item[col] || '—'
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
