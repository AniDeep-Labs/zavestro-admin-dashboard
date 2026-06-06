import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supportApi, usersApi } from '../../api/adminApi';
import type { SupportTicket, AdminUser } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './SupportListPage.module.css';
import { UilAngleLeft, UilAngleRight, UilClock, UilExclamationCircle, UilInbox, UilPlus, UilSearch, UilTimes, UilUserMinus } from "@iconscout/react-unicons";

const LIMIT = 25;

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

const priorityCss: Record<string, string> = { High: 'priorityHigh', Medium: 'priorityMedium', Low: 'priorityLow' };
const statusCss: Record<string, string> = { Open: 'statusOpen', 'In Progress': 'statusProgress', Resolved: 'statusResolved', Closed: 'statusClosed' };

export const SupportListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ customerName: '', customerPhone: '', subject: '', category: 'General', priority: 'Medium', message: '' });

  // Customer search in create modal
  const [customerSearch, setCustomerSearch] = React.useState('');
  const [customerResults, setCustomerResults] = React.useState<AdminUser[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<AdminUser | null>(null);
  const debouncedCustomerSearch = useDebounce(customerSearch, 350);

  const setF = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (debouncedCustomerSearch.length < 2) { setCustomerResults([]); return; }
    usersApi.list({ search: debouncedCustomerSearch, limit: 6 }).then(r => setCustomerResults(r.users)).catch(() => {});
  }, [debouncedCustomerSearch]);

  React.useEffect(() => {
    setLoading(true); setError('');
    supportApi.list({ search: debouncedSearch || undefined, status: statusFilter || undefined, priority: priorityFilter || undefined, page, limit: LIMIT })
      .then(r => { setTickets(r.tickets); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, priorityFilter, page]);

  const handleCreate = async () => {
    if (!form.customerName || !form.subject || !form.message) {
      showToast('error', 'Required fields missing', 'Please fill in customer name, subject, and initial message.');
      return;
    }
    setCreating(true);
    try {
      const newTicket = await supportApi.create({
        customer_name: form.customerName,
        customer_phone: form.customerPhone,
        subject: form.subject,
        category: form.category,
        priority: form.priority,
        messages: [{ sender: 'admin', body: form.message, timestamp: new Date().toISOString() }]
      });
      setTickets(prev => [newTicket, ...prev]);
      setShowCreate(false);
      setForm({ customerName: '', customerPhone: '', subject: '', category: 'General', priority: 'Medium', message: '' });
      setSelectedCustomer(null); setCustomerSearch('');
      showToast('success', 'Ticket created', `Ticket #${newTicket.id} created successfully.`);
    } catch (e) {
      showToast('error', 'Failed to create ticket', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const open = tickets.filter(t => t.status === 'Open').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const unassigned = tickets.filter(t => !t.assignedTo).length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Support Tickets</h1>
        <button className={styles.addBtn ?? styles.exportBtn} onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--green)', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' }}>
          <UilPlus size={14}/> Create Ticket
        </button>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconNeutral}`}><UilInbox size={16}/></div>
          <div className={styles.kpiVal}>{total}</div>
          <div className={styles.kpiLabel}>Total</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconRed}`}><UilExclamationCircle size={16}/></div>
          <div className={`${styles.kpiVal} ${styles.kpiRed}`}>{open}</div>
          <div className={styles.kpiLabel}>Open</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconYellow}`}><UilClock size={16}/></div>
          <div className={`${styles.kpiVal} ${styles.kpiYellow}`}>{inProgress}</div>
          <div className={styles.kpiLabel}>In Progress</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconOrange}`}><UilUserMinus size={16}/></div>
          <div className={`${styles.kpiVal} ${styles.kpiOrange}`}>{unassigned}</div>
          <div className={styles.kpiLabel}>Unassigned</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search ticket ID or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option>
        </select>
        <select className={styles.filterSelect} value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}>
          <option value="">All Priority</option>
          <option>High</option><option>Medium</option><option>Low</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setPage(1); }}><UilTimes size={14} /> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Ticket ID</th><th>Customer</th><th>Subject</th><th>Category</th>
            <th>Priority</th><th>Status</th><th>Assigned To</th><th>Last Activity</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({length: 8}).map((_, i) => (
              <tr key={i}>{Array.from({length: 8}).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : error ? (
              <tr><td colSpan={8} className={styles.empty}>
                {error}<br/><button className={styles.retryBtn} onClick={() => setPage(1)}>Retry</button>
              </td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No tickets found.</td></tr>
            ) : tickets.map(t => (
              <tr key={t.id} className={`${styles.row} ${!t.assignedTo ? styles.rowUnassigned : ''}`}
                onClick={() => navigate(`/admin/support/${t.id}`)}>
                <td className={styles.ticketId}>
                  {t.reference_id ? (
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.reference_id}</span>
                  ) : (
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.id.slice(0, 8)}</span>
                  )}
                </td>
                <td>
                  <div className={styles.customerName}>{t.customer}</div>
                  <div className={styles.customerPhone} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {t.customer_ref && <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.customer_ref}</span>}
                    {t.customer_ref && <span>·</span>}
                    {t.phone}
                  </div>
                </td>
                <td className={styles.subject}>{t.subject}</td>
                <td>{t.category}</td>
                <td><span className={`${styles.priorityPill} ${styles[priorityCss[t.priority]]}`}>{t.priority}</span></td>
                <td><span className={`${styles.statusPill} ${styles[statusCss[t.status]]}`}>{t.status}</span></td>
                <td className={t.assignedTo ? '' : styles.unassigned}>{t.assignedTo ?? '— Unassigned'}</td>
                <td className={styles.date}>{t.lastActivity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} ticket${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><UilAngleLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next <UilAngleRight size={15}/></button>
        </div>
      </div>

      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Create Support Ticket</h2>
            <div className={styles.fields}>
              {/* Customer: search existing or enter manually */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Customer</label>
                {selectedCustomer ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1.5px solid var(--color-primary)', borderRadius: 8, background: 'var(--color-bg-primary)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{selectedCustomer.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{selectedCustomer.phone}</div>
                    </div>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }} onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setF('customerName', ''); setF('customerPhone', ''); }}>Change</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <input className={styles.fieldInput} placeholder="Search by name/phone…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                      {customerResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
                          {customerResults.map(u => (
                            <button key={u.id} onClick={() => { setSelectedCustomer(u); setF('customerName', u.name); setF('customerPhone', u.phone); setCustomerSearch(''); setCustomerResults([]); }}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 2 }}>
                              <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{u.name}</span>
                              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{u.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input className={styles.fieldInput} value={form.customerName} onChange={e => setF('customerName', e.target.value)} placeholder="Or enter name manually *" />
                    <input className={styles.fieldInput} value={form.customerPhone} onChange={e => setF('customerPhone', e.target.value)} placeholder="Phone (optional)" style={{ gridColumn: '1 / -1' }} />
                  </div>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Subject *</label>
                <input className={styles.fieldInput} value={form.subject} onChange={e => setF('subject', e.target.value)} placeholder="Issue summary" />
              </div>
              <div className={styles.fieldRow} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Category</label>
                  <select className={styles.fieldSelect} value={form.category} onChange={e => setF('category', e.target.value)}>
                    <option>General</option>
                    <option>Order Issue</option>
                    <option>Return/Refund</option>
                    <option>Technical Support</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Priority</label>
                  <select className={styles.fieldSelect} value={form.priority} onChange={e => setF('priority', e.target.value)}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Initial Message *</label>
                <textarea className={styles.fieldTextarea} rows={4} value={form.message} onChange={e => setF('message', e.target.value)} placeholder="Describe the issue..."></textarea>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.addBtn} onClick={handleCreate} disabled={creating} style={{ opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
