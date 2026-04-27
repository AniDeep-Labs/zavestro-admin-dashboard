import React from 'react';
import { useNavigate } from 'react-router-dom';
import { appConfig, type ConfigItem } from '../../data/adminMockData';
import styles from './AppConfigPage.module.css';

export const AppConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [values, setValues] = React.useState<Record<string, ConfigItem['value']>>(() => {
    const init: Record<string, ConfigItem['value']> = {};
    appConfig.forEach(group => group.items.forEach(item => { init[item.key] = item.value; }));
    return init;
  });
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleChange = (key: string, value: ConfigItem['value']) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setDirty(prev => new Set(prev).add(key));
  };

  const handleSave = () => {
    setShowConfirm(false);
    setSaved(true);
    setDirty(new Set());
    setTimeout(() => setSaved(false), 3000);
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

      {appConfig.map(group => (
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
            appConfig.forEach(group => group.items.forEach(item => { reset[item.key] = item.value; }));
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
              <button className={styles.confirmBtn} onClick={handleSave}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
