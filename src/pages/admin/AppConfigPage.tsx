import React from 'react';
import { useNavigate } from 'react-router-dom';
import { configApi } from '../../api/adminApi';
import type { ConfigGroup } from '../../api/adminApi';
import { useDialog } from '../../components/Modal/useDialog'; // [DSA-45-2]
import styles from './AppConfigPage.module.css';
import { Alert } from '../../components/Alert/Alert';

type ConfigItem = ConfigGroup['items'][number];

export const AppConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = React.useState<ConfigGroup[]>([]);
  const [values, setValues] = React.useState<Record<string, ConfigItem['value']>>({});
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = React.useState(false);
  // T2-25: per-dangerous-flag typed confirmation (must type the exact flag key).
  const [typedConfirm, setTypedConfirm] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  // [DSA-45-2] Hand-rolled overlays get <Modal>'s behaviour without its markup: focus moves
  // in, Tab is trapped, Escape closes, focus returns to whatever opened it, and a screen
  // reader is told this is a dialog. Declared here, ABOVE the early returns — a hook placed
  // after one stops being called the moment the page is loading.
  const confirmDialog = useDialog(showConfirm, () => setShowConfirm(false), 'Confirm config update');

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
    setSaveError('');
    const updated = groups.map(g => ({
      ...g,
      items: g.items.map(item => ({ ...item, value: values[item.key] ?? item.value })),
    }));
    // [SHL-7-6] Send ONLY the keys this operator actually changed.
    //
    // This PUT the entire page-load snapshot — all 23 keys — so two supers with the page open at
    // once each wrote 23 values, and the later save silently restored the earlier one's untouched
    // keys. Proven live: A turns cod_enabled off, B saves an unrelated field, cod_enabled is back
    // on and nobody is told. A save that writes what you did not touch is not a save, it is a
    // revert with extra steps.
    const changedOnly = updated
      .map(g => ({ ...g, items: g.items.filter(item => dirty.has(item.key)) }))
      .filter(g => g.items.length > 0);
    try {
      await configApi.save(changedOnly);
      setGroups(updated);
      setSaved(true);
      setDirty(new Set());
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      // G-42: never fail silently — the edits stay marked dirty so they can be retried.
      setSaveError(err instanceof Error ? err.message : 'Save failed — the server rejected the update.');
    }
    finally { setSaving(false); }
  };

  const formatUnit = (item: ConfigItem) => {
    if (item.type === 'currency') return '₹';
    if (item.type === 'percentage') return '%';
    if (item.type === 'days') return 'days';
    if (item.type === 'hours') return 'hours';
    return '';
  };

  // T2-25: a dirty numeric value outside the registry bounds blocks the save.
  const outOfBounds = (item: ConfigItem): boolean => {
    if (item.type === 'boolean') return false;
    // T3-9 (§2.4): an empty/blank numeric field is invalid — block the save (it used to
    // coerce to 0 and save silently).
    const raw = values[item.key];
    if (raw === '' || raw == null) return true;
    const v = Number(raw);
    if (Number.isNaN(v)) return true;
    if (item.min != null && v < item.min) return true;
    if (item.max != null && v > item.max) return true;
    return false;
  };
  const allItems = groups.flatMap(g => g.items);
  const dirtyItems = allItems.filter(i => dirty.has(i.key));
  const boundsErrors = dirtyItems.filter(outOfBounds);
  const dangerousDirty = dirtyItems.filter(i => i.dangerous);
  // Every dangerous change must be confirmed by typing its exact key.
  const confirmReady = dangerousDirty.every(i => (typedConfirm[i.key] ?? '').trim() === i.key);

  const openConfirm = () => {
    if (boundsErrors.length > 0) {
      setSaveError(`Out of range: ${boundsErrors.map(b => b.key).join(', ')}. Fix before saving.`);
      return;
    }
    setSaveError('');
    setTypedConfirm({});
    setShowConfirm(true);
  };

  const fmtWhen = (iso?: string | null) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>App Configuration</h1>
      {/* [KA2-13] This sentence is INFORMATION, and it was painted in the system's error
          colour — `.warningBanner` is rgba(215,91,91,…) on a #A8434A foreground, the same
          red the real failure below uses. On a settings page red reads as "something is
          wrong", and nothing is: it is telling you the save is immediate and audited.
          Using the design system's info tone instead of a bespoke banner also means the two
          messages no longer look identical — the one underneath, "Not saved: …", genuinely
          is an error and keeps the red. */}
      <Alert
        type="info"
        title="Changes are applied immediately"
        message="All edits are logged in the audit trail."
      />

      {saved && <div className={styles.successBanner}>Configuration updated ✓</div>}
      {saveError && (
        <div className={styles.warningBanner} role="alert">
          Not saved: {saveError} — your changes are still pending below.
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 8, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-error)', background: 'var(--color-bg-primary)', borderRadius: 8, border: '1px solid var(--color-border-light)', marginTop: 16 }}>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>Failed to load configuration</p>
          <p style={{ fontSize: '0.875rem', marginBottom: 16, color: 'var(--color-text-secondary)' }}>{loadError}</p>
          <button onClick={() => { setLoadError(''); setLoading(true); configApi.get().then(loaded => { setGroups(loaded); const init: Record<string, ConfigItem['value']> = {}; loaded.forEach(g => g.items.forEach(item => { init[item.key] = item.value; })); setValues(init); }).catch(err => setLoadError(err instanceof Error ? err.message : 'Failed')).finally(() => setLoading(false)); }}
            style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer', background: 'var(--color-bg-primary)', fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && groups.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
          No configuration groups found. Run migration 036_seed_app_config.sql to populate defaults.
        </div>
      )}

      {groups.map(group => (
        <div key={group.title} className={styles.card}>
          {/* [KA2-18] The client synthesises ONE container group titled "App Configuration"
              (adminApi.ts), so this printed the page's own H1 again ~150px below it. A lone
              container group has no name worth stating; a real second group would. */}
          {groups.length > 1 && <h2 className={styles.groupTitle}>{group.title}</h2>}
          <div className={styles.configList}>
            {group.items.map(item => {
              const isDirty = dirty.has(item.key);
              const val = values[item.key];

              const oob = isDirty && outOfBounds(item);
              const lastChanged = fmtWhen(item.updatedAt);
              return (
                <div key={item.key} className={`${styles.configRow} ${isDirty ? styles.configRowDirty : ''}`}>
                  <div className={styles.configLabel}>
                    <span>
                      {item.label}
                      {item.dangerous && <span className={styles.dangerBadge}>dangerous</span>}
                      {/* [SHL-7-9] This page lists every app_config row, so a setting
                          nothing reads looks exactly like one that governs the storefront.
                          An operator would reasonably conclude it is the rule — and
                          `cancellation_allowed_until` in particular READS as the
                          cancellation rule while the real one is keyed to the cut event.
                          Say it where they are about to type. */}
                      {item.enforced === false && (
                        <span
                          className={styles.inertBadge}
                          title="Nothing in the system reads this setting yet. You can change it, and it will save, but it will not change any behaviour."
                        >
                          not enforced
                        </span>
                      )}
                      {isDirty && <span className={styles.unsavedBadge}>unsaved</span>}
                    </span>
                    {item.description && <span className={styles.configDesc}>{item.description}</span>}
                    <span className={styles.configMeta}>
                      <code className={styles.configKey}>{item.key}</code>
                      {(item.min != null || item.max != null) && (
                        <span> · range {item.min ?? '–'}…{item.max ?? '–'}</span>
                      )}
                      {lastChanged && <span> · last changed {lastChanged}{item.updatedByEmail ? ` by ${item.updatedByEmail}` : ''}</span>}
                    </span>
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
                    ) : item.type === 'string' ? (
                      /* [SHL-7-16] A text value in a TEXT box. These rendered as empty number
                         inputs — the company GSTIN, the GST state, the cancellation cutoff — so
                         the page showed a blank where a legally-required value lives, and any
                         edit coerced it through Number(). */
                      <input
                        type="text"
                        className={styles.textInput}
                        value={(val as string) ?? ''}
                        onChange={e => handleChange(item.key, e.target.value)}
                      />
                    ) : (
                      <div className={styles.numberInput}>
                        {item.type === 'currency' && <span className={styles.unit}>₹</span>}
                        <input
                          type="number"
                          className={`${styles.numInput} ${oob ? styles.numInputError : ''}`}
                          // T3-9 (§2.4): keep an empty field EMPTY rather than silently
                          // coercing Number('') → 0 (which saved a real 0). Empty is treated
                          // as invalid below and blocks the save.
                          value={val === '' || val == null ? '' : (val as number)}
                          min={item.min ?? undefined}
                          max={item.max ?? undefined}
                          onChange={e => handleChange(item.key, e.target.value === '' ? '' : Number(e.target.value))}
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
          <button className={styles.saveBtn} onClick={openConfirm}>
            Save Changes ({dirty.size})
          </button>
        </div>
      )}

      <div className={styles.auditLink}>
        <button className={styles.linkBtn} onClick={() => navigate('/admin/system/audit-log')}>
          View config change history →
        </button>
      </div>

      {showConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.modal} {...confirmDialog.dialogProps} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Confirm Config Update</h3>
            <p className={styles.modalText}>
              You are updating {dirty.size} config value{dirty.size > 1 ? 's' : ''}. These changes are immediate and logged with your admin account.
            </p>
            {dangerousDirty.length > 0 && (
              <div className={styles.dangerConfirm}>
                <p className={styles.dangerConfirmTitle}>⚠ Dangerous change — type each flag's key to confirm:</p>
                {dangerousDirty.map(item => (
                  <div key={item.key} className={styles.dangerConfirmRow}>
                    <label className={styles.dangerConfirmLabel}>Type <code>{item.key}</code></label>
                    <input
                      className={styles.dangerConfirmInput}
                      value={typedConfirm[item.key] ?? ''}
                      onChange={e => setTypedConfirm(prev => ({ ...prev, [item.key]: e.target.value }))}
                      placeholder={item.key}
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className={styles.confirmBtn} disabled={saving || !confirmReady} onClick={handleSave}>{saving ? 'Saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
