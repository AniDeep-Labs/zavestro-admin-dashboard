import React from 'react';
import { RefreshCw } from 'lucide-react';
import { catalogApi } from '../../api/catalogApi';
import type { AdminUser } from '../../api/catalogApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './AdminUsersManagePage.module.css';

export const AdminUsersManagePage: React.FC = () => {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [resetLinks, setResetLinks] = React.useState<Record<string, string>>({});
  const [resetting, setResetting] = React.useState<string | null>(null);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  const load = React.useCallback(() => {
    setLoading(true);
    catalogApi.listAdminUsers()
      .then(setUsers)
      .catch(err => showToast('error', 'Failed to load', err instanceof Error ? err.message : ''))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (user: AdminUser) => {
    try {
      const updated = await catalogApi.setAdminActive(user.id, !user.is_active);
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
      showToast('success', user.is_active ? 'Account deactivated' : 'Account activated');
    } catch (err) {
      showToast('error', 'Failed', err instanceof Error ? err.message : '');
    }
  };

  const handleResetLink = async (user: AdminUser) => {
    setResetting(user.id);
    try {
      const result = await catalogApi.forgotPassword(user.email);
      if (result.token) {
        const link = `${window.location.origin}/admin/reset-password?token=${result.token}`;
        setResetLinks(prev => ({ ...prev, [user.id]: link }));
        showToast('success', 'Reset link generated');
      }
    } catch (err) {
      showToast('error', 'Failed', err instanceof Error ? err.message : '');
    } finally {
      setResetting(null);
    }
  };

  const pending = users.filter(u => !u.is_active);
  const active = users.filter(u => u.is_active);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Admin Users</h1>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          <RefreshCw size={14}/> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {pending.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Pending Activation
            <span className={styles.badge}>{pending.length}</span>
          </h2>
          <div className={styles.cards}>
            {pending.map(user => (
              <div key={user.id} className={`${styles.card} ${styles.cardPending}`}>
                <div className={styles.cardInfo}>
                  <div className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className={styles.userName}>{user.name}</div>
                    <div className={styles.userEmail}>{user.email}</div>
                    <div className={styles.userMeta}>
                      Registered {new Date(user.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    className={styles.activateBtn}
                    onClick={() => handleToggleActive(user)}
                  >
                    Activate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active Admins</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j}><div className={styles.skeleton} /></td>
                    ))}
                  </tr>
                ))
              ) : active.length === 0 ? (
                <tr><td colSpan={5} className={styles.empty}>No active admins.</td></tr>
              ) : (
                active.map(user => (
                  <tr key={user.id}>
                    <td className={styles.userName}>{user.name}</td>
                    <td className={styles.userEmail}>{user.email}</td>
                    <td>
                      <span className={`${styles.rolePill} ${user.role === 'super_admin' ? styles.roleSuperAdmin : styles.roleAdmin}`}>
                        {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className={styles.meta}>
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString('en-IN')
                        : 'Never'}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.resetBtn}
                          onClick={() => handleResetLink(user)}
                          disabled={resetting === user.id}
                        >
                          {resetting === user.id ? '…' : 'Reset Link'}
                        </button>
                        {user.role !== 'super_admin' && (
                          <button
                            className={styles.deactivateBtn}
                            onClick={() => handleToggleActive(user)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                      {resetLinks[user.id] && (
                        <div className={styles.resetLink}>
                          <input
                            readOnly
                            value={resetLinks[user.id]}
                            className={styles.resetLinkInput}
                            onClick={e => (e.target as HTMLInputElement).select()}
                          />
                          <button
                            className={styles.copyBtn}
                            onClick={() => {
                              navigator.clipboard.writeText(resetLinks[user.id]);
                              showToast('success', 'Copied to clipboard');
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
