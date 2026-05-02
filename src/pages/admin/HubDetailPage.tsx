import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, PowerOff, Power, Plus } from 'lucide-react';
import { hubsApi } from '../../api/adminApi';
import type { Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './HubDetailPage.module.css';

const TABS = ['Overview', 'Staff', 'Capacity', 'Inventory'];


const EMPTY_HUB: Partial<Hub> = { name: '', city: '', state: '', address: '', pincode: '', managerName: '', managerPhone: '', status: 'Active', tailorCount: 0, activeOrders: 0, capacityUsed: 0, qcPassRate: 100 };

export const HubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [hub, setHub] = React.useState<Hub | null>(null);
  const [form, setForm] = React.useState<Partial<Hub>>(EMPTY_HUB);
  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Overview');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

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
    if (!form.name || !form.city) { showToast('error', 'Name and City are required'); return; }
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
        <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><ChevronLeft size={15}/> Back to Hubs</button>
        <h1 className={styles.hubName} style={{ marginBottom: 0 }}>New Hub</h1>
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Hub Details</h3>
          <div className={styles.formGrid}>
            {([
              { key: 'name', label: 'Hub Name *', type: 'text' },
              { key: 'city', label: 'City *', type: 'text' },
              { key: 'state', label: 'State', type: 'text' },
              { key: 'address', label: 'Address', type: 'text' },
              { key: 'pincode', label: 'Pincode', type: 'text' },
              { key: 'managerName', label: 'Manager Name', type: 'text' },
              { key: 'managerPhone', label: 'Manager Phone', type: 'text' },
            ] as Array<{ key: keyof Hub; label: string; type: string }>).map(f => (
              <div key={f.key} className={styles.formField}>
                <label className={styles.metaLabel}>{f.label}</label>
                <input
                  type={f.type}
                  className={styles.fieldInput}
                  value={(form[f.key] as string) ?? ''}
                  onChange={e => handleFormChange(f.key, e.target.value)}
                />
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

  if (!hub) return <div className={styles.page}><button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><ChevronLeft size={15}/> Back</button><div>Hub not found.</div></div>;

  /* ── EDIT / DETAIL MODE ── */
  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><ChevronLeft size={15}/> Back to Hubs</button>

      <div className={styles.hubHeader}>
        <div>
          <h1 className={styles.hubName}>{hub.name}</h1>
          <div className={styles.hubSub}>{hub.city}, {hub.state}</div>
        </div>
        <div className={styles.hubActions}>
          <button className={styles.editBtn} disabled={saving} onClick={handleSave}><Save size={14}/> {saving ? 'Saving…' : 'Save Changes'}</button>
          <button className={styles.deactivateBtn} onClick={async () => {
            try {
              const updated = await hubsApi.update(hub.id, { status: hub.status === 'Active' ? 'Inactive' : 'Active' });
              setHub(updated); setForm(updated);
              showToast('success', `Hub ${updated.status.toLowerCase()}`);
            } catch (e) { showToast('error', 'Failed', e instanceof Error ? e.message : undefined); }
          }}>
            {hub.status === 'Active' ? <><PowerOff size={14}/> Deactivate Hub</> : <><Power size={14}/> Activate Hub</>}
          </button>
        </div>
      </div>

      {hub.status === 'At Capacity' && <div className={styles.capacityBanner}>Hub at capacity. New orders to this hub are currently blocked.</div>}
      {hub.status === 'Inactive' && <div className={styles.inactiveBanner}>This hub is inactive. It is not accepting new orders.</div>}

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab === 'Overview' && (
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
      )}

      {activeTab === 'Staff' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{hub.name} — Staff</h3>
              <button className={styles.addBtn}><Plus size={14}/> Add Staff Member</button>
            </div>
            <div className={styles.empty}>No staff members added yet. Use the button above to add staff to this hub.</div>
          </div>
        </div>
      )}

      {activeTab === 'Capacity' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>{hub.name} — Capacity</h3>
            <div className={styles.capacitySettings}>
              <div className={styles.capacityRow}>
                <span className={styles.metaLabel}>Daily order limit</span>
                <div className={styles.capacityInput}>
                  <input type="number" defaultValue={60} className={styles.numInput} />
                  <button className={styles.saveBtn}>Save</button>
                </div>
              </div>
              <div className={styles.capacityProgress}>
                <span className={styles.metaLabel}>Today: {hub.activeOrders} / 60 orders</span>
                <div className={styles.progressBar}>
                  <div className={`${styles.progressFill} ${hub.capacityUsed >= 100 ? styles.progressFull : hub.capacityUsed >= 80 ? styles.progressHigh : styles.progressNormal}`}
                    style={{ width: `${Math.min(hub.capacityUsed, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Inventory' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{hub.name} — Fabric Inventory</h3>
              <button className={styles.addBtn}><Plus size={14}/> Add Fabric</button>
            </div>
            <div className={styles.empty}>No fabric inventory tracked yet. Add fabrics to this hub to start tracking stock.</div>
          </div>
        </div>
      )}
    </div>
  );
};
