import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, X, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
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
  const [creating, setCreating] = React.useState(false);

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
    if (!newPhone.trim()) { showToast('error', 'Phone number is required'); return; }
    setCreating(true);
    try {
      const created = await usersApi.create({
        phone: newPhone.trim(),
        name: newName.trim() || undefined,
        email: newEmail.trim() || undefined,
      });
      setUsers(prev => [created, ...prev]);
      setTotal(t => t + 1);
      setShowCreate(false);
      setNewPhone(''); setNewName(''); setNewEmail('');
      showToast('success', 'User created', `${created.name || created.phone} added`);
    } catch (e) {
      showToast('error', 'Failed to create user', e instanceof Error ? e.message : undefined);
    } finally { setCreating(false); }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Users</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.exportBtn} onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-green, var(--green))', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' }}>
            <UserPlus size={14}/> Add User
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
            <th>Name</th><th>Phone</th><th>Email</th><th>City</th>
            <th>Orders</th><th>Credits</th><th>Joined</th><th>Status</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({length: 8}).map((_, i) => (
              <tr key={i}>{Array.from({length: 8}).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : error ? (
              <tr><td colSpan={8} className={styles.empty}>
                {error}<br/><button className={styles.retryBtn} onClick={() => setPage(1)}>Retry</button>
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={styles.row} onClick={() => navigate(`/admin/users/${u.id}`)}>
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

      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add User Account</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Creates an app account. The user can log in with their phone number via OTP.</p>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Phone * (with country code)</label>
                <input className={styles.fieldInput} placeholder="e.g., +919876543210"
                  value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Name (optional)</label>
                <input className={styles.fieldInput} placeholder="Full name"
                  value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email (optional)</label>
                <input className={styles.fieldInput} type="email" placeholder="user@example.com"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.addBtn} disabled={creating} onClick={handleCreateUser}
                style={{ height: 40, padding: '0 20px', borderRadius: 'var(--radius-md)', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
