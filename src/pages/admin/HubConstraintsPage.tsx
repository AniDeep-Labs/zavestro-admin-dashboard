import React from 'react';
import { hubPlanningApi, hubsApi } from '../../api/adminApi';
import type { HubConstraintRow, HubCalendarEvent, HubCalendarInput, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Can } from '../../components/Can/Can';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import s from './HubConstraintsPage.module.css';

// T2-7 (O-11): where is each hub backed up (WIP × stage + SLA breach), read alongside the
// festival demand-spike / staff-leave calendar.
const fmtH = (n: number | null) => (n == null ? '—' : `${n}h`);

const blankEvent = (): HubCalendarInput => ({
  event_type: 'demand_spike',
  label: '',
  starts_on: '',
  ends_on: '',
  magnitude: 1.5,
  hub_id: null,
});

export const HubConstraintsPage: React.FC = () => {
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubId, setHubId] = React.useState('');
  const [rows, setRows] = React.useState<HubConstraintRow[]>([]);
  const [events, setEvents] = React.useState<HubCalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [editing, setEditing] = React.useState<{ id?: string; data: HubCalendarInput } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      hubPlanningApi.constraints(hubId || undefined),
      hubPlanningApi.listEvents({ hubId: hubId || undefined, upcoming: true }),
    ])
      .then(([c, e]) => {
        setRows(c);
        setEvents(e);
      })
      .catch((err) => toast('error', 'Load failed', err instanceof Error ? err.message : undefined))
      .finally(() => setLoading(false));
  }, [hubId]);

  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const saveEvent = async () => {
    if (!editing) return;
    const d = editing.data;
    if (!d.label.trim() || !d.starts_on || !d.ends_on)
      return toast('error', 'Label and both dates are required');
    if (d.ends_on < d.starts_on) return toast('error', 'End date must be on/after the start date');
    setSaving(true);
    try {
      const body: HubCalendarInput = { ...d, label: d.label.trim(), hub_id: d.hub_id || null };
      if (editing.id) await hubPlanningApi.updateEvent(editing.id, body);
      else await hubPlanningApi.createEvent(body);
      toast('success', editing.id ? 'Event updated' : 'Event added');
      setEditing(null);
      load();
    } catch (err) {
      toast('error', 'Could not save', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await hubPlanningApi.removeEvent(deleteId);
      toast('success', 'Event removed');
      setDeleteId(null);
      load();
    } catch (err) {
      toast('error', 'Could not remove', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className={s.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className={s.pageHeader}>
        <h1 className={s.title}>Hub constraints</h1>
        <p className={s.subtitle}>
          Work-in-progress by stage and hub — which hub is backed up at which stage — read against
          the festival / staff-leave calendar.
        </p>
      </div>

      <div className={s.toolbar}>
        <select className={s.select} value={hubId} onChange={(e) => setHubId(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      {/* Constraint grid */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <h2 className={s.cardTitle}>WIP × stage (worst-first)</h2>
        </div>
        {loading ? (
          <p className={s.empty}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className={s.empty}>No in-production orders right now.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Hub</th>
                <th>Stage</th>
                <th className={s.num}>WIP</th>
                <th className={s.num}>Over SLA</th>
                <th className={s.num}>In-stage p50 / p90 / max</th>
                <th className={s.num}>SLA</th>
                <th className={s.num}>Order age p50</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.hub_id}-${r.stage}-${i}`}>
                  <td>{r.hub_name ?? '—'}</td>
                  <td className={s.stageTag}>{r.stage}</td>
                  <td className={s.num}>{r.wip_count}</td>
                  <td className={`${s.num} ${r.over_sla_count > 0 ? s.overSla : ''}`}>
                    {r.over_sla_count}
                  </td>
                  <td className={s.num}>
                    {fmtH(r.p50_stage_hours)} / {fmtH(r.p90_stage_hours)} / {fmtH(r.max_stage_hours)}
                  </td>
                  <td className={s.num}>{r.threshold_hours}h</td>
                  <td className={s.num}>{fmtH(r.p50_order_age_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Festival / staff-leave calendar */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <h2 className={s.cardTitle}>Festival / staff-leave calendar</h2>
          <Can cap="system:manage">
            <button className={s.addBtn} onClick={() => setEditing({ data: blankEvent() })}>
              + Add event
            </button>
          </Can>
        </div>
        {events.length === 0 ? (
          <p className={s.empty}>No upcoming demand-spike or staff-leave windows.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Label</th>
                <th>Hub</th>
                <th>Window</th>
                <th className={s.num}>Magnitude</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span
                      className={`${s.badge} ${e.event_type === 'demand_spike' ? s.badgeSpike : s.badgeLeave}`}
                    >
                      {e.event_type === 'demand_spike' ? 'demand spike' : 'staff leave'}
                    </span>
                  </td>
                  <td>{e.label}</td>
                  <td>{e.hub_name ?? 'All hubs'}</td>
                  <td>
                    {e.starts_on} → {e.ends_on}
                  </td>
                  <td className={s.num}>
                    {e.event_type === 'demand_spike' ? `×${e.magnitude}` : `${e.magnitude * 100}% out`}
                  </td>
                  <td>
                    <Can cap="system:manage">
                      <span className={s.rowActions}>
                        <button
                          className={s.linkBtn}
                          onClick={() =>
                            setEditing({
                              id: e.id,
                              data: {
                                hub_id: e.hub_id,
                                event_type: e.event_type,
                                label: e.label,
                                starts_on: e.starts_on,
                                ends_on: e.ends_on,
                                magnitude: e.magnitude,
                                note: e.note ?? undefined,
                              },
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className={`${s.linkBtn} ${s.linkDanger}`}
                          onClick={() => setDeleteId(e.id)}
                        >
                          Delete
                        </button>
                      </span>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className={s.modalOverlay} onClick={() => setEditing(null)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.modalTitle}>{editing.id ? 'Edit event' : 'Add event'}</h3>
            <div className={s.row2}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Type</label>
                <select
                  className={s.input}
                  value={editing.data.event_type}
                  onChange={(ev) =>
                    setEditing({
                      ...editing,
                      data: { ...editing.data, event_type: ev.target.value as HubCalendarInput['event_type'] },
                    })
                  }
                >
                  <option value="demand_spike">Demand spike (festival)</option>
                  <option value="staff_leave">Staff leave</option>
                </select>
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel}>Hub</label>
                <select
                  className={s.input}
                  value={editing.data.hub_id ?? ''}
                  onChange={(ev) =>
                    setEditing({ ...editing, data: { ...editing.data, hub_id: ev.target.value || null } })
                  }
                >
                  <option value="">All hubs</option>
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>Label</label>
              <input
                className={s.input}
                value={editing.data.label}
                onChange={(ev) => setEditing({ ...editing, data: { ...editing.data, label: ev.target.value } })}
                placeholder="e.g. Diwali rush"
              />
            </div>
            <div className={s.row2}>
              <div className={s.field}>
                <label className={s.fieldLabel}>Starts</label>
                <input
                  type="date"
                  className={s.input}
                  value={editing.data.starts_on}
                  onChange={(ev) => setEditing({ ...editing, data: { ...editing.data, starts_on: ev.target.value } })}
                />
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel}>Ends</label>
                <input
                  type="date"
                  className={s.input}
                  value={editing.data.ends_on}
                  onChange={(ev) => setEditing({ ...editing, data: { ...editing.data, ends_on: ev.target.value } })}
                />
              </div>
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>
                Magnitude{' '}
                <span className={s.hint}>
                  {editing.data.event_type === 'demand_spike'
                    ? '(demand multiplier, e.g. 1.5 = +50%)'
                    : '(fraction of crew out, e.g. 0.3 = 30%)'}
                </span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                className={s.input}
                value={editing.data.magnitude ?? ''}
                onChange={(ev) =>
                  setEditing({
                    ...editing,
                    data: { ...editing.data, magnitude: ev.target.value === '' ? undefined : Number(ev.target.value) },
                  })
                }
              />
            </div>
            <div className={s.modalActions}>
              <button className={s.cancelBtn} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className={s.saveBtn} disabled={saving} onClick={saveEvent}>
                {saving ? 'Saving…' : editing.id ? 'Save changes' : 'Add event'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Remove this calendar event?"
        message="The demand-spike / staff-leave window will no longer show against the constraint view."
        confirmLabel="Remove"
        onConfirm={doDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default HubConstraintsPage;
