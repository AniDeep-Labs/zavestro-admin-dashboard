import React from 'react';
import { Plus, X } from 'lucide-react';
import { consultationSlotsApi, hubsApi } from '../../api/adminApi';
import type { ConsultationSlot, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ConsultationSlotsPage.module.css';

function getNext7Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function fmtDayHeader(dateStr: string): { dow: string; date: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    dow: d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(),
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
}

function slotStatus(s: ConsultationSlot): 'available' | 'partial' | 'full' {
  if (s.booked_count >= s.capacity) return 'full';
  if (s.booked_count > 0) return 'partial';
  return 'available';
}

const MODE_LABELS: Record<string, string> = { in_person: 'In-person', video: 'Video' };

interface NewSlotForm {
  slot_date: string;
  time_start: string;
  time_end: string;
  mode: 'in_person' | 'video';
  capacity: string;
  hub_id: string;
}

const EMPTY_FORM: NewSlotForm = {
  slot_date: '',
  time_start: '',
  time_end: '',
  mode: 'in_person',
  capacity: '1',
  hub_id: '',
};

export const ConsultationSlotsPage: React.FC = () => {
  const [slots, setSlots] = React.useState<ConsultationSlot[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubFilter, setHubFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<NewSlotForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<ConsultationSlot | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const days = React.useMemo(() => getNext7Days(), []);

  const load = React.useCallback(() => {
    setLoading(true);
    consultationSlotsApi.list({ hub_id: hubFilter || undefined })
      .then(r => setSlots(r.slots))
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    hubsApi.list().then(r => setHubs(r.hubs)).catch(() => {});
  }, []);

  const slotsByDay = React.useMemo(() => {
    const map: Record<string, ConsultationSlot[]> = {};
    for (const day of days) map[day] = [];
    for (const s of slots) {
      if (map[s.slot_date]) map[s.slot_date].push(s);
    }
    return map;
  }, [slots, days]);

  const handleCreate = async () => {
    if (!form.slot_date || !form.time_start || !form.time_end) {
      showToast('error', 'Date, start time, and end time are required');
      return;
    }
    if (form.time_end <= form.time_start) {
      showToast('error', 'End time must be after start time');
      return;
    }
    setSaving(true);
    try {
      const created = await consultationSlotsApi.create({
        slot_date: form.slot_date,
        time_start: form.time_start,
        time_end: form.time_end,
        mode: form.mode,
        capacity: form.capacity ? parseInt(form.capacity, 10) : 1,
        hub_id: form.hub_id || undefined,
      });
      setSlots(prev => [...prev, created]);
      showToast('success', 'Slot created');
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      showToast('error', 'Create failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await consultationSlotsApi.delete(id);
      setSlots(prev => prev.filter(s => s.id !== id));
      showToast('success', 'Slot deleted');
      setSelectedSlot(null);
    } catch (e) {
      showToast('error', 'Delete failed', e instanceof Error ? e.message : undefined);
    } finally {
      setDeleting(null);
    }
  };

  const hubName = (id: string | null) => hubs.find(h => h.id === id)?.name ?? '—';

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Consultation Slots</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {hubs.length > 0 && (
            <select
              style={{ padding: '7px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg-card)', color: 'var(--color-text)', fontSize: '0.875rem' }}
              value={hubFilter}
              onChange={e => setHubFilter(e.target.value)}
            >
              <option value="">All Hubs</option>
              {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button className={styles.addBtn} onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add Slot
          </button>
        </div>
      </div>

      <div className={styles.legend}>
        <span><span className={`${styles.legendDot} ${styles.dotAvailable}`} />Available</span>
        <span><span className={`${styles.legendDot} ${styles.dotPartial}`} />Partially booked</span>
        <span><span className={`${styles.legendDot} ${styles.dotFull}`} />Fully booked</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {days.map(d => (
            <div key={d} className={styles.dayCol}>
              <div className={styles.dayHeader}>
                <span className={`${styles.skeleton}`} style={{ height: 12, width: 30, display: 'block', marginBottom: 4 }} />
                <span className={`${styles.skeleton}`} style={{ height: 14, width: 50, display: 'block' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.calendarGrid}>
          {days.map(day => {
            const { dow, date } = fmtDayHeader(day);
            const daySlots = slotsByDay[day] ?? [];
            return (
              <div key={day} className={styles.dayCol}>
                <div className={styles.dayHeader}>
                  <span className={styles.dayOfWeek}>{dow}</span>
                  <span className={styles.dayDate}>{date}</span>
                </div>
                <div className={styles.slotList}>
                  {daySlots.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No slots</span>
                  ) : daySlots.map(s => {
                    const st = slotStatus(s);
                    return (
                      <button
                        key={s.id}
                        className={`${styles.slot} ${st === 'available' ? styles.slotAvailable : st === 'partial' ? styles.slotPartial : styles.slotFull}`}
                        onClick={() => setSelectedSlot(s)}
                      >
                        <span className={styles.slotTime}>{s.time_start.slice(0, 5)}–{s.time_end.slice(0, 5)}</span>
                        <span className={styles.slotMeta}>{MODE_LABELS[s.mode]} · {s.booked_count}/{s.capacity}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slot Detail Modal */}
      {selectedSlot && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setSelectedSlot(null)}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Slot Details</h2>
            <div className={styles.detailRows}>
              <div className={styles.detailRow}><span>Date</span><span>{selectedSlot.slot_date}</span></div>
              <div className={styles.detailRow}><span>Time</span><span>{selectedSlot.time_start.slice(0, 5)}–{selectedSlot.time_end.slice(0, 5)}</span></div>
              <div className={styles.detailRow}><span>Mode</span><span>{MODE_LABELS[selectedSlot.mode]}</span></div>
              <div className={styles.detailRow}><span>Hub</span><span>{hubName(selectedSlot.hub_id)}</span></div>
              <div className={styles.detailRow}>
                <span>Status</span>
                <span className={`${styles.slotStatusPill} ${slotStatus(selectedSlot) === 'available' ? styles.pillAvailable : slotStatus(selectedSlot) === 'partial' ? styles.pillPartial : styles.pillFull}`}>
                  {slotStatus(selectedSlot) === 'available' ? 'Available' : slotStatus(selectedSlot) === 'partial' ? 'Partially booked' : 'Fully booked'}
                </span>
              </div>
              <div className={styles.detailRow}><span>Bookings</span><span>{selectedSlot.booked_count} / {selectedSlot.capacity}</span></div>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.deleteSlotBtn}
                onClick={() => handleDelete(selectedSlot.id)}
                disabled={deleting === selectedSlot.id || selectedSlot.booked_count > 0}
                title={selectedSlot.booked_count > 0 ? 'Cannot delete a booked slot' : undefined}
              >
                {deleting === selectedSlot.id ? 'Deleting…' : 'Delete Slot'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setSelectedSlot(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Slot Modal */}
      {showForm && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className={styles.modal}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className={styles.modalTitle} style={{ margin: 0 }}>New Consultation Slot</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }} onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Date *</label>
                <input
                  className={styles.input}
                  type="date"
                  value={form.slot_date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setForm(f => ({ ...f, slot_date: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Start Time *</label>
                  <input className={styles.input} type="time" value={form.time_start} onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))} />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>End Time *</label>
                  <input className={styles.input} type="time" value={form.time_end} onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Mode</label>
                <select className={styles.input} value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as 'in_person' | 'video' }))}>
                  <option value="in_person">In-person</option>
                  <option value="video">Video Call</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Capacity</label>
                <input className={styles.input} type="number" min={1} max={50} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                <span className={styles.fieldHint}>Max bookings for this slot</span>
              </div>
              {hubs.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label}>Hub (optional)</label>
                  <select className={styles.input} value={form.hub_id} onChange={e => setForm(f => ({ ...f, hub_id: e.target.value }))}>
                    <option value="">No specific hub</option>
                    {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={styles.createBtn} onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
