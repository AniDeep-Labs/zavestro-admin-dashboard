import React from 'react';
import { Link } from 'react-router-dom';
import { serviceAreasApi, hubsApi } from '../../api/adminApi';
import type { ServicePincode, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import styles from './PromoCodesPage.module.css';
import { UilPlus, UilSearch, UilToggleOff, UilToggleOn, UilTrashAlt } from "@iconscout/react-unicons";

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>{message}</p>
    </div>
  );
}

export const ServiceAreasPage: React.FC = () => {
  const [pincodes, setPincodes] = React.useState<ServicePincode[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);

  const [showModal, setShowModal] = React.useState(false);
  const [bulkInput, setBulkInput] = React.useState('');
  const [formAreaName, setFormAreaName] = React.useState('');
  const [formCity, setFormCity] = React.useState('Bangalore');
  const [formHubId, setFormHubId] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  const LIMIT = 50;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await serviceAreasApi.list({ search: search || undefined, page, limit: LIMIT });
      setPincodes(r.pincodes);
      setTotal(r.total);
    } catch (e) {
      showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined);
    } finally { setLoading(false); }
  }, [search, page]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    hubsApi.list().then(r => setHubs(r.hubs)).catch(() => {});
  }, []);

  const handleAdd = async () => {
    // T3-9 (§2.4): Indian pincodes are exactly 6 digits (was /^\d{4,6}$/, which let typos in).
    const lines = bulkInput.split(/[\s,\n]+/).map(p => p.trim()).filter(p => /^\d{6}$/.test(p));
    if (lines.length === 0) { showToast('error', 'Enter at least one valid 6-digit pincode'); return; }
    setSaving(true);
    try {
      const payload = lines.map(pincode => ({
        pincode,
        area_name: formAreaName.trim() || '',
        city: formCity.trim() || 'Bangalore',
        hub_id: formHubId || null,
        is_active: true,
      }));
      const { pincodes: added } = await serviceAreasApi.upsert(payload);
      showToast('success', `${added.length} pincode${added.length !== 1 ? 's' : ''} saved`);
      setShowModal(false);
      setBulkInput(''); setFormAreaName(''); setFormCity('Bangalore'); setFormHubId('');
      load();
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  const handleToggle = async (p: ServicePincode) => {
    setTogglingId(p.id);
    try {
      const updated = await serviceAreasApi.update(p.id, { is_active: !p.is_active });
      setPincodes(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setTogglingId(null); }
  };

  // T3-9 (§2.4): design-system ConfirmDialog instead of the native confirm().
  const [pendingDelete, setPendingDelete] = React.useState<ServicePincode | null>(null);
  const doDelete = async () => {
    const p = pendingDelete;
    if (!p) return;
    setDeletingId(p.id);
    try {
      await serviceAreasApi.remove(p.id);
      setPincodes(prev => prev.filter(x => x.id !== p.id));
      setTotal(t => t - 1);
      showToast('success', `Pincode ${p.pincode} deleted`);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setDeletingId(null); setPendingDelete(null); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Service Areas</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
            {total} pincode{total !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div className={styles.headerActions}>
          {/* T2-26 (SU-8): unserviced demand lives on Pincode Demand — cross-link the two. */}
          <Link className={styles.crossLink} to="/admin/pincode-waitlist">View pincode demand →</Link>
          <button className={styles.addBtn} onClick={() => setShowModal(true)}><UilPlus size={15}/> Add Pincodes</button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', maxWidth: 360 }}>
        <UilSearch size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
        <input
          className={styles.fieldInput}
          style={{ paddingLeft: 32 }}
          placeholder="Search pincode or area…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className={styles.card} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Loading…</div>
      ) : pincodes.length === 0 ? (
        <EmptyState message="No service pincodes configured yet. Add pincodes to define serviceable areas." />
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Pincode</th>
                <th>Area Name</th>
                <th>City</th>
                <th>Hub</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pincodes.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.pincode}</strong></td>
                  <td>{p.area_name || <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}</td>
                  <td>{p.city}</td>
                  <td>{p.hub_name || <span style={{ color: 'var(--color-text-tertiary)' }}>Unassigned</span>}</td>
                  <td>
                    <span className={p.is_active ? styles.onTrack : styles.behind}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={styles.exportBtn}
                        disabled={togglingId === p.id}
                        onClick={() => handleToggle(p)}
                        title={p.is_active ? 'Deactivate' : 'Activate'}
                        style={{ padding: '0 10px', height: 32, fontSize: 12 }}
                      >
                        {p.is_active ? <UilToggleOn size={14}/> : <UilToggleOff size={14}/>}
                      </button>
                      <button
                        className={styles.exportBtn}
                        disabled={deletingId === p.id}
                        onClick={() => setPendingDelete(p)}
                        title="Delete"
                        style={{ padding: '0 10px', height: 32, fontSize: 12, color: 'var(--color-error)' }}
                      >
                        <UilTrashAlt size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className={styles.exportBtn} style={{ height: 32, padding: '0 14px', fontSize: 13 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ lineHeight: '32px', fontSize: 13, color: 'var(--color-text-secondary)' }}>Page {page} of {totalPages}</span>
              <button className={styles.exportBtn} style={{ height: 32, padding: '0 14px', fontSize: 13 }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 className={styles.modalTitle}>Add Pincodes</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Pincodes * (one per line, comma- or space-separated)</label>
                <textarea
                  className={styles.fieldInput}
                  style={{ height: 100, resize: 'vertical', padding: '8px 12px' }}
                  placeholder="560034&#10;560001, 560002&#10;560048"
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Area Name (optional, applies to all above)</label>
                <input className={styles.fieldInput} placeholder="e.g., Koramangala" value={formAreaName} onChange={e => setFormAreaName(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>City</label>
                <input className={styles.fieldInput} value={formCity} onChange={e => setFormCity(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Assign to Hub (optional)</label>
                <select className={styles.fieldSelect} value={formHubId} onChange={e => setFormHubId(e.target.value)}>
                  <option value="">— No hub —</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name} ({h.city})</option>)}
                </select>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.saveModalBtn} onClick={handleAdd} disabled={saving}>
                {saving ? 'Saving…' : 'Add Pincodes'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete pincode?"
        message={pendingDelete ? `Remove ${pendingDelete.pincode} from the service area? Customers there can no longer check out.` : ''}
        confirmLabel="Delete"
        variant="danger"
        loading={deletingId === pendingDelete?.id}
        onConfirm={doDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
