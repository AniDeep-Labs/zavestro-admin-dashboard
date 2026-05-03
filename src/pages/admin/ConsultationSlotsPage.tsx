import React from 'react';
import { Plus } from 'lucide-react';
import { consultationSlotsApi } from '../../api/adminApi';
import type { ConsultationSlot } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ConsultationSlotsPage.module.css';

function formatSlotDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}

export const ConsultationSlotsPage: React.FC = () => {
  const [slots, setSlots] = React.useState<ConsultationSlot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState<ConsultationSlot | null>(null);
  const [addDate, setAddDate] = React.useState('');
  const [addStartTime, setAddStartTime] = React.useState('10:00');
  const [addEndTime, setAddEndTime] = React.useState('11:00');
  const [addMode, setAddMode] = React.useState<'in_person' | 'video'>('in_person');
  const [addCapacity, setAddCapacity] = React.useState('1');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    setLoading(true);
    consultationSlotsApi.list()
      .then(res => setSlots(res.slots ?? []))
      .catch((err: Error) => showToast('error', 'Failed to load slots', err.message))
      .finally(() => setLoading(false));
  }, []);

  const groupedSlots = slots.reduce<Record<string, ConsultationSlot[]>>((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = [];
    acc[slot.slot_date].push(slot);
    return acc;
  }, {});

  const getSlotStatus = (slot: ConsultationSlot) => {
    if (slot.booked_count >= slot.capacity) return 'full';
    if (slot.booked_count > 0) return 'partial';
    return 'available';
  };

  const handleAddSlot = async () => {
    if (!addDate || !addStartTime || !addEndTime) return;
    if (addEndTime <= addStartTime) {
      showToast('error', 'Invalid time', 'End time must be after start time');
      return;
    }
    try {
      const newSlot = await consultationSlotsApi.create({
        slot_date: addDate,
        time_start: addStartTime,
        time_end: addEndTime,
        mode: addMode,
        capacity: parseInt(addCapacity) || 1,
      });
      setSlots(prev => [...prev, newSlot]);
      showToast('success', 'Slot added', `${formatSlotDate(addDate)} at ${addStartTime}`);
    } catch (err) {
      showToast('error', 'Failed to add slot', err instanceof Error ? err.message : undefined);
    }
    setShowAddModal(false);
    setAddDate('');
    setAddStartTime('10:00');
    setAddEndTime('11:00');
    setAddMode('in_person');
    setAddCapacity('1');
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await consultationSlotsApi.delete(slotId);
      setSlots(prev => prev.filter(s => s.id !== slotId));
      showToast('success', 'Slot deleted');
    } catch (err) {
      showToast('error', 'Failed to delete slot', err instanceof Error ? err.message : undefined);
    }
    setSelectedSlot(null);
  };

  const sortedDates = Object.keys(groupedSlots).sort();

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Consultation Slots</h1>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}><Plus size={15}/> Add Slots</button>
      </div>

      <div className={styles.legend}>
        <span className={`${styles.legendDot} ${styles.dotAvailable}`} /> Available
        <span className={`${styles.legendDot} ${styles.dotPartial}`} /> Partially Booked
        <span className={`${styles.legendDot} ${styles.dotFull}`} /> Fully Booked
      </div>

      {loading ? (
        <div className={styles.calendarGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.dayCol}>
              <div className={styles.skeleton} style={{ height: 40, marginBottom: 8 }} />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className={styles.skeleton} style={{ height: 56, marginBottom: 6 }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.calendarGrid}>
          {sortedDates.map(date => (
            <div key={date} className={styles.dayCol}>
              <div className={styles.dayHeader}>
                <span className={styles.dayOfWeek}>{getDayOfWeek(date)}</span>
                <span className={styles.dayDate}>{formatSlotDate(date)}</span>
              </div>
              <div className={styles.slotList}>
                {groupedSlots[date].map(slot => {
                  const st = getSlotStatus(slot);
                  return (
                    <button
                      key={slot.id}
                      className={`${styles.slot} ${styles[`slot${st.charAt(0).toUpperCase()}${st.slice(1)}`]}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <span className={styles.slotTime}>{slot.time_start} – {slot.time_end}</span>
                      <span className={styles.slotMeta}>{slot.booked_count}/{slot.capacity} booked</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slot Detail Modal */}
      {selectedSlot && (
        <div className={styles.overlay} onClick={() => setSelectedSlot(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Slot Details</h3>
            <div className={styles.detailRows}>
              <div className={styles.detailRow}><span>Date</span><span>{formatSlotDate(selectedSlot.slot_date)}</span></div>
              <div className={styles.detailRow}><span>Time</span><span>{selectedSlot.time_start} – {selectedSlot.time_end}</span></div>
              <div className={styles.detailRow}><span>Mode</span><span>{selectedSlot.mode === 'in_person' ? 'In Person' : 'Video'}</span></div>
              <div className={styles.detailRow}>
                <span>Bookings</span>
                <span>{selectedSlot.booked_count} / {selectedSlot.capacity}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Status</span>
                <span className={`${styles.slotStatusPill} ${styles[`pill${getSlotStatus(selectedSlot).charAt(0).toUpperCase()}${getSlotStatus(selectedSlot).slice(1)}`]}`}>
                  {getSlotStatus(selectedSlot) === 'full' ? 'Fully Booked'
                    : getSlotStatus(selectedSlot) === 'partial' ? 'Partially Booked'
                    : 'Available'}
                </span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setSelectedSlot(null)}>Close</button>
              <button
                className={styles.deleteSlotBtn}
                onClick={() => handleDeleteSlot(selectedSlot.id)}
                disabled={selectedSlot.booked_count > 0}
                title={selectedSlot.booked_count > 0 ? 'Cannot delete — has active bookings' : ''}
              >
                {selectedSlot.booked_count > 0 ? 'Has bookings — cannot delete' : 'Delete Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slots Modal */}
      {showAddModal && (
        <div className={styles.overlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add Consultation Slot</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Date *</label>
                <input type="date" className={styles.input} value={addDate} onChange={e => setAddDate(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Start Time *</label>
                <input type="time" className={styles.input} value={addStartTime} onChange={e => setAddStartTime(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>End Time *</label>
                <input type="time" className={styles.input} value={addEndTime} onChange={e => setAddEndTime(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Mode</label>
                <select
                  className={styles.input}
                  value={addMode}
                  onChange={e => setAddMode(e.target.value as 'in_person' | 'video')}
                >
                  <option value="in_person">In Person</option>
                  <option value="video">Video Call</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Capacity</label>
                <input
                  type="number"
                  className={styles.input}
                  value={addCapacity}
                  onChange={e => setAddCapacity(e.target.value)}
                  min="1"
                  max="50"
                />
                <span className={styles.fieldHint}>Usually 1–2 for Luxe consultations</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button
                className={styles.createBtn}
                onClick={handleAddSlot}
                disabled={!addDate || !addStartTime || !addEndTime}
              >
                Create Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
