import React from 'react';
import { catalogApi } from '../../api/catalogApi';
import type { AdminUser } from '../../api/catalogApi';
import { adminAuthExtApi, hubsApi } from '../../api/adminApi';
import type { Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './AdminUsersManagePage.module.css';
import { UilKeySkeletonAlt, UilRefresh, UilUserPlus } from "@iconscout/react-unicons";

const ROLE_LABELS: Record<string, string> = {
  // The two top roles are named for what they DO, not "who ranks higher":
  //   super_admin = oversight + account governance (reads everything, edits nothing operational)
  //   admin (legacy god-mode) = full operational access, but NOT account management
  super_admin: 'Owner · Oversight & Accounts',
  design: 'Design',
  procurement: 'Procurement',
  catalog_manager: 'Catalog Manager',
  support: 'Support',
  finance: 'Finance',
  pricing_manager: 'Pricing & Promotions',
  // legacy role — kept for displaying existing god-mode accounts (not creatable)
  admin: 'Operations · Full Access',
};

// [SHL-1-12] The roles defined PER HUB — mirrors HUB_SCOPED_ADMIN_ROLES in the
// backend's admin-auth.middleware. For these, a missing hub is not "global", it is
// a broken account: the server now fails closed on every scoped read and write.
const HUB_SCOPED_ROLES = ['catalog_manager'];

// W-18: human-readable capability summary per role (mirrors backend permissions.ts).
// Shown when creating an admin so the grant is understood, not guessed.
const ROLE_CAP_SUMMARY: Record<string, string> = {
  design: 'Designs + fabric match, sample review/verdict, fit analytics (read).',
  procurement: 'Fabrics master, distribution to hubs, restock fulfilment, reports.',
  catalog_manager: 'Listings + pricing + storefront CMS (their hub), restock requests, samples.',
  support: 'Orders (CX: notes/hold/cancel/link-fit/re-measure), customers + credits (≤₹500), returns, reviews.',
  finance: 'Refunds, COD confirmation, invoices, settlement/P&L (read). No floor or catalog writes.',
  pricing_manager: 'Brand-wide promo codes + business analytics (read). Global. Does NOT set listing prices — that is the catalog manager (per hub).',
  super_admin: 'Everything — hubs, staff, config, break-glass overrides, DPDP erasure. Oversight, not daily ops.',
};

export const AdminUsersManagePage: React.FC = () => {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [resetLinks, setResetLinks] = React.useState<Record<string, string>>({});
  const [resetting, setResetting] = React.useState<string | null>(null);

  // Temp password modal
  const [showTempPw, setShowTempPw] = React.useState<AdminUser | null>(null);
  const [tempPw, setTempPw] = React.useState('');
  const [settingTempPw, setSettingTempPw] = React.useState(false);

  // Create admin modal state
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  type AdminRole = 'super_admin' | 'design' | 'procurement' | 'catalog_manager' | 'support' | 'finance' | 'pricing_manager';
  const [newRole, setNewRole] = React.useState<AdminRole>('catalog_manager');
  const [newHubId, setNewHubId] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  // T0-1: approving a self-registered `pending` account requires assigning a real role
  // (the account is created capless). Per-user role/hub selection for the pending cards.
  const [approveRole, setApproveRole] = React.useState<Record<string, AdminRole | ''>>({});
  const [approveHub, setApproveHub] = React.useState<Record<string, string>>({});
  const [approving, setApproving] = React.useState<string | null>(null);

  // Hubs for the hub-scoping selectors
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubSaving, setHubSaving] = React.useState<string | null>(null);
  React.useEffect(() => { hubsApi.list().then(r => setHubs(r.hubs)).catch(() => { /* optional */ }); }, []);

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

  // T0-1: assign the chosen role FIRST, then activate — the account is never
  // active-but-capless, and never silently god-mode.
  const handleApprovePending = async (user: AdminUser) => {
    const role = approveRole[user.id];
    if (!role) {
      showToast('error', 'Choose a role', 'Pick the role this person should have before approving.');
      return;
    }
    const hubScoped = role !== 'super_admin' && role !== 'pricing_manager';
    const hubId = hubScoped ? approveHub[user.id] || null : null;
    setApproving(user.id);
    try {
      await catalogApi.changeAdminRole(user.id, role, hubId);
      const updated = await catalogApi.setAdminActive(user.id, true);
      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, ...updated, role, hub_id: hubId } : u)),
      );
      showToast('success', 'Approved', `${user.email} is now ${ROLE_LABELS[role] ?? role}`);
    } catch (err) {
      showToast('error', 'Failed to approve', err instanceof Error ? err.message : '');
    } finally {
      setApproving(null);
    }
  };

  const handleResetLink = async (user: AdminUser) => {
    setResetting(user.id);
    try {
      const result = await catalogApi.generateResetLink(user.id);
      const link = `${window.location.origin}/admin/reset-password?token=${result.token}`;
      setResetLinks(prev => ({ ...prev, [user.id]: link }));
      showToast('success', 'Reset link generated');
    } catch (err) {
      showToast('error', 'Failed', err instanceof Error ? err.message : '');
    } finally {
      setResetting(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      showToast('error', 'All fields required');
      return;
    }
    if (newPassword.length < 8) {
      showToast('error', 'Password must be at least 8 characters');
      return;
    }
    // [SHL-1-12] A per-hub role MUST arrive with its hub. This form defaults the
    // role to catalog_manager and left the hub select optional, so filling in the
    // three obvious fields and clicking Create used to mint a GLOBALLY-scoped
    // catalog_manager — proven live reading every hub's listings and rewriting
    // another hub's price. The server refuses it now; say so before the round trip.
    if (HUB_SCOPED_ROLES.includes(newRole) && !newHubId) {
      showToast('error', 'Choose a hub', `${ROLE_LABELS[newRole] ?? newRole} manages one hub — pick which.`);
      return;
    }
    setCreating(true);
    try {
      // super_admin + pricing_manager are global (oversight / brand-wide promos);
      // others may be hub-scoped.
      const hubId = newRole === 'super_admin' || newRole === 'pricing_manager' ? null : (newHubId || null);
      const created = await catalogApi.createAdmin({ name: newName.trim(), email: newEmail.trim(), password: newPassword, role: newRole, hubId });
      setUsers(prev => [...prev, created]);
      setShowCreate(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('catalog_manager'); setNewHubId('');
      showToast('success', 'Admin created', created.email);
    } catch (err) {
      showToast('error', 'Failed to create', err instanceof Error ? err.message : '');
    } finally { setCreating(false); }
  };

  const handleSetTempPw = async () => {
    if (!showTempPw) return;
    if (!tempPw || tempPw.length < 8) { showToast('error', 'Password must be at least 8 characters'); return; }
    setSettingTempPw(true);
    try {
      await adminAuthExtApi.setTempPassword(showTempPw.id, tempPw);
      showToast('success', 'Temp password set', `${showTempPw.email} must change password on next login`);
      setShowTempPw(null); setTempPw('');
    } catch (err) {
      showToast('error', 'Failed', err instanceof Error ? err.message : '');
    } finally { setSettingTempPw(false); }
  };

  const handleSetHub = async (user: AdminUser, hubId: string) => {
    setHubSaving(user.id);
    try {
      const updated = await catalogApi.setAdminHub(user.id, hubId || null);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, hub_id: updated.hub_id ?? null, hub_name: hubs.find(h => h.id === updated.hub_id)?.name ?? null } : u));
      showToast('success', hubId ? 'Hub assigned — admin is now hub-scoped' : 'Hub cleared — admin is global');
    } catch (err) {
      showToast('error', 'Failed', err instanceof Error ? err.message : '');
    } finally { setHubSaving(null); }
  };

  const pending = users.filter(u => !u.is_active);
  const active = users.filter(u => u.is_active);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Admin Users</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            <UilUserPlus size={14}/> Create Admin
          </button>
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            <UilRefresh size={14}/> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
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
                {user.role === 'pending' ? (
                  // Self-registered, capless: super must assign a real role before activating.
                  <div className={styles.cardActions}>
                    <select
                      className={styles.fieldInput}
                      value={approveRole[user.id] ?? ''}
                      onChange={e =>
                        setApproveRole(r => ({ ...r, [user.id]: e.target.value as AdminRole | '' }))
                      }
                      aria-label="Assign role"
                    >
                      <option value="">Choose role…</option>
                      <option value="design">Design (central)</option>
                      <option value="procurement">Procurement (central)</option>
                      <option value="catalog_manager">Catalog Manager (per-hub)</option>
                      <option value="pricing_manager">Pricing &amp; Promotions (central)</option>
                      <option value="support">Support</option>
                      <option value="finance">Finance</option>
                      <option value="super_admin">{ROLE_LABELS.super_admin}</option>
                    </select>
                    {(() => {
                      const role = approveRole[user.id];
                      const hubScoped = role && role !== 'super_admin' && role !== 'pricing_manager';
                      // [SHL-1-12] For a PER-HUB role there is no "Global (no hub)"
                      // — that option promised oversight and delivered a globally
                      // scoped catalog_manager. Only roles that may genuinely be
                      // unscoped still offer it.
                      const mustHaveHub = HUB_SCOPED_ROLES.includes(role ?? '');
                      return hubScoped ? (
                        <select
                          className={styles.fieldInput}
                          value={approveHub[user.id] ?? ''}
                          onChange={e => setApproveHub(h => ({ ...h, [user.id]: e.target.value }))}
                          aria-label="Assign hub"
                        >
                          <option value="">
                            {mustHaveHub ? 'Choose a hub…' : 'Global (no hub)'}
                          </option>
                          {hubs.map(h => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      ) : null;
                    })()}
                    <button
                      className={styles.activateBtn}
                      disabled={
                        !approveRole[user.id] ||
                        approving === user.id ||
                        (HUB_SCOPED_ROLES.includes(approveRole[user.id] ?? '') && !approveHub[user.id])
                      }
                      onClick={() => handleApprovePending(user)}
                    >
                      {approving === user.id ? 'Approving…' : 'Approve & activate'}
                    </button>
                  </div>
                ) : (
                  // Deactivated account that already has a real role — just reactivate.
                  <div className={styles.cardActions}>
                    <button className={styles.activateBtn} onClick={() => handleToggleActive(user)}>
                      Reactivate
                    </button>
                  </div>
                )}
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
                <th>Hub Scope</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j}><div className={styles.skeleton} /></td>
                    ))}
                  </tr>
                ))
              ) : active.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>No active admins.</td></tr>
              ) : (
                active.map(user => (
                  <tr key={user.id}>
                    <td className={styles.userName}>{user.name}</td>
                    <td className={styles.userEmail}>{user.email}</td>
                    <td>
                      <span className={`${styles.rolePill} ${user.role === 'super_admin' ? styles.roleSuperAdmin : styles.roleAdmin}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td>
                      {user.role === 'super_admin' ? (
                        <span className={styles.meta}>All hubs</span>
                      ) : (
                        <select
                          className={styles.fieldInput}
                          style={{ height: 32, padding: '0 8px', minWidth: 130 }}
                          value={user.hub_id ?? ''}
                          disabled={hubSaving === user.id}
                          onChange={e => handleSetHub(user, e.target.value)}
                        >
                          <option value="">All hubs (global)</option>
                          {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                      )}
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
                        <button
                          className={styles.resetBtn}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => { setShowTempPw(user); setTempPw(''); }}
                          title="Set temporary password"
                        >
                          <UilKeySkeletonAlt size={13}/> Temp Pw
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

      {/* Temp Password Modal */}
      {showTempPw && (
        <div className={styles.modalOverlay} onClick={() => setShowTempPw(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Set Temporary Password</h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Setting a temp password for <strong>{showTempPw.email}</strong>. They will be required to change it on next login.
            </p>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Temporary Password * (min 8 chars)</label>
                <input className={styles.fieldInput} type="text" placeholder="Visible password"
                  value={tempPw} onChange={e => setTempPw(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowTempPw(null)}>Cancel</button>
              <button className={styles.activateBtn} disabled={settingTempPw} onClick={handleSetTempPw}>
                {settingTempPw ? 'Setting…' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create Admin Account</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Name *</label>
                <input className={styles.fieldInput} placeholder="Full name"
                  value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email *</label>
                <input className={styles.fieldInput} type="email" placeholder="admin@zavestro.in"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Password * (min 8 chars)</label>
                <input className={styles.fieldInput} type="password" placeholder="Temporary password"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Role</label>
                <select className={styles.fieldInput} value={newRole} onChange={e => setNewRole(e.target.value as AdminRole)}>
                  <option value="design">Design (central)</option>
                  <option value="procurement">Procurement (central)</option>
                  <option value="catalog_manager">Catalog Manager (per-hub)</option>
                  <option value="pricing_manager">Pricing &amp; Promotions (central)</option>
                  <option value="support">Support</option>
                  <option value="finance">Finance</option>
                  <option value="super_admin">{ROLE_LABELS.super_admin}</option>
                </select>
                {/* W-18: what this role can actually do (mirrors permissions.ts) */}
                <p className={styles.roleCaps}>{ROLE_CAP_SUMMARY[newRole]}</p>
              </div>
              {newRole !== 'super_admin' && newRole !== 'pricing_manager' && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    Hub Scope{HUB_SCOPED_ROLES.includes(newRole) ? ' *' : ''}
                  </label>
                  {/* [SHL-1-12] "All hubs (global)" is not on offer for a per-hub
                      role: choosing it used to create exactly the account this
                      role exists to prevent — a catalog_manager over every hub. */}
                  <select className={styles.fieldInput} value={newHubId} onChange={e => setNewHubId(e.target.value)}>
                    <option value="">
                      {HUB_SCOPED_ROLES.includes(newRole) ? 'Choose a hub…' : 'All hubs (global)'}
                    </option>
                    {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    Assign a hub to restrict this admin to that hub's orders, returns, invoices, staff & dashboard.
                  </span>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.activateBtn} disabled={creating} onClick={handleCreate}>
                {creating ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
