import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, PowerOff, Power, Plus } from 'lucide-react';
import { hubsApi, hubStaffApi } from '../../api/adminApi';
import type { Hub, HubStaff } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './HubDetailPage.module.css';

const TABS = ['Overview', 'Staff', 'Capacity', 'Inventory'];

const EMPTY_HUB: Partial<Hub> = { name: '', city: '', state: '', address: '', pincode: '', managerName: '', managerPhone: '', status: 'Active', tailorCount: 0, activeOrders: 0, capacityUsed: 0, qcPassRate: 100 };

const STAFF_ROLES = ['tailor', 'qc_staff', 'dispatch'];

export const HubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [hub, setHub] = React.useState<Hub | null>(null);
  const [form, setForm] = React.useState<Partial<Hub>>(EMPTY_HUB);
  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Overview');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // Staff state
  const [staff, setStaff] = React.useState<HubStaff[]>([]);
  const [staffLoading, setStaffLoading] = React.useState(false);
  const [showAddStaff, setShowAddStaff] = React.useState(false);
  const [staffName, setStaffName] = React.useState('');
  const [staffEmail, setStaffEmail] = React.useState('');
  const [staffPassword, setStaffPassword] = React.useState('');
  const [staffRole, setStaffRole] = React.useState('tailor');
  const [addingStaff, setAddingStaff] = React.useState(false);
  const [togglingStaffId, setTogglingStaffId] = React.useState<string | null>(null);

  // Capacity state
  const [dailyLimit, setDailyLimit] = React.useState(60);
  const [savingCapacity, setSavingCapacity] = React.useState(false);

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

  React.useEffect(() => {
    if (isNew || !id || activeTab !== 'Staff') return;
    setStaffLoading(true);
    hubStaffApi.list(id)
      .then(setStaff)
      .catch(e => showToast('error', 'Failed to load staff', e instanceof Error ? e.message : undefined))
      .finally(() => setStaffLoading(false));
  }, [activeTab, id, isNew]);

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

  const handleAddStaff = async () => {
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword) {
      showToast('error', 'All fields required');
      return;
    }
    if (!hub) return;
    setAddingStaff(true);
    try {
      const created = await hubStaffApi.create(hub.id, {
        name: staffName.trim(), email: staffEmail.trim(),
        password: staffPassword, role: staffRole,
      });
      setStaff(prev => [...prev, created]);
      setShowAddStaff(false);
      setStaffName(''); setStaffEmail(''); setStaffPassword(''); setStaffRole('tailor');
      showToast('success', 'Staff added', created.name);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setAddingStaff(false); }
  };

  const handleToggleStaff = async (member: HubStaff) => {
    if (!hub) return;
    setTogglingStaffId(member.id);
    try {
      const updated = await hubStaffApi.toggleActive(hub.id, member.id, !member.is_active);
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setTogglingStaffId(null); }
  };

  const handleSaveCapacity = async () => {
    if (!hub) return;
    setSavingCapacity(true);
    try {
      const updated = await hubsApi.update(hub.id, { ...form, dailyOrderLimit: dailyLimit } as Partial<Hub>);
      setHub(updated); setForm(updated);
      showToast('success', 'Capacity saved');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setSavingCapacity(false); }
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
              <button className={styles.addBtn} onClick={() => setShowAddStaff(true)}><Plus size={14}/> Add Staff Member</button>
            </div>
            {staffLoading ? (
              <div className={styles.empty}>Loading staff…</div>
            ) : staff.length === 0 ? (
              <div className={styles.empty}>No staff members added yet. Use the button above to add staff to this hub.</div>
            ) : (
              <table className={styles.miniTable}>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{s.email}</td>
                      <td><span className={styles.rolePill}>{s.role.replace(/_/g, ' ')}</span></td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: s.is_active ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={styles.actionBtn}
                          disabled={togglingStaffId === s.id}
                          onClick={() => handleToggleStaff(s)}
                        >
                          {s.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {showAddStaff && (
            <div className={styles.modalOverlay} onClick={() => setShowAddStaff(false)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Add Staff Member</h3>
                <div className={styles.fields}>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Name *</label>
                    <input className={styles.fieldInput} placeholder="Full name" value={staffName} onChange={e => setStaffName(e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Email *</label>
                    <input className={styles.fieldInput} type="email" placeholder="staff@zavestro.in" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Temporary Password * (min 8 chars)</label>
                    <input className={styles.fieldInput} type="password" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Role</label>
                    <select className={styles.fieldInput} value={staffRole} onChange={e => setStaffRole(e.target.value)}>
                      {STAFF_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setShowAddStaff(false)}>Cancel</button>
                  <button className={styles.editBtn} disabled={addingStaff} onClick={handleAddStaff}>
                    {addingStaff ? 'Adding…' : 'Add Staff'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  <input
                    type="number"
                    value={dailyLimit}
                    min={1}
                    className={styles.numInput}
                    onChange={e => setDailyLimit(parseInt(e.target.value) || 1)}
                  />
                  <button
                    className={styles.saveBtn}
                    disabled={savingCapacity}
                    onClick={handleSaveCapacity}
                  >
                    {savingCapacity ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <div className={styles.capacityProgress}>
                <span className={styles.metaLabel}>Today: {hub.activeOrders} / {dailyLimit} orders</span>
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
            </div>
            <div className={styles.empty}>Fabric inventory tracking is managed via the hub manager portal. View inventory per-hub through the hub manager login.</div>
          </div>
        </div>
      )}
    </div>
  );
};
