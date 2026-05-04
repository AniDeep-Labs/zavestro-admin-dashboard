import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { homeVisitsApi, hubsApi } from '../../api/adminApi';
import type { HomeVisit, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import modalStyles from './OrderDetailPage.module.css';

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_CSS: Record<string, string> = {
  pending: 'stageWarning', confirmed: 'stageBlue', completed: 'stageSuccess', cancelled: 'stageNeutral',
};
const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

const todayStr = () => new Date().toISOString().slice(0, 10);

interface CreateForm {
  userQuery: string;
  userId: string;
  userName: string;
  date: string;
  time: string;
  hubId: string;
  notes: string;
  addressName: string;
  addressPhone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

const EMPTY_FORM: CreateForm = {
  userQuery: '', userId: '', userName: '',
  date: '', time: '10:00',
  hubId: '', notes: '',
  addressName: '', addressPhone: '',
  line1: '', line2: '', city: '', state: '', pincode: '',
};

export const HomeVisitsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');
  const [hubFilter, setHubFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [visits, setVisits] = React.useState<HomeVisit[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // Create modal
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = React.useState(false);
  const [userResults, setUserResults] = React.useState<{ id: string; name: string; phone: string; email: string }[]>([]);
  const debouncedQuery = useDebounce(form.userQuery, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    hubsApi.list({}).then(r => setHubs(r.hubs)).catch(() => {});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    homeVisitsApi.list({
      status: statusFilter || undefined,
      date: dateFilter || undefined,
      hub_id: hubFilter || undefined,
      page,
      limit: 25,
    })
      .then(r => { setVisits(r.visits); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, dateFilter, hubFilter, page]);

  React.useEffect(() => { load(); }, [load]);

  // Debounced user search
  React.useEffect(() => {
    if (!showCreate) return;
    if (form.userId) { setUserResults([]); return; }
    if (debouncedQuery.length < 2) { setUserResults([]); return; }
    homeVisitsApi.searchUsers(debouncedQuery)
      .then(setUserResults)
      .catch(() => setUserResults([]));
  }, [debouncedQuery, form.userId, showCreate]);

  const selectUser = (u: { id: string; name: string; phone: string; email: string }) => {
    setForm(f => ({ ...f, userId: u.id, userName: u.name, userQuery: u.name, addressPhone: f.addressPhone || u.phone }));
    setUserResults([]);
  };

  const clearUser = () => setForm(f => ({ ...f, userId: '', userName: '', userQuery: '' }));

  const setF = (key: keyof CreateForm, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleCreate = async () => {
    if (!form.userId || !form.date || !form.time || !form.line1 || !form.city) {
      showToast('error', 'Fill required fields', 'Customer, date, time, address line 1, and city are required');
      return;
    }
    setCreating(true);
    try {
      const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
      const visit = await homeVisitsApi.create({
        user_id: form.userId,
        scheduled_at,
        hub_id: form.hubId || undefined,
        notes: form.notes || undefined,
        address_name: form.addressName || undefined,
        address_phone: form.addressPhone || undefined,
        address_line1: form.line1,
        address_line2: form.line2 || undefined,
        city: form.city,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
      });
      showToast('success', 'Visit created', form.userName);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setUserResults([]);
      load();
      navigate(`/admin/home-visits/${visit.id}`);
    } catch (e) {
      showToast('error', 'Create failed', e instanceof Error ? e.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (visit: HomeVisit, newStatus: string) => {
    setUpdatingId(visit.id);
    try {
      const updated = await homeVisitsApi.updateStatus(visit.id, newStatus);
      setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
      showToast('success', 'Status updated', `${visit.customer_name} → ${STATUS_LABELS[newStatus] ?? newStatus}`);
    } catch (e) {
      showToast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally { setUpdatingId(null); }
  };

  const clearFilters = () => { setStatusFilter(''); setDateFilter(''); setHubFilter(''); setPage(1); };
  const setToday = () => { setDateFilter(todayStr()); setPage(1); };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Home Visits</h1>
        <button
          className={styles.createBtn ?? styles.filterSelect}
          style={{ height: 38, padding: '0 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-base)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={15} /> Create Visit
        </button>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={styles.filterSelect} value={hubFilter} onChange={e => { setHubFilter(e.target.value); setPage(1); }}>
          <option value="">All Hubs</option>
          {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <input type="date" className={styles.filterSelect} value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1); }} />
        <button className={styles.clearBtn} onClick={setToday}>Today</button>
        <button className={styles.clearBtn} onClick={clearFilters}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Customer</th><th>Phone</th><th>Scheduled</th><th>City</th><th>Hub</th><th>Assigned Staff</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : visits.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No home visits found.</td></tr>
            ) : visits.map(v => (
              <tr key={v.id} className={styles.row} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/home-visits/${v.id}`)}>
                <td><div className={styles.customerName}>{v.customer_name}</div></td>
                <td><div className={styles.customerPhone}>{v.customer_phone ?? '—'}</div></td>
                <td className={styles.date}>{new Date(v.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{v.city ?? '—'}</td>
                <td>{v.hub_name ?? '—'}</td>
                <td>{v.assigned_staff_name ?? <span style={{ color: 'var(--color-text-tertiary)' }}>Unassigned</span>}</td>
                <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[v.status] ?? 'stageNeutral']}`}>{STATUS_LABELS[v.status] ?? v.status}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <select
                    className={styles.filterSelect}
                    style={{ height: 30, fontSize: 12 }}
                    value={v.status}
                    disabled={updatingId === v.id}
                    onChange={e => handleStatusChange(v, e.target.value)}
                  >
                    {VALID_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} visit${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page}</span>
          <button className={styles.pageBtn} disabled={visits.length < 25 || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>

      {/* Create Visit Modal */}
      {showCreate && (
        <div className={modalStyles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={modalStyles.modal} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 className={modalStyles.modalTitle}>Create Home Visit</h2>

            {/* Customer search */}
            <div className={modalStyles.field}>
              <label className={modalStyles.fieldLabel}>Customer * <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(search by name, phone, or email)</span></label>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className={modalStyles.fieldSelect}
                    style={{ flex: 1 }}
                    placeholder="Type to search…"
                    value={form.userQuery}
                    onChange={e => { setF('userQuery', e.target.value); if (form.userId) clearUser(); }}
                    autoComplete="off"
                  />
                  {form.userId && (
                    <button
                      style={{ padding: '0 10px', background: 'none', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                      onClick={clearUser}
                    >✕</button>
                  )}
                </div>
                {userResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', marginTop: 2 }}>
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)', fontFamily: 'var(--font-family)' }}
                        onClick={() => selectUser(u)}
                      >
                        <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{u.phone} · {u.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.userId && (
                <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 4 }}>✓ {form.userName}</div>
              )}
            </div>

            {/* Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>Date *</label>
                <input type="date" className={modalStyles.fieldSelect} value={form.date} onChange={e => setF('date', e.target.value)} />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>Time *</label>
                <input type="time" className={modalStyles.fieldSelect} value={form.time} onChange={e => setF('time', e.target.value)} />
              </div>
            </div>

            {/* Hub */}
            <div className={modalStyles.field}>
              <label className={modalStyles.fieldLabel}>Hub</label>
              <select className={modalStyles.fieldSelect} value={form.hubId} onChange={e => setF('hubId', e.target.value)}>
                <option value="">— No hub assigned —</option>
                {hubs.map(h => <option key={h.id} value={h.id}>{h.name} ({h.city})</option>)}
              </select>
            </div>

            {/* Address */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 4 }}>Visit Address</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>Contact Name</label>
                <input className={modalStyles.fieldSelect} placeholder="e.g. Rahul Sharma" value={form.addressName} onChange={e => setF('addressName', e.target.value)} />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>Contact Phone</label>
                <input className={modalStyles.fieldSelect} placeholder="+91 98765 43210" value={form.addressPhone} onChange={e => setF('addressPhone', e.target.value)} />
              </div>
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.fieldLabel}>Address Line 1 *</label>
              <input className={modalStyles.fieldSelect} placeholder="Flat / House no., Street" value={form.line1} onChange={e => setF('line1', e.target.value)} />
            </div>
            <div className={modalStyles.field}>
              <label className={modalStyles.fieldLabel}>Address Line 2</label>
              <input className={modalStyles.fieldSelect} placeholder="Area, Landmark (optional)" value={form.line2} onChange={e => setF('line2', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>City *</label>
                <input className={modalStyles.fieldSelect} placeholder="Bangalore" value={form.city} onChange={e => setF('city', e.target.value)} />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>State</label>
                <input className={modalStyles.fieldSelect} placeholder="Karnataka" value={form.state} onChange={e => setF('state', e.target.value)} />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>Pincode</label>
                <input className={modalStyles.fieldSelect} placeholder="560001" value={form.pincode} onChange={e => setF('pincode', e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div className={modalStyles.field}>
              <label className={modalStyles.fieldLabel}>Notes</label>
              <textarea
                className={modalStyles.fieldTextarea}
                rows={2}
                placeholder="Any special instructions or context…"
                value={form.notes}
                onChange={e => setF('notes', e.target.value)}
              />
            </div>

            <div className={modalStyles.modalActions}>
              <button className={modalStyles.cancelModalBtn} onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setUserResults([]); }}>Cancel</button>
              <button
                disabled={creating || !form.userId || !form.date || !form.time || !form.line1 || !form.city}
                onClick={handleCreate}
                style={{ height: 40, padding: '0 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-base)', fontWeight: 600, cursor: 'pointer', opacity: (creating || !form.userId || !form.date || !form.time || !form.line1 || !form.city) ? 0.5 : 1 }}
              >
                {creating ? 'Creating…' : 'Create Visit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
