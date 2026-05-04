import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronLeft, ChevronRight, AlertCircle, Clock, UserMinus, Inbox, Plus } from 'lucide-react';
import { supportApi } from '../../api/adminApi';
import type { SupportTicket } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './SupportListPage.module.css';

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

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true); setError('');
    supportApi.list({ search: debouncedSearch || undefined, status: statusFilter || undefined, priority: priorityFilter || undefined, page, limit: LIMIT })
      .then(r => { setTickets(r.tickets); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, priorityFilter, page]);

  const open = tickets.filter(t => t.status === 'Open').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const unassigned = tickets.filter(t => !t.assignedTo).length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Support Tickets</h1>
        <button className={styles.addBtn ?? styles.exportBtn} onClick={() => showToast('info', 'Create Ticket', 'Admin-created tickets are coming soon. Tickets are currently opened by customers via the app.')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--green)', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' }}>
          <Plus size={14}/> Create Ticket
        </button>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconNeutral}`}><Inbox size={16}/></div>
          <div className={styles.kpiVal}>{total}</div>
          <div className={styles.kpiLabel}>Total</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconRed}`}><AlertCircle size={16}/></div>
          <div className={`${styles.kpiVal} ${styles.kpiRed}`}>{open}</div>
          <div className={styles.kpiLabel}>Open</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconYellow}`}><Clock size={16}/></div>
          <div className={`${styles.kpiVal} ${styles.kpiYellow}`}>{inProgress}</div>
          <div className={styles.kpiLabel}>In Progress</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconOrange}`}><UserMinus size={16}/></div>
          <div className={`${styles.kpiVal} ${styles.kpiOrange}`}>{unassigned}</div>
          <div className={styles.kpiLabel}>Unassigned</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
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
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setPage(1); }}><X size={14} /> Clear</button>
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
                <td className={styles.ticketId}>{t.id}</td>
                <td>
                  <div className={styles.customerName}>{t.customer}</div>
                  <div className={styles.customerPhone}>{t.phone}</div>
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
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};
