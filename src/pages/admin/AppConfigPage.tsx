import React from 'react';
import { useNavigate } from 'react-router-dom';
import { configApi } from '../../api/adminApi';
import type { ConfigGroup } from '../../api/adminApi';
import styles from './AppConfigPage.module.css';

type ConfigItem = ConfigGroup['items'][number];

export const AppConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = React.useState<ConfigGroup[]>([]);
  const [values, setValues] = React.useState<Record<string, ConfigItem['value']>>({});
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setLoadError('');
    configApi.get().then(loaded => {
      setGroups(loaded);
      const init: Record<string, ConfigItem['value']> = {};
      loaded.forEach(g => g.items.forEach(item => { init[item.key] = item.value; }));
      setValues(init);
    }).catch(err => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load configuration');
    }).finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: ConfigItem['value']) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setDirty(prev => new Set(prev).add(key));
  };

  const handleSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    const updated = groups.map(g => ({
      ...g,
      items: g.items.map(item => ({ ...item, value: values[item.key] ?? item.value })),
    }));
    try {
      await configApi.save(updated);
      setGroups(updated);
      setSaved(true);
      setDirty(new Set());
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silently fail — localStorage fallback already happened */ }
    finally { setSaving(false); }
  };

  const formatUnit = (item: ConfigItem) => {
    if (item.type === 'currency') return '₹';
    if (item.type === 'percentage') return '%';
    if (item.type === 'days') return 'days';
    if (item.type === 'hours') return 'hours';
    return '';
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>App Configuration</h1>
      <div className={styles.warningBanner}>
        Changes are applied immediately. All edits are logged in the audit trail.
      </div>

      {saved && <div className={styles.successBanner}>Configuration updated ✓</div>}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-error, #dc3545)', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 16 }}>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>Failed to load configuration</p>
          <p style={{ fontSize: '0.875rem', marginBottom: 16, color: 'var(--ink-2)' }}>{loadError}</p>
          <button onClick={() => { setLoadError(''); setLoading(true); configApi.get().then(loaded => { setGroups(loaded); const init: Record<string, ConfigItem['value']> = {}; loaded.forEach(g => g.items.forEach(item => { init[item.key] = item.value; })); setValues(init); }).catch(err => setLoadError(err instanceof Error ? err.message : 'Failed')).finally(() => setLoading(false)); }}
            style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-card)', fontFamily: 'inherit', fontSize: '0.875rem' }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && groups.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-3)', fontSize: '0.875rem' }}>
          No configuration groups found. The backend may not have config data seeded yet.
        </div>
      )}

      {groups.map(group => (
        <div key={group.title} className={styles.card}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <div className={styles.configList}>
            {group.items.map(item => {
              const isDirty = dirty.has(item.key);
              const val = values[item.key];

              return (
                <div key={item.key} className={`${styles.configRow} ${isDirty ? styles.configRowDirty : ''}`}>
                  <div className={styles.configLabel}>
                    {item.label}
                    {isDirty && <span className={styles.unsavedBadge}>unsaved</span>}
                  </div>
                  <div className={styles.configControl}>
                    {item.type === 'boolean' ? (
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={val as boolean}
                          onChange={e => handleChange(item.key, e.target.checked)}
                          className={styles.toggleInput}
                        />
                        <span className={styles.toggleSlider} />
                        <span className={styles.toggleLabel}>{val ? 'ON' : 'OFF'}</span>
                      </label>
                    ) : (
                      <div className={styles.numberInput}>
                        {item.type === 'currency' && <span className={styles.unit}>₹</span>}
                        <input
                          type="number"
                          className={styles.numInput}
                          value={val as number}
                          onChange={e => handleChange(item.key, Number(e.target.value))}
                        />
                        {item.type !== 'currency' && <span className={styles.unit}>{formatUnit(item)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {dirty.size > 0 && (
        <div className={styles.saveBar}>
          <span className={styles.dirtyCount}>{dirty.size} change{dirty.size > 1 ? 's' : ''} pending</span>
          <button className={styles.cancelChangesBtn} onClick={() => {
            const reset: Record<string, ConfigItem['value']> = {};
            groups.forEach(g => g.items.forEach(item => { reset[item.key] = item.value; }));
            setValues(reset);
            setDirty(new Set());
          }}>
            Discard
          </button>
          <button className={styles.saveBtn} onClick={() => setShowConfirm(true)}>
            Save Changes ({dirty.size})
          </button>
        </div>
      )}

      <div className={styles.auditLink}>
        <button className={styles.linkBtn} onClick={() => navigate('/admin/system/audit')}>
          View config change history →
        </button>
      </div>

      {showConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Confirm Config Update</h3>
            <p className={styles.modalText}>
              You are updating {dirty.size} config value{dirty.size > 1 ? 's' : ''}. These changes are immediate and logged with your admin account.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className={styles.confirmBtn} disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
