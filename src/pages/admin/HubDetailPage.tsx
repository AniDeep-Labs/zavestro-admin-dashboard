import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, PowerOff, Power, Plus } from 'lucide-react';
import { hubsApi, hubStaffApi, hubPincodesApi } from '../../api/adminApi';
import type { Hub, HubStaff, HubPincode } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import styles from './HubDetailPage.module.css';

const TABS = ['Overview', 'Staff', 'Capacity', 'Pincodes', 'Inventory'];

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

  // Pincodes state
  const [pincodes, setPincodes] = React.useState<HubPincode[]>([]);
  const [pincodesLoaded, setPincodesLoaded] = React.useState(false);
  const [pincodesLoading, setPincodesLoading] = React.useState(false);
  const [pincodeInput, setPincodeInput] = React.useState('');
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
    if (isNew || !id || activeTab !== 'Pincodes' || pincodesLoaded) return;
    setPincodesLoading(true);
    hubPincodesApi.list(id)
      .then(data => { setPincodes(data); setPincodesLoaded(true); })
      .catch(e => showToast('error', 'Failed to load pincodes', e instanceof Error ? e.message : undefined))
      .finally(() => setPincodesLoading(false));
  }, [activeTab, id, isNew, pincodesLoaded]);

  const handleAddPincodes = async () => {
    if (!hub || !pincodeInput.trim()) return;
    const list = pincodeInput.split(/[\s,\n]+/).map(p => p.trim()).filter(p => p.length >= 4);
    if (list.length === 0) { showToast('error', 'Enter at least one valid pincode (min 4 digits)'); return; }
    setAddingPincodes(true);
    try {
      const { added } = await hubPincodesApi.add(hub.id, list);
      setPincodes(prev => {
        const existing = new Set(prev.map(p => p.pincode));
        return [...prev, ...added.filter(p => !existing.has(p.pincode))].sort((a, b) => a.pincode.localeCompare(b.pincode));
      });
      setPincodeInput('');
      showToast('success', `${added.length} pincode${added.length !== 1 ? 's' : ''} added`);
    } catch (e) {
      showToast('error', 'Failed to add pincodes', e instanceof Error ? e.message : undefined);
    } finally { setAddingPincodes(false); }
  };

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
                  className={`${styles.fieldInput} ${submitted && (f.key === 'name' || f.key === 'city') && !form[f.key] ? styles.inputError : ''}`}
                  value={(form[f.key] as string) ?? ''}
                  onChange={e => handleFormChange(f.key, e.target.value)}
                />
                {submitted && (f.key === 'name' || f.key === 'city') && !form[f.key] && <span className={styles.fieldHint}>This field is required</span>}
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
              Pincodes listed here are serviceable by this hub. Orders to other pincodes will be blocked at checkout.
              Enter multiple pincodes separated by spaces, commas, or new lines.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <textarea
                rows={3}
                className={styles.fieldInput}
                style={{ flex: '1 1 300px', padding: '8px 12px', resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                placeholder="e.g., 110001, 110002, 400001"
                value={pincodeInput}
                onChange={e => setPincodeInput(e.target.value)}
              />
              <button
                className={styles.editBtn}
                disabled={addingPincodes || !pincodeInput.trim()}
                onClick={handleAddPincodes}
                style={{ alignSelf: 'flex-start' }}
              >
                {addingPincodes ? 'Adding…' : 'Add Pincodes'}
              </button>
            </div>
            {pincodesLoading ? (
              <div className={styles.empty}>Loading pincodes…</div>
            ) : pincodes.length === 0 ? (
              <div className={styles.empty}>No pincodes added yet. This hub will not be matched for any orders until pincodes are added.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pincodes.map(p => (
                  <div key={p.pincode} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)', borderRadius: 6, padding: '4px 10px', fontSize: 13, fontFamily: 'monospace' }}>
                    <span>{p.pincode}</span>
                    <button
                      onClick={() => handleRemovePincode(p.pincode)}
                      disabled={removingPincode === p.pincode}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '0 0 0 4px', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
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
