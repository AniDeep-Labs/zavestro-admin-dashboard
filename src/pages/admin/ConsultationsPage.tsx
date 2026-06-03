import React from 'react';
import { RefreshCw, Plus, Trash2, CalendarClock } from 'lucide-react';
import { consultationsApi } from '../../api/adminApi';
import type { Consultation, ConsultationSlot } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const STATUSES = ['requested', 'scheduled', 'completed', 'cancelled', 'no_show'];
const STATUS_CSS: Record<string, string> = {
  requested: 'stageWarning', scheduled: 'stageBlue', completed: 'stageSuccess',
  cancelled: 'stageError', no_show: 'stageNeutral',
};
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const ConsultationsPage: React.FC = () => {
  const [tab, setTab] = React.useState<'bookings' | 'slots'>('bookings');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Consultations</h1>
      </div>
      <div className={styles.filterBar}>
        <button className={tab === 'bookings' ? styles.createBtn : styles.clearBtn} onClick={() => setTab('bookings')}>Bookings</button>
        <button className={tab === 'slots' ? styles.createBtn : styles.clearBtn} onClick={() => setTab('slots')}><CalendarClock size={14} /> Slots</button>
      </div>
      {tab === 'bookings' ? <BookingsTab showToast={showToast} /> : <SlotsTab showToast={showToast} />}
    </div>
  );
};

const BookingsTab: React.FC<{ showToast: (t: ToastData['type'], a: string, b?: string) => void }> = ({ showToast }) => {
  const [items, setItems] = React.useState<Consultation[]>([]);
  const [status, setStatus] = React.useState('All');
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    consultationsApi.list(status)
      .then(setItems)
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  React.useEffect(load, [load]);

  const changeStatus = async (c: Consultation, next: string) => {
    setBusyId(c.id);
    try {
      await consultationsApi.update(c.id, { status: next });
      setItems(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x));
      showToast('success', 'Updated', `Consultation marked ${next.replace('_', ' ')}`);
    } catch (e) {
      showToast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally { setBusyId(null); }
  };

  return (
    <>
      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <button className={styles.clearBtn} onClick={load} title="Refresh"><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Customer</th><th>Phone</th><th>Scheduled</th><th>Status</th><th>Notes</th><th>Set Status</th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No consultations found.</td></tr>
            ) : items.map(c => (
              <tr key={c.id} className={styles.row}>
                <td><div className={styles.customerName}>{c.customer_name}</div></td>
                <td className={styles.customerPhone}>{c.customer_phone}</td>
                <td className={styles.date}>{fmtDateTime(c.scheduled_at)}</td>
                <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[c.status] ?? 'stageNeutral']}`}>{c.status.replace('_', ' ')}</span></td>
                <td><div className={styles.customerName} style={{ maxWidth: 220, whiteSpace: 'normal' }}>{c.notes ?? '—'}</div></td>
                <td onClick={e => e.stopPropagation()}>
                  <select className={styles.filterSelect} disabled={busyId === c.id} value={c.status}
                    onChange={e => changeStatus(c, e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const SlotsTab: React.FC<{ showToast: (t: ToastData['type'], a: string, b?: string) => void }> = ({ showToast }) => {
  const [slots, setSlots] = React.useState<ConsultationSlot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ slot_date: '', time_start: '', time_end: '', mode: 'in_person', capacity: 1 });

  const load = React.useCallback(() => {
    setLoading(true);
    consultationsApi.listSlots()
      .then(setSlots)
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [showToast]);
  React.useEffect(load, [load]);

  const create = async () => {
    if (!form.slot_date || !form.time_start || !form.time_end) { showToast('warning', 'Missing fields', 'Date and times are required'); return; }
    setBusyId('new');
    try {
      const slot = await consultationsApi.createSlot({ ...form, capacity: Number(form.capacity) });
      setSlots(prev => [...prev, slot].sort((a, b) => (a.slot_date + a.time_start).localeCompare(b.slot_date + b.time_start)));
      setCreating(false);
      setForm({ slot_date: '', time_start: '', time_end: '', mode: 'in_person', capacity: 1 });
      showToast('success', 'Slot created', `${fmtDate(slot.slot_date)} ${slot.time_start}`);
    } catch (e) {
      showToast('error', 'Create failed', e instanceof Error ? e.message : undefined);
    } finally { setBusyId(null); }
  };

  const remove = async (s: ConsultationSlot) => {
    if (s.booked_count > 0) { showToast('warning', 'Cannot delete', 'This slot already has bookings'); return; }
    setBusyId(s.id);
    try {
      await consultationsApi.deleteSlot(s.id);
      setSlots(prev => prev.filter(x => x.id !== s.id));
      showToast('success', 'Slot removed');
    } catch (e) {
      showToast('error', 'Delete failed', e instanceof Error ? e.message : undefined);
    } finally { setBusyId(null); }
  };

  return (
    <>
      <div className={styles.filterBar}>
        <button className={styles.createBtn} onClick={() => setCreating(true)}><Plus size={14} /> New Slot</button>
        <button className={styles.clearBtn} onClick={load} title="Refresh"><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Date</th><th>Time</th><th>Mode</th><th>Capacity</th><th>Booked</th><th></th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            )) : slots.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No slots. Create one so customers can book a consultation.</td></tr>
            ) : slots.map(s => (
              <tr key={s.id} className={styles.row}>
                <td className={styles.date}>{fmtDate(s.slot_date)}</td>
                <td>{s.time_start.slice(0, 5)}–{s.time_end.slice(0, 5)}</td>
                <td><span className={`${styles.stagePill} ${s.mode === 'video' ? styles.stageBlue : styles.stageNeutral}`}>{s.mode === 'video' ? 'Video' : 'In person'}</span></td>
                <td>{s.capacity}</td>
                <td className={styles.total}>{s.booked_count}</td>
                <td onClick={e => e.stopPropagation()}>
                  <button className={styles.actionBtn} disabled={busyId === s.id || s.booked_count > 0} onClick={() => remove(s)} title={s.booked_count > 0 ? 'Has bookings' : 'Delete'}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <div className={styles.modalOverlay} onClick={() => busyId !== 'new' && setCreating(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>New Consultation Slot</div>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Date *</label>
                <input className={styles.fieldInput} type="date" value={form.slot_date} onChange={e => setForm(f => ({ ...f, slot_date: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Start *</label>
                <input className={styles.fieldInput} type="time" value={form.time_start} onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>End *</label>
                <input className={styles.fieldInput} type="time" value={form.time_end} onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mode</label>
                <select className={styles.fieldInput} value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                  <option value="in_person">In person</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Capacity</label>
                <input className={styles.fieldInput} type="number" min={1} max={50} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} disabled={busyId === 'new'} onClick={() => setCreating(false)}>Cancel</button>
              <button className={styles.createBtn} disabled={busyId === 'new'} onClick={create}>{busyId === 'new' ? 'Creating…' : 'Create Slot'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConsultationsPage;
