import React from 'react';
import { promosApi } from '../../api/adminApi';
import type { PromoCode } from '../../api/adminApi';
import { istDayEnd } from '../../utils/dateWindow';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useDialog } from '../../components/Modal/useDialog'; // [DSA-45-2]
import styles from './PromoCodesPage.module.css';
import { UilChartBar, UilCheck, UilCopy, UilPen, UilPlus, UilToggleOff, UilToggleOn, UilTrashAlt } from "@iconscout/react-unicons";

function isExpired(p: PromoCode) {
  return !!p.valid_until && new Date(p.valid_until) < new Date();
}

function PromoForm({
  initial, onSave, onCancel, saving,
}: {
  initial: Partial<PromoCode>;
  onSave: (data: Partial<PromoCode>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [code, setCode] = React.useState(initial.code ?? '');
  const [type, setType] = React.useState<'percent' | 'flat'>((initial.discount_type as 'percent' | 'flat') ?? 'percent');
  const [value, setValue] = React.useState(initial.discount_value != null ? String(initial.discount_value) : '');
  const [minOrder, setMinOrder] = React.useState(initial.min_order_amount != null && initial.min_order_amount > 0 ? String(initial.min_order_amount) : '');
  const [maxUses, setMaxUses] = React.useState(initial.max_uses != null ? String(initial.max_uses) : '');
  const [expiry, setExpiry] = React.useState(initial.valid_until ? initial.valid_until.slice(0, 10) : '');
  // Tomorrow, computed once (lazy init keeps render pure — no Date.now() in render body).
  const [minDate] = React.useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));

  return (
    <div className={styles.fields}>
      {!initial.id && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Code *</label>
          <input className={styles.fieldInput} placeholder="e.g., SAVE10"
            value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
        </div>
      )}
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Type</label>
        <select className={styles.fieldSelect} value={type} onChange={e => setType(e.target.value as 'percent' | 'flat')}>
          <option value="percent">Percentage (%)</option>
          <option value="flat">Flat (₹)</option>
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Value * {type === 'percent' ? '(0–100%)' : '(₹, max 100000)'}</label>
        <input className={styles.fieldInput} placeholder={type === 'percent' ? 'e.g., 10' : 'e.g., 200'}
          value={value} onChange={e => setValue(e.target.value)} type="number" min="0"
          max={type === 'percent' ? 100 : 100000} />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Min Order Amount (₹)</label>
        <input className={styles.fieldInput} placeholder="e.g., 500 (optional)"
          value={minOrder} onChange={e => setMinOrder(e.target.value)} type="number" min="0" />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Max Uses (total)</label>
        <input className={styles.fieldInput} placeholder="Leave blank for unlimited"
          value={maxUses} onChange={e => setMaxUses(e.target.value)} type="number" min="1" />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Expiry Date *</label>
        <input type="date" className={styles.fieldInput} required
          min={minDate}
          value={expiry} onChange={e => setExpiry(e.target.value)} />
        {!expiry && <span style={{ fontSize: 12, color: 'var(--color-danger, #D75B5B)' }}>An expiry date is required.</span>}
      </div>
      <div className={styles.modalActions}>
        <button className={styles.cancelModalBtn} onClick={onCancel}>Cancel</button>
        <button className={styles.saveModalBtn}
          disabled={saving || !code.trim() || !value || !expiry}
          onClick={() => onSave({ code: code.trim().toUpperCase(), discount_type: type, discount_value: parseFloat(value), min_order_amount: minOrder ? parseFloat(minOrder) : 0, max_uses: maxUses ? parseInt(maxUses) : undefined, valid_until: istDayEnd(expiry) })}>
          {saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}

export const PromoCodesPage: React.FC = () => {
  const [promos, setPromos] = React.useState<PromoCode[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [editingPromo, setEditingPromo] = React.useState<PromoCode | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [savingPromo, setSavingPromo] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    promosApi
      .list()
      .then((r) => { setPromos(r.promos); setLoadError(null); })
      // Not swallowed: an empty table and a failed request are different facts, and this
      // rendered them identically — "no promo codes" for "we could not ask".
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load promo codes.'))
      .finally(() => setLoading(false));
  }, []);

  // T1-25: guard the value bounds client-side (backend zod enforces the same — percent ≤ 100,
  // flat ≤ 100000) so a fat-finger is caught before the server rejects it.
  const promoBoundError = (data: Partial<PromoCode>): string | null => {
    const v = data.discount_value;
    if (v == null) return null; // not being set in this (partial) edit
    if (v <= 0) return 'Discount value must be positive';
    if (data.discount_type === 'percent' && v > 100) return "A percentage discount can't exceed 100%";
    if (data.discount_type === 'flat' && v > 100000) return 'Flat discount is too large (max ₹100000)';
    return null;
  };

  const handleCreate = async (data: Partial<PromoCode>) => {
    if (!data.code?.trim() || data.discount_value == null) { showToast('error', 'Code and value are required'); return; }
    const boundErr = promoBoundError(data);
    if (boundErr) { showToast('error', boundErr); return; }
    setSavingPromo(true);
    try {
      const created = await promosApi.create(data as Parameters<typeof promosApi.create>[0]);
      setPromos(prev => [created, ...prev]);
      setShowCreateModal(false);
      showToast('success', 'Promo created', created.code);
    } catch (e) {
      showToast('error', 'Failed to create promo', e instanceof Error ? e.message : undefined);
    } finally { setSavingPromo(false); }
  };

  const handleEdit = async (data: Partial<PromoCode>) => {
    if (!editingPromo) return;
    const boundErr = promoBoundError(data);
    if (boundErr) { showToast('error', boundErr); return; }
    setSavingPromo(true);
    try {
      const updated = await promosApi.update(editingPromo.id, data);
      setPromos(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingPromo(null);
      showToast('success', 'Promo updated');
    } catch (e) {
      showToast('error', 'Failed to update promo', e instanceof Error ? e.message : undefined);
    } finally { setSavingPromo(false); }
  };

  const handleToggle = async (promo: PromoCode) => {
    setTogglingId(promo.id);
    try {
      const updated = await promosApi.toggle(promo.id, !promo.is_active);
      setPromos(prev => prev.map(p => p.id === updated.id ? { ...p, is_active: updated.is_active } : p));
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setTogglingId(null); }
  };

  const [confirmDelete, setConfirmDelete] = React.useState<PromoCode | null>(null);

  // [DSA-45-2] Hand-rolled overlays get <Modal>'s behaviour without its markup: focus moves
  // in, Tab is trapped, Escape closes, focus returns to whatever opened it, and a screen
  // reader is told this is a dialog. Declared here, ABOVE the early returns — a hook placed
  // after one stops being called the moment the page is loading.
  const createPromoDialog = useDialog(
    showCreateModal,
    () => setShowCreateModal(false),
    'Create promo code',
  );
  const editPromoDialog = useDialog(
    !!(editingPromo),
    () => setEditingPromo(null),
    'Edit promo code',
  );

  const handleDelete = async () => {
    const promo = confirmDelete;
    if (!promo) return;
    setDeletingId(promo.id);
    try {
      await promosApi.delete(promo.id);
      setPromos(prev => prev.filter(p => p.id !== promo.id));
      showToast('success', 'Promo deleted');
      setConfirmDelete(null);
    } catch (e) {
      showToast('error', 'Failed to delete', e instanceof Error ? e.message : undefined);
    } finally { setDeletingId(null); }
  };

  const handleCopy = (promo: PromoCode) => {
    navigator.clipboard.writeText(promo.code).then(() => {
      setCopiedId(promo.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Promo Codes</h1>
        <button className={styles.addBtn} onClick={() => setShowCreateModal(true)}><UilPlus size={15}/> Create Promo Code</button>
      </div>

      {/* [KA6-4] Four rows today, but every row is identified by an opaque string, and at
          fifty codes there is no way to find one. Only rendered once there is enough to
          search — a filter over four rows is furniture. */}
      {!loading && !loadError && promos.length > 8 && (
        <input
          className={styles.searchInput}
          placeholder="Search codes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search promo codes"
        />
      )}

      {loading ? (
        <div className={styles.card} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading…</div>
      ) : loadError ? (
        /* An empty table and a failed request are different facts. */
        <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{loadError}</p>
        </div>
      ) : promos.length === 0 ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <UilChartBar size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No promo codes yet. Create your first one above.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Uses</th><th>Spend</th><th>Expiry</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {promos
                .filter((p) => !query.trim() || p.code.toLowerCase().includes(query.trim().toLowerCase()))
                .map(p => {
                const expired = isExpired(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{p.code}</strong>
                    </td>
                    <td>{p.discount_type === 'percent' ? 'Percentage' : 'Flat (₹)'}</td>
                    {/* [KA6-5] `10.00%` — two decimals on a percentage that is always whole,
                        beside ₹200.00 where two decimals are right. One policy per unit type:
                        a percentage drops trailing zeros, money keeps them. */}
                    <td>{p.discount_type === 'percent'
                      ? `${Number(p.discount_value)}%`
                      : `₹${Number(p.discount_value).toLocaleString('en-IN')}`}</td>
                    <td>{p.min_order_amount > 0 ? `₹${p.min_order_amount}` : '—'}</td>
                    {/* [PM-26-4] The cap is enforced against `uses`; this cell rendered
                        `usage_count`, which is net of cancelled and refunded orders. Both
                        are true and they answer different questions — on the seeded data
                        AUDLASTONE showed "0 / 100" while the enforced value was 99, so the
                        console promised a hundred redemptions and the next one would have
                        been refused as "usage limit reached". The cap now shows the number
                        that governs it; net redemptions stay, labelled, because that is the
                        finance figure. A divergence is itself worth seeing: in production
                        the two move together atomically, so a gap means something didn't. */}
                    <td>
                      {(p.enforced_uses ?? 0).toLocaleString('en-IN')} / {p.max_uses ?? '∞'}
                      {p.enforced_uses !== p.usage_count && (
                        <div className={styles.avgSpend} title="Redemptions counted for finance, net of cancelled and refunded orders. The cap above is enforced separately; these should normally match.">
                          {(p.usage_count ?? 0).toLocaleString('en-IN')} net of reversals
                        </div>
                      )}
                    </td>
                    <td>
                      {(p.usage_count ?? 0) > 0 ? (
                        <>
                          ₹{Math.round(p.total_spend ?? 0).toLocaleString('en-IN')}
                          <div className={styles.avgSpend}>
                            avg ₹{Math.round((p.total_spend ?? 0) / (p.usage_count ?? 1)).toLocaleString('en-IN')}
                          </div>
                        </>
                      ) : (
                        /* [KA6-1] A permanently blank money column is worse than no column:
                           it implies the number exists and is zero. It is neither — nobody
                           has redeemed this code, so there is no spend to report yet. */
                        <span className={styles.avgSpend}>not redeemed yet</span>
                      )}
                    </td>
                    <td>
                      {p.valid_until ? (
                        /* [KA6-2] An already-expired code carried three redundant signals
                           (red date + red pill + the Status column) while the ACTIVE codes —
                           the ones a decision turns on — showed a bare date with no sense of
                           how long is left. The dead case is stated once; the live case gets
                           the fact that matters. */
                        <span className={expired ? styles.expiredDate : undefined}>
                          {new Date(p.valid_until).toLocaleDateString('en-IN')}
                          {!expired && (() => {
                            const days = Math.ceil(
                              (new Date(p.valid_until).getTime() - Date.now()) / 86400000,
                            );
                            return (
                              <div className={days <= 7 ? styles.expirySoon : styles.avgSpend}>
                                {days <= 0 ? 'expires today' : days === 1 ? 'expires tomorrow' : `expires in ${days} days`}
                              </div>
                            );
                          })()}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={p.is_active && !expired ? styles.onTrack : styles.behind}>
                        {expired ? 'Expired' : p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className={styles.exportBtn} onClick={() => handleCopy(p)} title="Copy code">
                          {copiedId === p.id ? <UilCheck size={14}/> : <UilCopy size={14}/>}
                        </button>
                        <button className={styles.exportBtn} onClick={() => setEditingPromo(p)} title="Edit"><UilPen size={14}/></button>
                        <button className={styles.exportBtn} disabled={togglingId === p.id} onClick={() => handleToggle(p)} title={p.is_active ? 'Deactivate' : 'Activate'}>
                          {p.is_active ? <UilToggleOn size={14}/> : <UilToggleOff size={14}/>}
                        </button>
                        <button className={styles.exportBtn} disabled={deletingId === p.id} onClick={() => setConfirmDelete(p)} title="Delete" style={{ color: 'var(--color-error, #D75B5B)' }}>
                          <UilTrashAlt size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modal} {...createPromoDialog.dialogProps} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create Promo Code</h3>
            <PromoForm initial={{}} onSave={handleCreate} onCancel={() => setShowCreateModal(false)} saving={savingPromo} />
          </div>
        </div>
      )}

      {editingPromo && (
        <div className={styles.modalOverlay} onClick={() => setEditingPromo(null)}>
          <div className={styles.modal} {...editPromoDialog.dialogProps} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Edit: <span style={{ fontFamily: 'monospace' }}>{editingPromo.code}</span></h3>
            <PromoForm initial={editingPromo} onSave={handleEdit} onCancel={() => setEditingPromo(null)} saving={savingPromo} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete promo "${confirmDelete?.code ?? ''}"?`}
        message="This permanently removes the promo code. Customers can no longer use it. This cannot be undone."
        confirmLabel="Delete promo"
        loading={!!confirmDelete && deletingId === confirmDelete.id}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
