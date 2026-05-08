import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, PowerOff, Power, Plus, Briefcase } from 'lucide-react';
import { hubsApi, hubStaffApi, hubPincodesApi } from '../../api/adminApi';
import type { Hub, HubStaff, HubPincode } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import styles from './HubDetailPage.module.css';

const TABS = ['Overview', 'Staff', 'Workload', 'Capacity', 'Pincodes', 'Inventory'];

const EMPTY_HUB: Partial<Hub> = { name: '', city: '', state: '', address: '', pincode: '', managerName: '', managerPhone: '', status: 'Active', tailorCount: 0, activeOrders: 0, capacityUsed: 0, qcPassRate: 100 };

const STAFF_ROLES = ['tailor', 'cutter', 'finisher', 'quality_checker', 'manager'];

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

  useBreadcrumbTitle(hub?.name || form.name || (isNew ? 'New Hub' : undefined));

  // Staff state
  const [staff, setStaff] = React.useState<HubStaff[]>([]);
  const [staffLoading, setStaffLoading] = React.useState(false);
  const [showAddStaff, setShowAddStaff] = React.useState(false);
  const [staffName, setStaffName] = React.useState('');
  const [staffPhone, setStaffPhone] = React.useState('');
  const [staffEmail, setStaffEmail] = React.useState('');
  const [staffRole, setStaffRole] = React.useState('tailor');
  const [staffJoinDate, setStaffJoinDate] = React.useState('');
  const [addingStaff, setAddingStaff] = React.useState(false);
  const [togglingStaffId, setTogglingStaffId] = React.useState<string | null>(null);
  // Edit staff modal
  const [editingStaff, setEditingStaff] = React.useState<HubStaff | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editPhone, setEditPhone] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [editRole, setEditRole] = React.useState('tailor');
  const [editJoinDate, setEditJoinDate] = React.useState('');
  const [savingEdit, setSavingEdit] = React.useState(false);

  // Capacity state
  const [dailyLimit, setDailyLimit] = React.useState(60);
  const [savingCapacity, setSavingCapacity] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  // Workload state
  const [workloadStaff, setWorkloadStaff] = React.useState<HubStaff[]>([]);
  const [workloadLoading, setWorkloadLoading] = React.useState(false);
  const [workloadLoaded, setWorkloadLoaded] = React.useState(false);

  // Pincodes state
  const [pincodes, setPincodes] = React.useState<HubPincode[]>([]);
  const [pincodesLoaded, setPincodesLoaded] = React.useState(false);
  const [pincodesLoading, setPincodesLoading] = React.useState(false);
  const [pincodeInput, setPincodeInput] = React.useState('');
  const [pincodeAreaInput, setPincodeAreaInput] = React.useState('');
  const [addingPincodes, setAddingPincodes] = React.useState(false);
  const [removingPincode, setRemovingPincode] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (isNew || !id || activeTab !== 'Workload' || workloadLoaded) return;
    setWorkloadLoading(true);
    hubStaffApi.workload(id)
      .then(s => { setWorkloadStaff(s); setWorkloadLoaded(true); })
      .catch(e => showToast('error', 'Failed to load workload', e instanceof Error ? e.message : undefined))
      .finally(() => setWorkloadLoading(false));
  }, [activeTab, id, isNew, workloadLoaded]);

  React.useEffect(() => {
    if (isNew || !id || activeTab !== 'Pincodes' || pincodesLoaded) return;
    setPincodesLoading(true);
    hubPincodesApi.list(id)
      .then(data => { setPincodes(data); setPincodesLoaded(true); })
      .catch(e => showToast('error', 'Failed to load pincodes', e instanceof Error ? e.message : undefined))
      .finally(() => setPincodesLoading(false));
  }, [activeTab, id, isNew, pincodesLoaded]);

  const handleRemovePincode = async (pincode: string) => {
    if (!hub) return;
    setRemovingPincode(pincode);
    try {
      await hubPincodesApi.remove(hub.id, pincode);
      setPincodes(prev => prev.filter(p => p.pincode !== pincode));
    } catch (e) {
      showToast('error', 'Failed to remove pincode', e instanceof Error ? e.message : undefined);
    } finally { setRemovingPincode(null); }
  };

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

  const handleAddStaff = async () => {
    if (!staffName.trim() || !staffPhone.trim()) {
      showToast('error', 'Name and Phone are required');
      return;
    }
    if (!hub) return;
    setAddingStaff(true);
    try {
      const created = await hubStaffApi.create(hub.id, {
        name: staffName.trim(),
        phone: staffPhone.trim(),
        email: staffEmail.trim() || undefined,
        role: staffRole,
        joined_at: staffJoinDate || undefined,
      });
      setStaff(prev => [...prev, created]);
      setShowAddStaff(false);
      setStaffName(''); setStaffPhone(''); setStaffEmail(''); setStaffRole('tailor'); setStaffJoinDate('');
      showToast('success', 'Staff added', created.name);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setAddingStaff(false); }
  };

  const handleToggleStaff = async (member: HubStaff) => {
    if (!hub) return;
    setTogglingStaffId(member.id);
    try {
      const updated = await hubStaffApi.update(hub.id, member.id, { is_active: !member.is_active });
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setTogglingStaffId(null); }
  };

  const openEditStaff = (member: HubStaff) => {
    setEditingStaff(member);
    setEditName(member.name);
    setEditPhone(member.phone);
    setEditEmail(member.email ?? '');
    setEditRole(member.role);
    setEditJoinDate(member.joined_at ? member.joined_at.slice(0, 10) : '');
  };

  const handleSaveEditStaff = async () => {
    if (!editingStaff || !hub) return;
    if (!editName.trim() || !editPhone.trim()) { showToast('error', 'Name and Phone are required'); return; }
    setSavingEdit(true);
    try {
      const updated = await hubStaffApi.update(hub.id, editingStaff.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        role: editRole,
        joined_at: editJoinDate || undefined,
      });
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
      setEditingStaff(null);
      showToast('success', 'Staff updated');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setSavingEdit(false); }
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

  if (!hub) return <div className={styles.page}><button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><ChevronLeft size={15}/> Back</button><div>Hub not found.</div></div>;

  /* ── EDIT / DETAIL MODE ── */
  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><ChevronLeft size={15}/> Back to Hubs</button>

      <div className={styles.hubHeader}>
        <div>
          <h1 className={styles.hubName}>{hub.name}</h1>
          <div className={styles.hubSub}>{[hub.city, hub.state].filter(Boolean).join(', ')}</div>
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
                  <tr><th>Name</th><th>Phone</th><th>Role</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{s.phone}</td>
                      <td><span className={styles.rolePill}>{s.role.replace(/_/g, ' ')}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{s.joined_at ? new Date(s.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: s.is_active ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className={styles.actionBtn} onClick={() => openEditStaff(s)}>Edit</button>
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
                    <label className={styles.metaLabel}>Phone *</label>
                    <input className={styles.fieldInput} type="tel" placeholder="10-digit mobile" maxLength={10} value={staffPhone} onChange={e => setStaffPhone(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Email (optional)</label>
                    <input className={styles.fieldInput} type="email" placeholder="staff@example.com" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Role</label>
                    <select className={styles.fieldInput} value={staffRole} onChange={e => setStaffRole(e.target.value)}>
                      {STAFF_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Join Date (optional)</label>
                    <input className={styles.fieldInput} type="date" value={staffJoinDate} onChange={e => setStaffJoinDate(e.target.value)} />
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

          {editingStaff && (
            <div className={styles.modalOverlay} onClick={() => setEditingStaff(null)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Edit Staff Member</h3>
                <div className={styles.fields}>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Name *</label>
                    <input className={styles.fieldInput} value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Phone *</label>
                    <input className={styles.fieldInput} type="tel" maxLength={10} value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Email (optional)</label>
                    <input className={styles.fieldInput} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Role</label>
                    <select className={styles.fieldInput} value={editRole} onChange={e => setEditRole(e.target.value)}>
                      {STAFF_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.metaLabel}>Join Date</label>
                    <input className={styles.fieldInput} type="date" value={editJoinDate} onChange={e => setEditJoinDate(e.target.value)} />
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setEditingStaff(null)}>Cancel</button>
                  <button className={styles.editBtn} disabled={savingEdit} onClick={handleSaveEditStaff}>
                    {savingEdit ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Workload' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{hub.name} — Staff Workload</h3>
              <button className={styles.addBtn} style={{ fontSize: 12 }} onClick={() => { setWorkloadLoaded(false); }}>Refresh</button>
            </div>
            {workloadLoading ? (
              <div className={styles.empty}>Loading workload…</div>
            ) : workloadStaff.length === 0 ? (
              <div className={styles.empty}>No active staff. Add staff in the Staff tab first.</div>
            ) : (
              <table className={styles.miniTable}>
                <thead>
                  <tr>
                    <th>Staff</th><th>Role</th><th>Active Orders</th><th>Active Bookings</th><th>Active Visits</th><th>Total Load</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadStaff.map(s => {
                    const total = (s.active_orders ?? 0) + (s.active_bookings ?? 0) + (s.active_visits ?? 0);
                    const loadColor = total === 0 ? '#16a34a' : total <= 3 ? '#d97706' : '#dc2626';
                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{s.name}</div>
                          {s.reference_id && <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{s.reference_id}</div>}
                        </td>
                        <td><span className={styles.rolePill}>{s.role.replace(/_/g, ' ')}</span></td>
                        <td style={{ textAlign: 'center' }}>{s.active_orders ?? 0}</td>
                        <td style={{ textAlign: 'center' }}>{s.active_bookings ?? 0}</td>
                        <td style={{ textAlign: 'center' }}>{s.active_visits ?? 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: loadColor }}>
                            <Briefcase size={13} />{total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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

      {activeTab === 'Pincodes' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{hub.name} — Service Pincodes</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Pincodes listed here are serviceable by this hub. Each pincode can only be assigned to one hub.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className={styles.metaLabel}>Pincode *</label>
                <input
                  className={styles.fieldInput}
                  style={{ fontFamily: 'monospace', fontSize: 13, width: 140 }}
                  placeholder="e.g. 560034"
                  maxLength={6}
                  value={pincodeInput}
                  onChange={e => setPincodeInput(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px' }}>
                <label className={styles.metaLabel}>Area Name</label>
                <input
                  className={styles.fieldInput}
                  style={{ fontSize: 13 }}
                  placeholder="e.g. Koramangala"
                  value={pincodeAreaInput}
                  onChange={e => setPincodeAreaInput(e.target.value)}
                />
              </div>
              <button
                className={styles.editBtn}
                disabled={addingPincodes || pincodeInput.length !== 6}
                onClick={async () => {
                  if (pincodeInput.length !== 6) { showToast('error', 'Enter a valid 6-digit pincode'); return; }
                  setAddingPincodes(true);
                  try {
                    const { added } = await hubPincodesApi.add(hub.id, [{ pincode: pincodeInput, area_name: pincodeAreaInput }]);
                    setPincodes(prev => {
                      const existing = new Set(prev.map(p => p.pincode));
                      return [...prev, ...added.filter(p => !existing.has(p.pincode))].sort((a, b) => a.pincode.localeCompare(b.pincode));
                    });
                    setPincodeInput(''); setPincodeAreaInput('');
                    showToast('success', `Pincode ${pincodeInput} assigned`);
                  } catch (e) {
                    showToast('error', 'Failed to add', e instanceof Error ? e.message : undefined);
                  } finally { setAddingPincodes(false); }
                }}
              >
                {addingPincodes ? 'Adding…' : '+ Assign Pincode'}
              </button>
            </div>
            {pincodesLoading ? (
              <div className={styles.empty}>Loading pincodes…</div>
            ) : pincodes.length === 0 ? (
              <div className={styles.empty}>No pincodes assigned yet. This hub will not match any service area until pincodes are added.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr><th>Pincode</th><th>Area Name</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pincodes.map(p => (
                    <tr key={p.pincode}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.pincode}</td>
                      <td>{p.area_name || '—'}</td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: p.is_active ? 'rgba(28,92,66,0.12)' : 'rgba(148,163,184,0.12)', color: p.is_active ? '#1C5C42' : 'var(--color-text-secondary)' }}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={styles.editBtn}
                          style={{ padding: '4px 10px', fontSize: 12, height: 28 }}
                          onClick={() => hubPincodesApi.toggle(hub.id, p.id, !p.is_active)
                            .then(() => setPincodes(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x)))
                            .catch(e => showToast('error', 'Failed', e instanceof Error ? e.message : undefined))}
                        >
                          {p.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className={styles.deactivateBtn}
                          style={{ padding: '4px 10px', fontSize: 12, height: 28 }}
                          disabled={removingPincode === p.pincode}
                          onClick={() => handleRemovePincode(p.pincode)}
                        >
                          {removingPincode === p.pincode ? '…' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
