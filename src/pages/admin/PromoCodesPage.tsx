import React from 'react';
import { Plus, ToggleLeft, ToggleRight, BarChart2, Copy, Check, Pencil, Trash2 } from 'lucide-react';
import { promosApi } from '../../api/adminApi';
import type { PromoCode } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './PromoCodesPage.module.css';

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
        <label className={styles.fieldLabel}>Value *</label>
        <input className={styles.fieldInput} placeholder={type === 'percent' ? 'e.g., 10' : 'e.g., 200'}
          value={value} onChange={e => setValue(e.target.value)} type="number" min="0" />
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
        <label className={styles.fieldLabel}>Expiry Date</label>
        <input type="date" className={styles.fieldInput}
          value={expiry} onChange={e => setExpiry(e.target.value)} />
      </div>
      <div className={styles.modalActions}>
        <button className={styles.cancelModalBtn} onClick={onCancel}>Cancel</button>
        <button className={styles.saveModalBtn} disabled={saving}
          onClick={() => onSave({ code: code.trim().toUpperCase(), discount_type: type, discount_value: parseFloat(value), min_order_amount: minOrder ? parseFloat(minOrder) : 0, max_uses: maxUses ? parseInt(maxUses) : undefined, valid_until: expiry ? new Date(expiry).toISOString() : undefined })}>
          {saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}

export const PromoCodesPage: React.FC = () => {
  const [promos, setPromos] = React.useState<PromoCode[]>([]);
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
    promosApi.list().then(r => setPromos(r.promos)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (data: Partial<PromoCode>) => {
    if (!data.code?.trim() || data.discount_value == null) { showToast('error', 'Code and value are required'); return; }
    setSavingPromo(true);
    try {
      const created = await promosApi.create(data);
      setPromos(prev => [created, ...prev]);
      setShowCreateModal(false);
      showToast('success', 'Promo created', created.code);
    } catch (e) {
      showToast('error', 'Failed to create promo', e instanceof Error ? e.message : undefined);
    } finally { setSavingPromo(false); }
  };

  const handleEdit = async (data: Partial<PromoCode>) => {
    if (!editingPromo) return;
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

  const handleDelete = async (promo: PromoCode) => {
    if (!confirm(`Delete promo code "${promo.code}"? This cannot be undone.`)) return;
    setDeletingId(promo.id);
    try {
      await promosApi.delete(promo.id);
      setPromos(prev => prev.filter(p => p.id !== promo.id));
      showToast('success', 'Promo deleted');
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
        <button className={styles.addBtn} onClick={() => setShowCreateModal(true)}><Plus size={15}/> Create Promo Code</button>
      </div>

      {loading ? (
        <div className={styles.card} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading…</div>
      ) : promos.length === 0 ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <BarChart2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No promo codes yet. Create your first one above.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Max Uses</th><th>Expiry</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {promos.map(p => {
                const expired = isExpired(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{p.code}</strong>
                    </td>
                    <td>{p.discount_type === 'percent' ? 'Percentage' : 'Flat (₹)'}</td>
                    <td>{p.discount_type === 'percent' ? `${p.discount_value}%` : `₹${p.discount_value}`}</td>
                    <td>{p.min_order_amount > 0 ? `₹${p.min_order_amount}` : '—'}</td>
                    <td>{p.max_uses ?? '∞'}</td>
                    <td>
                      {p.valid_until ? (
                        <span style={{ color: expired ? 'var(--color-error, #ef4444)' : 'inherit' }}>
                          {new Date(p.valid_until).toLocaleDateString('en-IN')}
                          {expired && <span style={{ marginLeft: 6, fontSize: 11, background: '#ef444422', color: '#ef4444', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Expired</span>}
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
                          {copiedId === p.id ? <Check size={14}/> : <Copy size={14}/>}
                        </button>
                        <button className={styles.exportBtn} onClick={() => setEditingPromo(p)} title="Edit"><Pencil size={14}/></button>
                        <button className={styles.exportBtn} disabled={togglingId === p.id} onClick={() => handleToggle(p)} title={p.is_active ? 'Deactivate' : 'Activate'}>
                          {p.is_active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                        </button>
                        <button className={styles.exportBtn} disabled={deletingId === p.id} onClick={() => handleDelete(p)} title="Delete" style={{ color: 'var(--color-error, #ef4444)' }}>
                          <Trash2 size={14}/>
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
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create Promo Code</h3>
            <PromoForm initial={{}} onSave={handleCreate} onCancel={() => setShowCreateModal(false)} saving={savingPromo} />
          </div>
        </div>
      )}

      {editingPromo && (
        <div className={styles.modalOverlay} onClick={() => setEditingPromo(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Edit: <span style={{ fontFamily: 'monospace' }}>{editingPromo.code}</span></h3>
            <PromoForm initial={editingPromo} onSave={handleEdit} onCancel={() => setEditingPromo(null)} saving={savingPromo} />
          </div>
        </div>
      )}
    </div>
  );
};
