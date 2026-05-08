import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Ruler } from 'lucide-react';
import { measurementBookingsApi } from '../../api/adminApi';
import type { MeasurementBooking } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './AppConfigPage.module.css';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  confirmed:   { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6' },
  in_progress: { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
  completed:   { bg: 'rgba(28,92,66,0.12)',    color: '#1C5C42' },
  cancelled:   { bg: 'rgba(239,68,68,0.1)',    color: '#EF4444' },
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};

export const MeasurementBookingsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = React.useState<MeasurementBooking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const LIMIT = 20;

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    measurementBookingsApi.list({ status: statusFilter || undefined, page, limit: LIMIT })
      .then(r => { setBookings(r?.bookings ?? []); setTotal(r?.total ?? 0); })
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Measurement Bookings</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/measurement-bookings/new')}>
          <Plus size={15}/> Book Session
        </button>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.card} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading…</div>
      ) : bookings.length === 0 ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Ruler size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>No measurement bookings found.</p>
          <button className={styles.addBtn} style={{ marginTop: 16 }} onClick={() => navigate('/admin/measurement-bookings/new')}>
            + Book First Session
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Booking Ref</th>
                <th>Customer</th>
                <th>Garments</th>
                <th>Scheduled</th>
                <th>Staff</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.confirmed;
                return (
                  <tr key={b.id} className={styles.row} onClick={() => navigate(`/admin/measurement-bookings/${b.id}`)}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.booking_ref}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.customer_name ?? '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{b.customer_phone}</div>
                    </td>
                    <td>{b.item_count ?? b.items?.length ?? '—'}</td>
                    <td>{b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{b.assigned_staff_name ?? <span style={{ color: 'var(--color-text-tertiary)' }}>Unassigned</span>}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMIT && (
        <div className={styles.pagination} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className={styles.clearBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {Math.ceil(total / LIMIT)}</span>
          <button className={styles.clearBtn} disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
};
