import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { HubBlastRadius } from '../../api/adminApi';
import { hubsApi, staffApi, fabricsApi } from '../../api/adminApi';
import type { Hub, StaffMember, FabricStockRow, HubRecentOrder, HubActivityItem } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader, Tabs } from '../../components';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import styles from './HubDetailPage.module.css';
import { UilAngleLeft, UilPlus, UilPower, UilSave } from "@iconscout/react-unicons";
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const ROLE_LABELS: Record<string, string> = {
  hub_manager: 'Hub Manager', tailor: 'Tailor', cutting_master: 'Cutting Master',
  qc_staff: 'QC', dispatch: 'Dispatch', measurement_agent: 'Agent',
};

const EMPTY_HUB: Partial<Hub> = { name: '', city: '', state: '', address: '', pincode: '', managerName: '', managerPhone: '', status: 'Active', tailorCount: 0, activeOrders: 0, capacityUsed: 0, qcPassRate: 100 };

export const HubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [hub, setHub] = React.useState<Hub | null>(null);
  const [form, setForm] = React.useState<Partial<Hub>>(EMPTY_HUB);
  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  // G-41: real staff roster (replacing the dead "Recent Orders" placeholder)
  const [roster, setRoster] = React.useState<StaffMember[] | null>(null);
  // W-18: per-hub fabric stock for the Capacity & Stock tab.
  const [stock, setStock] = React.useState<FabricStockRow[] | null>(null);
  // T2-24: recent orders + activity feed + deactivate confirmation
  const [recentOrders, setRecentOrders] = React.useState<HubRecentOrder[] | null>(null);
  const [activity, setActivity] = React.useState<HubActivityItem[] | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = React.useState(false);
  const [statusSaving, setStatusSaving] = React.useState(false);

  useBreadcrumbTitle(hub?.name || form.name || (isNew ? 'New Hub' : undefined));

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    hubsApi.get(id)
      .then(h => { setHub(h); setForm(h); })
      .catch(e => showToast('error', 'Failed to load hub', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    staffApi.list(id).then(setRoster).catch(() => setRoster([]));
    fabricsApi.stock({ hub_id: id }).then(setStock).catch(() => setStock([]));
    hubsApi.recentOrders(id).then(setRecentOrders).catch(() => setRecentOrders([]));
    hubsApi.activity(id).then(setActivity).catch(() => setActivity([]));
  }, [id, isNew]);

  // [SHL-6-4] "What is this hub's situation?" answered on the hub's own page.
  //
  // The one object that ties the dark-store together was the one page that did not connect
  // to its parts: the roster lived in Staff Management, the pincodes in Service Areas and
  // the stock in the procurement console, so the question took three navigations and a
  // mental join. These are the same counts [SHL-6-2] measures for the deactivate confirm —
  // read once on load, so the page can answer before anyone clicks anything.
  React.useEffect(() => {
    if (!id || id === 'new') return;
    hubsApi
      .blastRadius(id)
      .then(setSituation)
      .catch((e) => setSituationErr(e instanceof Error ? e.message : 'could not be loaded'));
  }, [id]);
  const [situation, setSituation] = React.useState<HubBlastRadius | null>(null);
  const [situationErr, setSituationErr] = React.useState<string | null>(null);

  // [SHL-6-2] What this hub is holding, measured before the operator is asked to confirm.
  const [blast, setBlast] = React.useState<HubBlastRadius | null>(null);
  const [blastErr, setBlastErr] = React.useState<string | null>(null);
  const [blastLoading, setBlastLoading] = React.useState(false);
  const askDeactivate = async () => {
    if (!hub) return;
    setBlast(null);
    setBlastErr(null);
    setBlastLoading(true);
    setConfirmDeactivate(true);
    try {
      setBlast(await hubsApi.blastRadius(hub.id));
    } catch (e) {
      // Keep the reason. The dialog says the counts could not be read AND why, rather
      // than showing a reassuring zero — which is the failure this whole fix is about.
      setBlastErr(e instanceof Error ? e.message : 'the counts could not be loaded');
    } finally {
      setBlastLoading(false);
    }
  };

  // T2-24: flip active/inactive (used by the deactivate confirm + the activate button).
  const setHubStatus = async (next: 'Active' | 'Inactive') => {
    if (!hub) return;
    setStatusSaving(true);
    try {
      // Deactivation is force-confirmed: the operator has just read the counts above.
      const updated = await hubsApi.update(
        hub.id,
        { status: next },
        { force: next === 'Inactive' },
      );
      setHub(updated); setForm(updated);
      showToast('success', `Hub ${updated.status.toLowerCase()}`);
      hubsApi.activity(hub.id).then(setActivity).catch(() => {});
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setStatusSaving(false); setConfirmDeactivate(false); }
  };

  const handleFormChange = (key: keyof Hub, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSubmitted(true);
    const errors: string[] = [];
    if (!form.name?.trim()) errors.push('Hub Name');
    if (!form.city?.trim()) errors.push('City');
    if (!form.address?.trim()) errors.push('Address');
    if (!form.managerName?.trim()) errors.push('Manager Name');
    if (!form.managerPhone?.trim()) errors.push('Manager Phone');
    if (form.managerPhone && !/^\d{10}$/.test(form.managerPhone.replace(/\s/g, ''))) {
      showToast('error', 'Manager phone must be a 10-digit Indian mobile number'); return;
    }
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      showToast('error', 'Hub pincode must be 6 digits'); return;
    }
    if (errors.length > 0) {
      showToast('error', `Required fields missing: ${errors.join(', ')}`); return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await hubsApi.create(form);
        showToast('success', 'Hub created', created.name);
        navigate(`/admin/hubs/${created.id}`, { replace: true });
      } else if (hub) {
        const updated = await hubsApi.update(hub.id, form);
        setHub(updated); setForm(updated);
        showToast('success', 'Hub saved');
      }
    } catch (e) {
      showToast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  if (loading) return <div className={styles.page}><div>Loading hub…</div></div>;

  /* ── CREATE MODE ── */
  if (isNew) {
    return (
      <div className={styles.page}>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><UilAngleLeft size={15}/> Back to Hubs</button>
        <h1 className={styles.hubName} style={{ marginBottom: 0 }}>New Hub</h1>
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Hub Details</h3>
          <div className={styles.formGrid}>
            {([
              { key: 'name',         label: 'Hub Name *',       type: 'text',  required: true },
              { key: 'city',         label: 'City *',           type: 'text',  required: true },
              { key: 'state',        label: 'State',            type: 'text',  required: false },
              { key: 'address',      label: 'Address Line 1 *', type: 'text',  required: true },
              { key: 'pincode',      label: 'Pincode (6-digit)', type: 'text', required: false },
              { key: 'managerName',  label: 'Manager Name *',   type: 'text',  required: true },
              { key: 'managerPhone', label: 'Manager Phone *',  type: 'tel',   required: true },
            ] as Array<{ key: keyof Hub; label: string; type: string; required: boolean }>).map(f => (
              <div key={f.key} className={styles.formField}>
                <label className={styles.metaLabel}>{f.label}</label>
                <input
                  type={f.type}
                  className={`${styles.fieldInput} ${submitted && f.required && !form[f.key] ? styles.inputError : ''}`}
                  value={(form[f.key] as string) ?? ''}
                  onChange={e => handleFormChange(f.key, e.target.value)}
                  placeholder={f.key === 'managerPhone' ? '10-digit mobile' : f.key === 'pincode' ? '6-digit pincode' : ''}
                />
                {submitted && f.required && !form[f.key] && <span className={styles.fieldHint}>This field is required</span>}
              </div>
            ))}
            <div className={styles.formField}>
              <label className={styles.metaLabel}>Status</label>
              <select className={styles.fieldInput} value={form.status ?? 'Active'} onChange={e => handleFormChange('status', e.target.value)}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}>Cancel</button>
          <button className={styles.editBtn} disabled={saving} onClick={handleSave}>{saving ? 'Creating…' : 'Create Hub'}</button>
        </div>
      </div>
    );
  }

  if (!hub) return <div className={styles.page}><button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><UilAngleLeft size={15}/> Back</button><div>Hub not found.</div></div>;

  /* ── EDIT / DETAIL MODE (super-admin oversight) — canon tabbed shell (W-18) ── */
  const num = (v: string | number | null) => Number(v) || 0;

  const managers = (roster ?? []).filter(s => s.role === 'hub_manager');
  const detailsContent = (
    <div className={styles.card}>
      <h3 className={styles.sectionTitle}>Hub Details</h3>
      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.metaLabel}>Address</label>
          <input type="text" className={styles.fieldInput} value={form.address ?? ''}
            onChange={e => handleFormChange('address', e.target.value)} />
        </div>
        <div className={styles.formField}>
          <label className={styles.metaLabel}>Pincode</label>
          <input type="text" className={styles.fieldInput} value={form.pincode ?? ''}
            onChange={e => handleFormChange('pincode', e.target.value)} />
          <button className={styles.linkBtn} onClick={() => navigate('/admin/system/service-areas')}>Manage service areas →</button>
        </div>
        {/* T2-24: manager is a select over the hub's hub_manager staff (no more free-text). */}
        <div className={styles.formField}>
          <label className={styles.metaLabel}>Hub Manager</label>
          {roster === null ? (
            <input type="text" className={styles.fieldInput} value="Loading…" readOnly disabled />
          ) : managers.length === 0 ? (
            <span className={styles.fieldHint}>
              No hub-manager staff at this hub. <button className={styles.linkBtn} onClick={() => navigate('/admin/system/staff')}>Add one →</button>
            </span>
          ) : (
            <select className={styles.fieldInput} value={form.managerStaffId ?? ''}
              onChange={e => {
                const m = managers.find(s => s.id === e.target.value);
                setForm(prev => ({ ...prev, managerStaffId: m?.id ?? null, managerName: m?.name ?? '', managerPhone: m?.phone ?? '' }));
              }}>
              <option value="">Select a hub manager…</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name}{m.phone ? ` · ${m.phone}` : ''}</option>)}
            </select>
          )}
          {!form.managerStaffId && form.managerName && (
            <span className={styles.fieldHint}>Currently (unlinked): {form.managerName}{form.managerPhone ? ` · ${form.managerPhone}` : ''}</span>
          )}
        </div>
        <div className={styles.formField}>
          <label className={styles.metaLabel}>Contact</label>
          <input type="text" className={styles.fieldInput} value={form.managerPhone ?? ''} readOnly disabled />
        </div>
      </div>
    </div>
  );

  const stockContent = (
    <>
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Performance &amp; capacity</h3>
        <div className={styles.perfGrid}>
          <div className={styles.perfCard}><div className={styles.perfValue}>{hub.activeOrders}</div><div className={styles.perfLabel}>Active Orders</div></div>
          <div className={styles.perfCard}><div className={styles.perfValue}>{hub.capacityUsed}%</div><div className={styles.perfLabel}>Capacity Used</div></div>
          <div className={styles.perfCard}><div className={styles.perfValue}>{hub.qcPassRate}%</div><div className={styles.perfLabel}>QC Pass Rate</div></div>
          <div className={styles.perfCard}><div className={styles.perfValue}>{hub.tailorCount}</div><div className={styles.perfLabel}>Tailors</div></div>
        </div>
      </div>
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Fabric stock at this hub</h3>
        {stock === null ? (
          <div className={styles.empty}>Loading stock…</div>
        ) : stock.length === 0 ? (
          <div className={styles.empty}>No fabric stock recorded at this hub yet.</div>
        ) : (
          <table className={styles.rosterTable}>
            <thead><tr><th>Fabric</th><th>Code</th><th>Available (m)</th><th>Reserved (m)</th><th>Reorder (m)</th><th>Stock value</th></tr></thead>
            <tbody>
              {stock.map(st => (
                <tr key={st.fabric_id}>
                  <td className={styles.rosterName}>{st.fabric_name}</td>
                  <td>{st.fabric_code}</td>
                  <td>{num(st.available_meters)}</td>
                  <td>{num(st.reserved_meters)}</td>
                  <td>{st.reorder_meters == null ? '—' : num(st.reorder_meters)}</td>
                  <td>{st.price_per_meter == null ? '—' : `₹${(num(st.available_meters) * num(st.price_per_meter)).toLocaleString('en-IN')}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  const rosterContent = (
    <div className={styles.card}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Staff roster</h3>
        <button className={styles.linkBtn} onClick={() => navigate('/admin/system/staff')}>
          <UilPlus size={13} /> Manage ops staff →
        </button>
      </div>
      {roster === null ? (
        <div className={styles.empty}>Loading roster…</div>
      ) : roster.length === 0 ? (
        <div className={styles.empty}>
          No ops staff assigned to this hub yet. Add them from Ops Staff.
        </div>
      ) : (
        <table className={styles.rosterTable}>
          <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Status</th></tr></thead>
          <tbody>
            {roster.map(s => (
              <tr key={s.id}>
                <td className={styles.rosterName}>{s.name}</td>
                <td>{ROLE_LABELS[s.role] ?? s.role}</td>
                <td>{s.phone ?? '—'}</td>
                <td><StatusBadge status={s.is_active ? 'active' : 'inactive'} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // T2-24: real Recent-orders tab (was a dead placeholder).
  const ordersContent = (
    <div className={styles.card}>
      <h3 className={styles.sectionTitle}>Recent orders</h3>
      {recentOrders === null ? (
        <div className={styles.empty}>Loading orders…</div>
      ) : recentOrders.length === 0 ? (
        <div className={styles.empty}>No orders at this hub yet.</div>
      ) : (
        <table className={styles.rosterTable}>
          <thead><tr><th>Order</th><th>Customer</th><th>Stage</th><th>Total</th><th>Placed</th></tr></thead>
          <tbody>
            {recentOrders.map(o => (
              <tr key={o.uuid} className={styles.clickRow} {...rowActivation(() => navigate(`/admin/orders/${o.uuid}`))}>
                <td className={styles.rosterName}>{o.reference_id || o.id}</td>
                <td>{o.customer ?? '—'}</td>
                <td><StatusBadge status={o.stage} size="sm" /></td>
                <td>₹{o.total.toLocaleString('en-IN')}</td>
                <td>{fmtDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // T2-24: merged floor + config activity feed.
  const activityContent = (
    <div className={styles.card}>
      <h3 className={styles.sectionTitle}>Activity</h3>
      {activity === null ? (
        <div className={styles.empty}>Loading activity…</div>
      ) : activity.length === 0 ? (
        <div className={styles.empty}>No activity recorded at this hub yet.</div>
      ) : (
        <ul className={styles.activityFeed}>
          {activity.map((a, i) => (
            <li key={i} className={styles.activityItem}>
              <span className={`${styles.activityDot} ${a.kind === 'config' ? styles.activityDotConfig : ''}`} />
              <div className={styles.activityBody}>
                <div className={styles.activityTitle}>
                  {a.order_uuid ? (
                    <button className={styles.linkBtn} onClick={() => navigate(`/admin/orders/${a.order_uuid}`)}>{a.title}</button>
                  ) : a.title}
                </div>
                {a.subtitle && <div className={styles.activitySub}>{a.subtitle}</div>}
                <div className={styles.activityMeta}>{fmtDate(a.created_at)}{a.actor ? ` · ${a.actor}` : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageHeader
        above={<button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}><UilAngleLeft size={15}/> Back to Hubs</button>}
        title={hub.name}
        subtitle={[hub.city, hub.state].filter(Boolean).join(', ')}
        meta={<StatusBadge status={hub.status.toLowerCase()} label={hub.status} />}
        actions={
          <>
            <button className={styles.editBtn} disabled={saving} onClick={handleSave}><UilSave size={14}/> {saving ? 'Saving…' : 'Save Changes'}</button>
            <button className={styles.deactivateBtn} disabled={statusSaving}
              onClick={() => hub.status === 'Active' ? askDeactivate() : setHubStatus('Active')}>
              {hub.status === 'Active' ? <><UilPower size={14}/> Deactivate Hub</> : <><UilPower size={14}/> Activate Hub</>}
            </button>
          </>
        }
      />

      {hub.status === 'Inactive' && <div className={styles.inactiveBanner}>This hub is inactive. It is not accepting new orders.</div>}

      {/* [SHL-6-4] The hub's situation, with a way into each part of it. */}
      <div className={styles.situationStrip}>
        {situationErr && !situation ? (
          <span className={styles.situationErr}>
            Couldn't load this hub's situation ({situationErr}).
          </span>
        ) : !situation ? (
          <span className={styles.situationErr}>Loading this hub's situation…</span>
        ) : (
          <>
            <button className={styles.situationItem} onClick={() => navigate(`/admin/orders?hub_id=${id}`)}>
              <strong>{situation.active_orders}</strong> active order{situation.active_orders === 1 ? '' : 's'}
            </button>
            <button className={styles.situationItem} onClick={() => navigate('/admin/procurement/stock')}>
              <strong>{situation.fabric_meters}m</strong> fabric
            </button>
            {/* [SHL-6-7] Say WHICH staff. The count has always come from `staff` (ops login
                accounts) while `hub_staff` — the floor roster that measurement provenance
                points at — is surfaced on no admin page at all. A hub reading "5 staff"
                was silently excluding it. Both are shown; which of the two tables is the
                real roster is a data-model question this page cannot settle. */}
            <button
              className={styles.situationItem}
              onClick={() => navigate('/admin/system/staff')}
              title="Ops login accounts (the `staff` table) — the ones this console manages"
            >
              <strong>{situation.active_staff}</strong> login account
              {situation.active_staff === 1 ? '' : 's'}
            </button>
            {situation.roster_staff > 0 && (
              <span
                className={styles.situationItem}
                title="Floor roster (the `hub_staff` table) — what measurement provenance points at. No admin page manages these yet."
              >
                <strong>{situation.roster_staff}</strong> roster entr
                {situation.roster_staff === 1 ? 'y' : 'ies'} (unmanaged)
              </span>
            )}
            <button className={styles.situationItem} onClick={() => navigate('/admin/catalog/listings')}>
              <strong>{situation.live_listings}</strong> live listing{situation.live_listings === 1 ? '' : 's'}
            </button>
            <button className={styles.situationItem} onClick={() => navigate('/admin/system/service-areas')}>
              <strong>{situation.service_pincodes}</strong> service pincode{situation.service_pincodes === 1 ? '' : 's'}
            </button>
          </>
        )}
      </div>

      <Tabs
        tabs={[
          { id: 'details', label: 'Details', content: detailsContent },
          { id: 'orders', label: 'Recent orders', content: ordersContent },
          { id: 'activity', label: 'Activity', content: activityContent },
          { id: 'stock', label: 'Capacity & Stock', content: stockContent },
          { id: 'roster', label: 'Staff roster', content: rosterContent },
        ]}
      />

      <ConfirmDialog
        open={confirmDeactivate}
        title="Deactivate this hub?"
        /* [SHL-6-2] Say what is actually at stake. This read "Existing orders are
           unaffected" — an assertion with nothing behind it, on a hub that might be
           holding ten live orders, a hundred metres of fabric and five people's shifts. */
        message={
          blastLoading
            ? `${hub.name} will stop accepting new orders. Checking what it is holding…`
            : !blast
              ? `${hub.name} will stop accepting new orders. We could NOT read what this hub is currently holding (${blastErr ?? 'unknown error'}) — check its orders, stock and roster before continuing.`
              : `${hub.name} will stop accepting new orders and is currently holding ` +
                `${blast.active_orders} active order${blast.active_orders === 1 ? '' : 's'}, ` +
                `${blast.fabric_meters}m fabric, ${blast.active_staff} staff and ` +
                `${blast.live_listings} live listing${blast.live_listings === 1 ? '' : 's'} ` +
                `across ${blast.service_pincodes} service pincode${blast.service_pincodes === 1 ? '' : 's'}. ` +
                `Those orders keep running — nobody new can be routed here. You can reactivate it anytime.`
        }
        confirmLabel="Deactivate hub"
        variant="danger"
        loading={statusSaving}
        onConfirm={() => setHubStatus('Inactive')}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  );
};

export default HubDetailPage;
