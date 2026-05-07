import React from 'react';
import { Plus, ToggleLeft, ToggleRight, BarChart2 } from 'lucide-react';
import { promosApi } from '../../api/adminApi';
import type { PromoCode } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './PromoCodesPage.module.css';

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
      <BarChart2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>{message}</p>
    </div>
  );
}

export const PromoCodesPage: React.FC = () => {
  const [promos, setPromos] = React.useState<PromoCode[]>([]);
  const [showPromoModal, setShowPromoModal] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Promo form state
  const [promoCode, setPromoCode] = React.useState('');
  const [promoType, setPromoType] = React.useState<'percent' | 'flat'>('percent');
  const [promoValue, setPromoValue] = React.useState('');
  const [promoExpiry, setPromoExpiry] = React.useState('');
  const [promoMaxUses, setPromoMaxUses] = React.useState('');
  const [promoMinOrder, setPromoMinOrder] = React.useState('');
  const [savingPromo, setSavingPromo] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    promosApi.list().then(r => setPromos(r.promos)).catch(() => {});
  }, []);

  const handleCreatePromo = async () => {
    if (!promoCode.trim() || !promoValue) { showToast('error', 'Code and value are required'); return; }
    setSavingPromo(true);
    try {
      const created = await promosApi.create({
        code: promoCode.trim().toUpperCase(),
        discount_type: promoType,
        discount_value: parseFloat(promoValue),
        min_order_amount: promoMinOrder ? parseFloat(promoMinOrder) : 0,
        max_uses: promoMaxUses ? parseInt(promoMaxUses) : undefined,
        valid_until: promoExpiry ? new Date(promoExpiry).toISOString() : undefined,
      });
      setPromos(prev => [created, ...prev]);
      setShowPromoModal(false);
      setPromoCode(''); setPromoType('percent'); setPromoValue(''); setPromoExpiry(''); setPromoMaxUses(''); setPromoMinOrder('');
      showToast('success', 'Promo created', created.code);
    } catch (e) {
      showToast('error', 'Failed to create promo', e instanceof Error ? e.message : undefined);
    } finally { setSavingPromo(false); }
  };

  const handleTogglePromo = async (promo: PromoCode) => {
    setTogglingId(promo.id);
    try {
      const updated = await promosApi.toggle(promo.id, !promo.is_active);
      setPromos(prev => prev.map(p => p.id === updated.id ? { ...p, is_active: updated.is_active } : p));
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setTogglingId(null); }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Promo Codes</h1>
        <button className={styles.addBtn} onClick={() => setShowPromoModal(true)}><Plus size={15}/> Create Promo Code</button>
      </div>

      {promos.length === 0 ? (
        <EmptyState message="No promo codes created yet. Use the button above to create your first promo code." />
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Uses</th><th>Expiry</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {promos.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.code}</strong></td>
                  <td>{p.discount_type === 'percent' ? 'Percentage' : 'Flat (₹)'}</td>
                  <td>{p.discount_type === 'percent' ? `${p.discount_value}%` : `₹${p.discount_value}`}</td>
                  <td>{p.min_order_amount > 0 ? `₹${p.min_order_amount}` : '—'}</td>
                  <td>{p.max_uses ?? '∞'}</td>
                  <td>{p.valid_until ? new Date(p.valid_until).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <span className={p.is_active ? styles.onTrack : styles.behind}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={styles.exportBtn}
                      disabled={togglingId === p.id}
                      onClick={() => handleTogglePromo(p)}
                      title={p.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {p.is_active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                      {p.is_active ? ' Deactivate' : ' Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Promo modal */}
      {showPromoModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPromoModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create Promo Code</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Code *</label>
                <input className={styles.fieldInput} placeholder="e.g., SAVE10"
                  value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Type</label>
                <select className={styles.fieldSelect} value={promoType} onChange={e => setPromoType(e.target.value as 'percent' | 'flat')}>
                  <option value="percent">Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Value *</label>
                <input className={styles.fieldInput} placeholder={promoType === 'percent' ? 'e.g., 10' : 'e.g., 200'}
                  value={promoValue} onChange={e => setPromoValue(e.target.value)} type="number" min="0" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Min Order Amount (₹)</label>
                <input className={styles.fieldInput} placeholder="e.g., 500 (optional)"
                  value={promoMinOrder} onChange={e => setPromoMinOrder(e.target.value)} type="number" min="0" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Max Uses (total)</label>
                <input className={styles.fieldInput} placeholder="Leave blank for unlimited"
                  value={promoMaxUses} onChange={e => setPromoMaxUses(e.target.value)} type="number" min="1" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Expiry Date</label>
                <input type="date" className={styles.fieldInput}
                  value={promoExpiry} onChange={e => setPromoExpiry(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowPromoModal(false)}>Cancel</button>
              <button className={styles.saveModalBtn} onClick={handleCreatePromo} disabled={savingPromo}>
                {savingPromo ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
