import React from 'react';
import { useParams } from 'react-router-dom';
import { Search, X, Edit2, Info } from 'lucide-react';
import { craftspeopleApi } from '../../api/adminApi';
import type { Craftsperson } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ContentPage.module.css';

type Section = 'lookbook' | 'craftspeople' | 'stories' | 'journal';

const CMS_SECTIONS: Section[] = ['lookbook', 'stories', 'journal'];

const CMS_INFO: Record<string, { title: string; description: string }> = {
  lookbook: {
    title: 'Lookbook',
    description: 'Lookbook entries are managed via the CMS. This section will display published lookbook collections once the CMS integration is complete.',
  },
  stories: {
    title: 'Customer Stories',
    description: 'Customer stories are collected from order feedback and managed via the CMS. They will appear here once the integration is live.',
  },
  journal: {
    title: 'Journal',
    description: 'Journal articles are authored in the CMS. This section will list all published and draft journal posts once connected.',
  },
};

export const ContentPage: React.FC = () => {
  const { section = 'lookbook' } = useParams<{ section?: string }>();
  const [search, setSearch] = React.useState('');
  const [craftspeople, setCraftspeople] = React.useState<Craftsperson[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [craftError, setCraftError] = React.useState('');
  const [editTarget, setEditTarget] = React.useState<Craftsperson | null>(null);
  const [editBio, setEditBio] = React.useState('');
  const [editYears, setEditYears] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const validSection = (section as Section) in { lookbook: 1, craftspeople: 1, stories: 1, journal: 1 }
    ? (section as Section)
    : 'lookbook';

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (validSection !== 'craftspeople') return;
    setLoading(true);
    setCraftError('');
    craftspeopleApi.list()
      .then(data => setCraftspeople(data))
      .catch(e => setCraftError(e instanceof Error ? e.message : 'Failed to load craftspeople'))
      .finally(() => setLoading(false));
  }, [validSection]);

  const openEdit = (p: Craftsperson) => {
    setEditTarget(p);
    setEditBio(p.bio ?? '');
    setEditYears(p.years_experience != null ? String(p.years_experience) : '');
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const updated = await craftspeopleApi.updateStory(editTarget.id, {
        bio: editBio,
        years_experience: editYears ? parseInt(editYears) : undefined,
      });
      setCraftspeople(prev => prev.map(p => p.id === updated.id ? { ...p, bio: updated.bio, years_experience: updated.years_experience } : p));
      setEditTarget(null);
      showToast('success', 'Saved', editTarget.name);
    } catch (e) {
      showToast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  // CMS placeholder sections
  if (CMS_SECTIONS.includes(validSection)) {
    const info = CMS_INFO[validSection];
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>{info.title}</h1>
        </div>
        <div className={styles.cmsPlaceholder}>
          <Info size={28} className={styles.cmsIcon} />
          <h3 className={styles.cmsTitle}>CMS Integration Pending</h3>
          <p className={styles.cmsDesc}>{info.description}</p>
        </div>
      </div>
    );
  }

  // Craftspeople section
  const filtered = craftspeople.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Craftspeople</h1>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search craftspeople…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.clearBtn} onClick={() => setSearch('')}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Name</th><th>Role</th><th>Bio</th><th>Experience</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
              ))
            ) : craftError ? (
              <tr><td colSpan={5} className={styles.empty}>
                <div style={{ color: 'var(--color-error)' }}>{craftError}</div>
                <button className={styles.actionBtn} style={{ marginTop: 8 }} onClick={() => { setCraftError(''); setLoading(true); craftspeopleApi.list().then(setCraftspeople).catch(e => setCraftError(e instanceof Error ? e.message : 'Failed')).finally(() => setLoading(false)); }}>Retry</button>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>
                {craftspeople.length === 0 ? 'No craftspeople records found. Add records via the database.' : 'No matches.'}
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className={styles.row}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.public_photo_url && (
                      <img src={p.public_photo_url} alt={p.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    )}
                    <span className={styles.primaryCell}>{p.name}</span>
                  </div>
                </td>
                <td>{p.role}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.bio || '—'}</td>
                <td>{p.years_experience != null ? `${p.years_experience} yrs` : '—'}</td>
                <td>
                  <button className={styles.actionBtn} onClick={() => openEdit(p)}>
                    <Edit2 size={13}/> Edit Story
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div className={styles.modalOverlay} onClick={() => setEditTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Edit — {editTarget.name}</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Bio</label>
                <textarea
                  className={styles.fieldInput}
                  style={{ minHeight: 120, resize: 'vertical' }}
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Craftsperson's story and background…"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Years of Experience</label>
                <input
                  type="number"
                  className={styles.fieldInput}
                  value={editYears}
                  onChange={e => setEditYears(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setEditTarget(null)}>Cancel</button>
              <button className={styles.createBtn} disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
