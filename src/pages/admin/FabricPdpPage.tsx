import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { fabricsApi, designsApi, hubsApi, sampleJobsApi, distributionApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { Fabric, DesignSummary, Hub, FabricLedgerEntry, FabricDesignUse } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './FabricPdpPage.module.css';
import { UilArrowLeft, UilImage } from '@iconscout/react-unicons';
import { StatusBadge } from '../../components';

const url = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

const Spec: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value === null || value === undefined || value === '' ? null : (
    <div className={s.specRow}><dt>{label}</dt><dd>{value}</dd></div>
  );

export const FabricPdpPage: React.FC<{ mode?: 'procurement' | 'design' }> = ({ mode = 'procurement' }) => {
  const { id } = useParams<{ id: string }>();
  const isDesign = mode === 'design';
  const backPath = isDesign ? '/admin/design/fabrics' : '/admin/procurement/fabrics';
  const [fabric, setFabric] = React.useState<Fabric | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState(0); // T2-28: swatch switcher index
  const [imgBroken, setImgBroken] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));

  // T2-28 procurement cockpit: tabs + movement/designs data + reorder editor + push modal
  const [tab, setTab] = React.useState<'stock' | 'designs' | 'movement'>('stock');
  const [movements, setMovements] = React.useState<FabricLedgerEntry[] | null>(null);
  const [designUses, setDesignUses] = React.useState<FabricDesignUse[] | null>(null);
  const [reorderEdits, setReorderEdits] = React.useState<Record<string, string>>({});
  const [savingReorder, setSavingReorder] = React.useState('');
  const [push, setPush] = React.useState<{ hub_id: string; meters: string; lot: string } | null>(null);
  const [pushing, setPushing] = React.useState(false);

  // design-mode: compare + request-sample
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [selDesign, setSelDesign] = React.useState('');
  const [selHub, setSelHub] = React.useState('');
  const [requesting, setRequesting] = React.useState(false);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const loadFabric = React.useCallback(() => {
    if (!id) return;
    fabricsApi.get(id).then(setFabric).catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined)).finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => { loadFabric(); }, [loadFabric]);

  // Procurement: hubs (for the distribute picker) + lazy movement/design data per tab.
  React.useEffect(() => {
    if (isDesign) {
      designsApi.list({ status: 'published' }).then(setDesigns).catch(() => {});
    }
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, [isDesign]);
  React.useEffect(() => {
    if (isDesign || !id) return;
    if (tab === 'movement' && movements === null) fabricsApi.movements(id).then(setMovements).catch(() => setMovements([]));
    if (tab === 'designs' && designUses === null) fabricsApi.designsUsing(id).then(setDesignUses).catch(() => setDesignUses([]));
  }, [tab, isDesign, id, movements, designUses]);

  const requestSample = async () => {
    if (!id || !selDesign || !selHub) { toast('error', 'Pick a design and a hub'); return; }
    setRequesting(true);
    try {
      await sampleJobsApi.request({ design_id: selDesign, fabric_id: id, hub_id: selHub });
      toast('success', 'Sample requested', 'Sent to the hub to stitch.');
      setSelDesign(''); setSelHub('');
    } catch (e) {
      toast('error', 'Request failed', e instanceof Error ? e.message : undefined);
    } finally {
      setRequesting(false);
    }
  };

  // T2-28: set/clear a hub's reorder point.
  const saveReorder = async (hub_id: string) => {
    if (!id) return;
    const raw = reorderEdits[hub_id];
    const val = raw === '' || raw == null ? null : Number(raw);
    if (val != null && (!Number.isFinite(val) || val < 0)) { toast('error', 'Reorder point must be ≥ 0'); return; }
    setSavingReorder(hub_id);
    try {
      await fabricsApi.setReorderPoint(hub_id, id, val);
      toast('success', 'Reorder point saved');
      setReorderEdits((e) => { const n = { ...e }; delete n[hub_id]; return n; });
      loadFabric();
    } catch (e) {
      toast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSavingReorder('');
    }
  };

  // T2-28: distribute/restock — push fabric metres to a hub.
  const doPush = async () => {
    if (!id || !push) return;
    if (!push.hub_id) { toast('error', 'Pick a hub'); return; }
    const meters = Number(push.meters);
    if (!Number.isFinite(meters) || meters <= 0) { toast('error', 'Enter metres to send'); return; }
    setPushing(true);
    try {
      await distributionApi.push({ fabric_id: id, hub_id: push.hub_id, sellable_qty: meters, ...(push.lot.trim() ? { lot_code: push.lot.trim() } : {}) });
      toast('success', 'Distribution created', `${meters}m in transit to the hub.`);
      setPush(null);
      loadFabric();
      if (id) fabricsApi.movements(id).then(setMovements).catch(() => {});
    } catch (e) {
      toast('error', 'Distribute failed', e instanceof Error ? e.message : undefined);
    } finally {
      setPushing(false);
    }
  };

  if (loading) return <div className={base.page}><div className={s.center}><Spinner /></div></div>;
  if (!fabric) return (
    <div className={base.page}>
      <Link to={backPath} className={s.back}><UilArrowLeft size={16} /> Back</Link>
      <div className={s.center}>Fabric not found.</div>
    </div>
  );

  const imgs = (fabric.image_keys ?? []).map(url).filter(Boolean);
  const hubName = (hid: string) => hubs.find((h) => h.id === hid)?.name ?? '—';

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Link to={backPath} className={s.back}><UilArrowLeft size={16} /> {isDesign ? 'Back to Fabrics' : 'Back to Fabrics Master'}</Link>

      <div className={s.col}>
        {/* Header — swatch switcher + identity */}
        <div className={s.header}>
          <div className={s.swatchStack}>
            {imgs.length === 0 || imgBroken ? (
              <div className={s.swatchEmpty}><UilImage size={26} /></div>
            ) : (
              <a href={imgs[active]} target="_blank" rel="noreferrer" className={s.swatch}>
                <img src={imgs[active]} alt={fabric.name} onError={() => setImgBroken(true)} />
              </a>
            )}
            {/* T2-28: multi-image swatch switcher */}
            {imgs.length > 1 && !imgBroken && (
              <div className={s.swatchThumbs}>
                {imgs.map((im, i) => (
                  <button
                    key={im}
                    type="button"
                    className={`${s.swatchThumb} ${i === active ? s.swatchThumbActive : ''}`}
                    onClick={() => setActive(i)}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={im} alt={`${fabric.name} ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={s.identity}>
            <div className={s.codeRow}>
              <span className={s.code}>{fabric.code}</span>
              <StatusBadge status={fabric.is_active ? 'active' : 'inactive'} />
            </div>
            <h1 className={s.name}>{fabric.name}{fabric.color_name ? <span className={s.color}> · {fabric.color_name}</span> : null}</h1>
            {fabric.price_per_meter && <div className={s.price}>₹{Number(fabric.price_per_meter).toLocaleString('en-IN')}<span> / metre</span></div>}
            {!isDesign && (
              <div className={s.headerActions}>
                <Button variant="primary" size="sm" onClick={() => setPush({ hub_id: '', meters: '', lot: '' })}>Distribute →</Button>
              </div>
            )}
          </div>
        </div>

        {/* Specifications */}
        <div className={s.card}>
          <h4 className={s.cardTitle}>Specifications</h4>
          <dl className={s.specs}>
            <Spec label="Composition" value={fabric.composition} />
            <Spec label="Weave" value={fabric.weave} />
            <Spec label="Finish" value={fabric.finish} />
            <Spec label="Weight" value={fabric.weight_gsm ? `${fabric.weight_gsm} gsm` : null} />
            <Spec label="Stretch" value={Number(fabric.stretch_pct ?? 0) > 0 ? `${Number(fabric.stretch_pct)}%` : null} />
            <Spec label="Shrinkage" value={Number(fabric.shrinkage_pct ?? 0) > 0 ? `${Number(fabric.shrinkage_pct)}%` : null} />
            <Spec label="Origin" value={fabric.origin} />
            <Spec label="Supplier / mill" value={fabric.supplier} />
            <Spec label="Care" value={fabric.care_instructions?.length ? fabric.care_instructions.join(' · ') : null} />
          </dl>
        </div>

        {/* T2-28: procurement cockpit tabs */}
        {!isDesign && (
          <>
            <div className={base.viewChips}>
              {([['stock', 'Stock'], ['designs', 'Designs'], ['movement', 'Movement']] as const).map(([k, label]) => (
                <button key={k} className={`${base.viewChip} ${tab === k ? base.viewChipActive : ''}`} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>

            {tab === 'stock' && (
              <div className={s.card}>
                <h4 className={s.cardTitle}>Hub stock &amp; reorder points</h4>
                {(fabric.stock?.length ?? 0) === 0 ? (
                  <p className={s.stockEmpty}>Not stocked at any hub yet. Use “Distribute →” to send some.</p>
                ) : (
                  <table className={base.table}>
                    <thead><tr><th>Hub</th><th>Available</th><th>Reserved</th><th>Reorder at</th><th></th></tr></thead>
                    <tbody>
                      {fabric.stock!.map((st) => {
                        const editing = st.hub_id in reorderEdits;
                        const low = st.reorder_meters != null && st.available_meters < st.reorder_meters;
                        return (
                          <tr key={st.hub_id}>
                            <td className={s.stockHub}>{st.hub_name}</td>
                            <td className={low ? s.stockLow : undefined}><strong>{st.available_meters}m</strong></td>
                            <td>{st.reserved_meters > 0 ? `${st.reserved_meters}m` : '—'}</td>
                            <td>
                              <input
                                className={s.reorderInput}
                                type="number"
                                placeholder="unset"
                                value={editing ? reorderEdits[st.hub_id] : (st.reorder_meters ?? '')}
                                onChange={(e) => setReorderEdits((x) => ({ ...x, [st.hub_id]: e.target.value }))}
                              />
                            </td>
                            <td className={s.stockActions}>
                              {editing && (
                                <Button variant="outline" size="sm" state={savingReorder === st.hub_id ? 'loading' : 'default'} onClick={() => saveReorder(st.hub_id)}>Save</Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setPush({ hub_id: st.hub_id, meters: '', lot: '' })}>Restock</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                <div className={s.usedByLine}>
                  Used by <strong>{fabric.design_count ?? 0}</strong> design{(fabric.design_count ?? 0) === 1 ? '' : 's'} · <strong>{fabric.listing_count ?? 0}</strong> listing{(fabric.listing_count ?? 0) === 1 ? '' : 's'}
                </div>
              </div>
            )}

            {tab === 'designs' && (
              <div className={s.card}>
                <h4 className={s.cardTitle}>Designs using this fabric</h4>
                {designUses === null ? (
                  <div className={s.center}><Spinner /></div>
                ) : designUses.length === 0 ? (
                  <p className={s.stockEmpty}>No design uses this fabric yet.</p>
                ) : (
                  <table className={base.table}>
                    <thead><tr><th>Design</th><th>Garment</th><th>Status</th><th>Live listings</th></tr></thead>
                    <tbody>
                      {designUses.map((d) => (
                        <tr key={d.id}>
                          <td className={s.stockHub}>{d.name}</td>
                          <td>{d.garment_type}</td>
                          <td><StatusBadge status={d.status} size="sm" /></td>
                          <td>{d.live_listings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'movement' && (
              <div className={s.card}>
                <h4 className={s.cardTitle}>Stock movement</h4>
                {movements === null ? (
                  <div className={s.center}><Spinner /></div>
                ) : movements.length === 0 ? (
                  <p className={s.stockEmpty}>No stock movement recorded yet.</p>
                ) : (
                  <table className={base.table}>
                    <thead><tr><th>When</th><th>Hub</th><th>Kind</th><th>Change</th><th>Balance</th><th>Note</th></tr></thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id}>
                          <td>{new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{m.hub_name}</td>
                          <td>{m.kind}{m.lot_code ? ` · ${m.lot_code}` : ''}</td>
                          <td className={m.delta_meters < 0 ? s.stockLow : s.stockUp}>{m.delta_meters > 0 ? '+' : ''}{m.delta_meters}m</td>
                          <td>{m.balance_after}m</td>
                          <td className={s.moveNote}>{m.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

      {isDesign && (
        <section className={s.card}>
          <h4 className={s.cardTitle}>Use this fabric in a design</h4>
          <label className={s.useField}>Design
            <select value={selDesign} onChange={(e) => setSelDesign(e.target.value)}>
              <option value="">Select a published design…</option>
              {designs.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.garment_type}</option>)}
            </select>
          </label>

          {selDesign && (
            <div className={s.compare}>
              <div className={s.compareCol}>
                <span className={s.compareLabel}>Fabric</span>
                {imgs[0] ? <img src={imgs[0]} alt="fabric" /> : <div className={s.compareEmpty}>no swatch</div>}
              </div>
              <div className={s.compareCol}>
                <span className={s.compareLabel}>Design</span>
                {(() => {
                  const cover = url(designs.find((d) => d.id === selDesign)?.cover_key ?? undefined);
                  return cover ? <img src={cover} alt="design" /> : <div className={s.compareEmpty}>no design image</div>;
                })()}
              </div>
            </div>
          )}

          <div className={s.useRow}>
            <label className={s.useField}>Hub
              <select value={selHub} onChange={(e) => setSelHub(e.target.value)}>
                <option value="">Select a hub…</option>
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <Button variant="primary" state={requesting ? 'loading' : 'default'} disabled={!selDesign || !selHub} onClick={requestSample}>
              Request sample
            </Button>
          </div>
        </section>
      )}
      </div>

      {/* T2-28: distribute / restock push modal */}
      <Modal
        open={!!push}
        onClose={() => setPush(null)}
        title={push?.hub_id ? `Restock ${hubName(push.hub_id)}` : 'Distribute fabric to a hub'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPush(null)}>Cancel</Button>
            <Button variant="primary" state={pushing ? 'loading' : 'default'} onClick={doPush}>Send</Button>
          </>
        }
      >
        {push && (
          <div className={s.pushForm}>
            {!push.hub_id ? (
              <label className={s.useField}>Hub
                <select value={push.hub_id} onChange={(e) => setPush({ ...push, hub_id: e.target.value })}>
                  <option value="">Select a hub…</option>
                  {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
            ) : (
              <div className={s.pushHub}>Sending to <strong>{hubName(push.hub_id)}</strong></div>
            )}
            <Input label="Metres to send *" type="number" value={push.meters} onChange={(v) => setPush({ ...push, meters: v })} placeholder="e.g. 100" />
            <Input label="Dye-lot (optional)" value={push.lot} onChange={(v) => setPush({ ...push, lot: v })} placeholder="lot code" />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FabricPdpPage;
