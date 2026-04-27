import React from 'react';
import { useParams } from 'react-router-dom';
import styles from './ContentPage.module.css';

type Section = 'lookbook' | 'craftspeople' | 'stories' | 'journal';

const SECTIONS: Record<Section, { title: string; columns: string[]; items: Record<string, string>[] }> = {
  lookbook: {
    title: 'Lookbook',
    columns: ['Title', 'Occasion', 'Status', 'Products', 'Published', 'Actions'],
    items: [
      { Title: 'The 2026 Wedding Season', Occasion: 'Wedding', Status: 'Active', Products: '12', Published: '1 Apr 2026' },
      { Title: 'Office Ready — Spring', Occasion: 'Formal', Status: 'Draft', Products: '8', Published: '—' },
      { Title: 'Festive Glow', Occasion: 'Festive', Status: 'Active', Products: '15', Published: '20 Mar 2026' },
    ],
  },
  craftspeople: {
    title: 'Craftspeople',
    columns: ['Name', 'Role', 'Hub', 'Status', 'Published', 'Actions'],
    items: [
      { Name: 'Rajan Kumar', Role: 'Master Tailor', Hub: 'Bengaluru Hub 1', Status: 'Active', Published: '15 Feb 2026' },
      { Name: 'Meena Devi', Role: 'Embroidery Specialist', Hub: 'Mumbai Hub 1', Status: 'Active', Published: '10 Feb 2026' },
      { Name: 'Suresh Nair', Role: 'Pattern Cutter', Hub: 'Chennai Hub 1', Status: 'Draft', Published: '—' },
    ],
  },
  stories: {
    title: 'Customer Stories',
    columns: ['Customer', 'City', 'Rating', 'Mode', 'Status', 'Actions'],
    items: [
      { Customer: 'Priya R.', City: 'Mumbai', Rating: '5 ★', Mode: 'Luxe', Status: 'Active' },
      { Customer: 'Arjun M.', City: 'Delhi', Rating: '4 ★', Mode: 'Simplified', Status: 'Active' },
      { Customer: 'Sunita K.', City: 'Bengaluru', Rating: '5 ★', Mode: 'Simplified', Status: 'Draft' },
    ],
  },
  journal: {
    title: 'Journal',
    columns: ['Title', 'Category', 'Author', 'Status', 'Read Time', 'Published', 'Actions'],
    items: [
      { Title: 'How to pick the right fabric', Category: 'Fabric Guide', Author: 'Zavestro Team', Status: 'Active', 'Read Time': '5 min', Published: '20 Apr 2026' },
      { Title: 'Wedding season dressing guide', Category: 'Occasion Dressing', Author: 'Zavestro Team', Status: 'Active', 'Read Time': '8 min', Published: '10 Apr 2026' },
      { Title: 'The art of a perfect fit', Category: 'Fit & Tailoring', Author: 'Zavestro Team', Status: 'Draft', 'Read Time': '6 min', Published: '—' },
    ],
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
        <button className={styles.addBtn}>+ Add Entry</button>
      </div>

      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder={`Search ${data.title.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.clearBtn} onClick={() => setSearch('')}>Clear</button>
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
