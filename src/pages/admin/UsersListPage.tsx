import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, X, ChevronLeft, ChevronRight, UserPlus, Copy, Check } from 'lucide-react';
import { usersApi } from '../../api/adminApi';
import type { AdminUser } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './UsersListPage.module.css';

const LIMIT = 25;

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const UsersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  // Create user modal
  const [showCreate, setShowCreate] = React.useState(false);
  const [newPhone, setNewPhone] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newCity, setNewCity] = React.useState('Bangalore');
  const [genPassword, setGenPassword] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState('');

  // Temp password reveal modal
  const [tempPassword, setTempPassword] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true); setError('');
    usersApi.list({ search: debouncedSearch || undefined, status: statusFilter || undefined, page, limit: LIMIT })
      .then(r => { setUsers(r.users); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, page]);

  const exportCSV = () => {
    const rows = [['ID','Name','Phone','Email','City','Orders','Credits','Joined','Status'],
      ...users.map(u => [u.id, u.name, u.phone, u.email, u.city, u.orders, u.credits, u.joined, u.status])];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `users-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const handleCreateUser = async () => {
    const phone = newPhone.trim();
    if (!phone) { setPhoneError('Phone number is required'); return; }
    if (!/^\d{10}$/.test(phone)) { setPhoneError('Enter a 10-digit Indian mobile number (no country code)'); return; }
    setPhoneError('');
    setCreating(true);
    try {
      const created = await usersApi.create({
        phone,
        name: newName.trim() || undefined,
        email: newEmail.trim() || undefined,
        generate_password: genPassword,
      });
      setUsers(prev => [created, ...prev]);
      setTotal(t => t + 1);
      setShowCreate(false);
      setNewPhone(''); setNewName(''); setNewEmail(''); setNewCity('Bangalore'); setGenPassword(true);
      if (created.temp_password) {
        setTempPassword(created.temp_password);
      } else {
        showToast('success', 'Customer created', `${created.name || created.phone} added`);
      }
    } catch (e) {
      showToast('error', 'Failed to create customer', e instanceof Error ? e.message : undefined);
    } finally { setCreating(false); }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Users</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.exportBtn} onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-green, var(--green))', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' }}>
            <UserPlus size={14}/> Add Customer
          </button>
          <button className={styles.exportBtn} onClick={exportCSV}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search by name, phone, or email…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Deactivated">Deactivated</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}><X size={14} /> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Ref</th><th>Name</th><th>Phone</th><th>Email</th><th>City</th>
            <th>Orders</th><th>Credits</th><th>Joined</th><th>Status</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({length: 8}).map((_, i) => (
              <tr key={i}>{Array.from({length: 9}).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : error ? (
              <tr><td colSpan={9} className={styles.empty}>
                {error}<br/><button className={styles.retryBtn} onClick={() => setPage(1)}>Retry</button>
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={styles.row} onClick={() => navigate(`/admin/users/${u.id}`)}>
                <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{u.reference_id ?? '—'}</td>
                <td className={styles.userName}>{u.name || '—'}</td>
                <td className={styles.phone}>{u.phone}</td>
                <td className={styles.email}>{u.email || '—'}</td>
                <td>{u.city || '—'}</td>
                <td className={styles.orders}>{u.orders}</td>
                <td className={styles.credits}>₹{u.credits?.toLocaleString('en-IN')}</td>
                <td className={styles.date}>{u.joined}</td>
                <td>
                  <span className={`${styles.statusPill} ${u.status === 'Active' ? styles.statusActive : styles.statusDeactivated}`}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} user${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>

      {/* Add Customer modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add Customer Account</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>Creates a customer account directly. Share the generated password with the customer via phone/WhatsApp.</p>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Phone * (10-digit Indian mobile)</label>
                <input className={styles.fieldInput} placeholder="e.g., 9876543210" maxLength={10}
                  value={newPhone} onChange={e => { setNewPhone(e.target.value.replace(/\D/g, '')); setPhoneError(''); }} />
                {phoneError && <span style={{ color: 'var(--color-error, #ef4444)', fontSize: 12, marginTop: 4, display: 'block' }}>{phoneError}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Full Name (optional)</label>
                <input className={styles.fieldInput} placeholder="Customer's full name"
                  value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email (optional)</label>
                <input className={styles.fieldInput} type="email" placeholder="customer@example.com"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>City</label>
                <input className={styles.fieldInput} placeholder="City"
                  value={newCity} onChange={e => setNewCity(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  <input type="checkbox" checked={genPassword} onChange={e => setGenPassword(e.target.checked)} style={{ width: 16, height: 16 }} />
                  Generate temporary password (shown once, share manually)
                </label>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.addBtn} disabled={creating} onClick={handleCreateUser}
                style={{ height: 40, padding: '0 20px', borderRadius: 'var(--radius-md)', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating…' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp password reveal modal — shown once after creation */}
      {tempPassword && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Customer Account Created</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Share this temporary password with the customer via phone or WhatsApp. <strong>This is shown only once and cannot be retrieved again.</strong> The customer will be asked to change it on first login.
            </p>
            <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
              <code style={{ fontSize: 18, letterSpacing: 2, fontFamily: 'monospace', color: 'var(--color-text-primary)', fontWeight: 700 }}>{tempPassword}</code>
              <button onClick={handleCopyPassword} style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? 'var(--color-primary)' : 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: copied ? '#fff' : 'var(--color-text-secondary)', transition: 'all 0.2s' }}>
                {copied ? <><Check size={13}/> Copied</> : <><Copy size={13}/> Copy</>}
              </button>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.addBtn} onClick={() => { setTempPassword(''); setCopied(false); showToast('success', 'Customer created successfully'); }}
                style={{ height: 40, padding: '0 20px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                Done — I've noted the password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
