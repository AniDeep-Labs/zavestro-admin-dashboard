import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { hubsApi } from '../../api/adminApi';
import type { Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import styles from './HubDetailPage.module.css';
import { UilAngleLeft, UilPower, UilSave } from "@iconscout/react-unicons";

const EMPTY_HUB: Partial<Hub> = { name: '', city: '', state: '', address: '', pincode: '', managerName: '', managerPhone: '', status: 'Active', tailorCount: 0, activeOrders: 0, capacityUsed: 0, qcPassRate: 100 };

export const HubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [hub, setHub] = React.useState<Hub | null>(null);
  const [form, setForm] = React.useState<Partial<Hub>>(EMPTY_HUB);
  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  useBreadcrumbTitle(hub?.name || form.name || (isNew ? 'New Hub' : undefined));

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    hubsApi.get(id)
      .then(h => { setHub(h); setForm(h); })
      .catch(e => showToast('error', 'Failed to load hub', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleFormChange = (key: keyof Hub, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSubmitted(true);
    const errors: string[] = [];
    if (!form.name?.trim()) errors.push('Hub Name');
    if (!form.city?.trim()) errors.push('City');
    if (!form.address?.trim()) errors.push('Address');
    if (!form.managerName?.trim()) errors.push('Manager Name');
    if (!form.managerPhone?.trim()) errors.push('Manager Phone');
    if (form.managerPhone && !/^\d{10}$/.test(form.managerPhone.replace(/\s/g, ''))) {
      showToast('error', 'Manager phone must be a 10-digit Indian mobile number'); return;
    }
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      showToast('error', 'Hub pincode must be 6 digits'); return;
    }
    if (errors.length > 0) {
      showToast('error', `Required fields missing: ${errors.join(', ')}`); return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await hubsApi.create(form);
        showToast('success', 'Hub created', created.name);
        navigate(`/admin/hubs/${created.id}`, { replace: true });
      } else if (hub) {
        const updated = await hubsApi.update(hub.id, form);
        setHub(updated); setForm(updated);
        showToast('success', 'Hub saved');
      }
    } catch (e) {
      showToast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  if (loading) return <div className={styles.page}><div>Loading hub…</div></div>;

  /* ── CREATE MODE ── */
  if (isNew) {
    return (
      <div className={styles.page}>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><UilAngleLeft size={15}/> Back to Hubs</button>
        <h1 className={styles.hubName} style={{ marginBottom: 0 }}>New Hub</h1>
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Hub Details</h3>
          <div className={styles.formGrid}>
            {([
              { key: 'name',         label: 'Hub Name *',       type: 'text',  required: true },
              { key: 'city',         label: 'City *',           type: 'text',  required: true },
              { key: 'state',        label: 'State',            type: 'text',  required: false },
              { key: 'address',      label: 'Address Line 1 *', type: 'text',  required: true },
              { key: 'pincode',      label: 'Pincode (6-digit)', type: 'text', required: false },
              { key: 'managerName',  label: 'Manager Name *',   type: 'text',  required: true },
              { key: 'managerPhone', label: 'Manager Phone *',  type: 'tel',   required: true },
            ] as Array<{ key: keyof Hub; label: string; type: string; required: boolean }>).map(f => (
              <div key={f.key} className={styles.formField}>
                <label className={styles.metaLabel}>{f.label}</label>
                <input
                  type={f.type}
                  className={`${styles.fieldInput} ${submitted && f.required && !form[f.key] ? styles.inputError : ''}`}
                  value={(form[f.key] as string) ?? ''}
                  onChange={e => handleFormChange(f.key, e.target.value)}
                  placeholder={f.key === 'managerPhone' ? '10-digit mobile' : f.key === 'pincode' ? '6-digit pincode' : ''}
                />
                {submitted && f.required && !form[f.key] && <span className={styles.fieldHint}>This field is required</span>}
              </div>
            ))}
            <div className={styles.formField}>
              <label className={styles.metaLabel}>Status</label>
              <select className={styles.fieldInput} value={form.status ?? 'Active'} onChange={e => handleFormChange('status', e.target.value)}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}>Cancel</button>
          <button className={styles.editBtn} disabled={saving} onClick={handleSave}>{saving ? 'Creating…' : 'Create Hub'}</button>
        </div>
      </div>
    );
  }

  if (!hub) return <div className={styles.page}><button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><UilAngleLeft size={15}/> Back</button><div>Hub not found.</div></div>;

  /* ── EDIT / DETAIL MODE (super-admin oversight) ── */
  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><UilAngleLeft size={15}/> Back to Hubs</button>

      <div className={styles.hubHeader}>
        <div>
          <h1 className={styles.hubName}>{hub.name}</h1>
          <div className={styles.hubSub}>{[hub.city, hub.state].filter(Boolean).join(', ')}</div>
        </div>
        <div className={styles.hubActions}>
          <button className={styles.editBtn} disabled={saving} onClick={handleSave}><UilSave size={14}/> {saving ? 'Saving…' : 'Save Changes'}</button>
          <button className={styles.deactivateBtn} onClick={async () => {
            try {
              const updated = await hubsApi.update(hub.id, { status: hub.status === 'Active' ? 'Inactive' : 'Active' });
              setHub(updated); setForm(updated);
              showToast('success', `Hub ${updated.status.toLowerCase()}`);
            } catch (e) { showToast('error', 'Failed', e instanceof Error ? e.message : undefined); }
          }}>
            {hub.status === 'Active' ? <><UilPower size={14}/> Deactivate Hub</> : <><UilPower size={14}/> Activate Hub</>}
          </button>
        </div>
      </div>

      {hub.status === 'Inactive' && <div className={styles.inactiveBanner}>This hub is inactive. It is not accepting new orders.</div>}

      <div className={styles.tabContent}>
        <div className={styles.twoCol}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Hub Details</h3>
            <div className={styles.formGrid}>
              {([
                { key: 'address', label: 'Address' },
                { key: 'pincode', label: 'Pincode' },
                { key: 'managerName', label: 'Hub Manager' },
                { key: 'managerPhone', label: 'Contact' },
              ] as Array<{ key: keyof Hub; label: string }>).map(f => (
                <div key={f.key} className={styles.formField}>
                  <label className={styles.metaLabel}>{f.label}</label>
                  <input type="text" className={styles.fieldInput}
                    value={(form[f.key] as string) ?? ''}
                    onChange={e => handleFormChange(f.key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Performance</h3>
            <div className={styles.perfGrid}>
              <div className={styles.perfCard}><div className={styles.perfValue}>{hub.activeOrders}</div><div className={styles.perfLabel}>Active Orders</div></div>
              <div className={styles.perfCard}><div className={styles.perfValue}>{hub.capacityUsed}%</div><div className={styles.perfLabel}>Capacity Used</div></div>
              <div className={styles.perfCard}><div className={styles.perfValue}>{hub.qcPassRate}%</div><div className={styles.perfLabel}>QC Pass Rate</div></div>
              <div className={styles.perfCard}><div className={styles.perfValue}>{hub.tailorCount}</div><div className={styles.perfLabel}>Tailors</div></div>
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Recent Orders</h3>
            <button className={styles.linkBtn} onClick={() => navigate('/admin/orders')}>View All →</button>
          </div>
          <div className={styles.empty}>Navigate to Orders and filter by hub to see orders.</div>
        </div>
      </div>
    </div>
  );
};

export default HubDetailPage;
