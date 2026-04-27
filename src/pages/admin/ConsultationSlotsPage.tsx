import React from 'react';
import { consultationSlotsApi } from '../../api/adminApi';
import type { ConsultationSlot } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ConsultationSlotsPage.module.css';

export const ConsultationSlotsPage: React.FC = () => {
  const [slots, setSlots] = React.useState<ConsultationSlot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState<ConsultationSlot | null>(null);
  const [addDate, setAddDate] = React.useState('');
  const [addTime, setAddTime] = React.useState('10:00');
  const [addMax, setAddMax] = React.useState('2');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    setLoading(true);
    consultationSlotsApi.list()
      .then(res => setSlots(res.slots ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groupedSlots = slots.reduce<Record<string, ConsultationSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const getSlotStatus = (slot: ConsultationSlot) => {
    if (slot.booked >= slot.maxBookings) return 'full';
    if (slot.booked > 0) return 'partial';
    return 'available';
  };

  const handleAddSlot = async () => {
    if (!addDate || !addTime) return;
    const dateObj = new Date(addDate);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const displayDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\//g, ' ');
    const [h, m] = addTime.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const timeDisplay = `${displayHour}:${m} ${ampm}`;

    try {
      const newSlot = await consultationSlotsApi.create({
        date: displayDate,
        time: timeDisplay,
        dayOfWeek,
        maxBookings: parseInt(addMax) || 2,
        booked: 0,
      });
      setSlots(prev => [...prev, newSlot]);
      showToast('success', 'Slot added', `${displayDate} at ${timeDisplay}`);
    } catch (err) {
      showToast('error', 'Failed to add slot', err instanceof Error ? err.message : undefined);
    }
    setShowAddModal(false);
    setAddDate('');
    setAddTime('10:00');
    setAddMax('2');
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

  const sortedDates = Object.keys(groupedSlots).sort((a, b) => {
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const parseDate = (d: string) => {
      const parts = d.split(' ');
      return new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]));
    };
    return parseDate(a).getTime() - parseDate(b).getTime();
  });

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Consultation Slots</h1>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>+ Add Slots</button>
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
                <span className={styles.dayOfWeek}>{groupedSlots[date][0].dayOfWeek}</span>
                <span className={styles.dayDate}>{date}</span>
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
                      <span className={styles.slotTime}>{slot.time}</span>
                      <span className={styles.slotMeta}>{slot.booked}/{slot.maxBookings} booked</span>
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
              <div className={styles.detailRow}><span>Date</span><span>{selectedSlot.date}</span></div>
              <div className={styles.detailRow}><span>Time</span><span>{selectedSlot.time}</span></div>
              <div className={styles.detailRow}>
                <span>Bookings</span>
                <span>{selectedSlot.booked} / {selectedSlot.maxBookings}</span>
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
                disabled={selectedSlot.booked > 0}
                title={selectedSlot.booked > 0 ? 'Cannot delete — has active bookings' : ''}
              >
                {selectedSlot.booked > 0 ? 'Has bookings — cannot delete' : 'Delete Slot'}
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
                <input type="time" className={styles.input} value={addTime} onChange={e => setAddTime(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Max Bookings per Slot</label>
                <input
                  type="number"
                  className={styles.input}
                  value={addMax}
                  onChange={e => setAddMax(e.target.value)}
                  min="1"
                  max="10"
                />
                <span className={styles.fieldHint}>Usually 1–2 for Luxe consultations</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className={styles.createBtn} onClick={handleAddSlot} disabled={!addDate || !addTime}>
                Create Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
