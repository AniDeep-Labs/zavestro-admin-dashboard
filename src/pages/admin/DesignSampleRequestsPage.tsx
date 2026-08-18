import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sampleJobsApi, hubsApi, designsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { SampleJob, Hub, DesignSummary, DesignFabricRef } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Modal, AgeCell } from '../../components';
import { Button } from '../../components/Button/Button';
import { SampleProgress, isTerminalSample } from './SampleProgress';
import base from './OrdersListPage.module.css';
import s from './DesignSampleRequestsPage.module.css';
import { UilPlus, UilTimes, UilImage } from '@iconscout/react-unicons';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');

export const DesignSampleRequestsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = React.useState<SampleJob[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  // ── Request-sample modal (design + fabric + hub picker) ──
  const [showRequest, setShowRequest] = React.useState(false);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [designFabrics, setDesignFabrics] = React.useState<DesignFabricRef[]>([]);
  const [reqDesign, setReqDesign] = React.useState('');
  const [reqFabric, setReqFabric] = React.useState('');
  const [reqHub, setReqHub] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    sampleJobsApi
      .list(statusFilter ? { status: statusFilter } : {})
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);

  // Deep-link from a design's detail page (?design=<id>) → open the request modal pre-filled.
  React.useEffect(() => {
    const designId = searchParams.get('design');
    if (!designId) return;
    setShowRequest(true);
    designsApi.list().then(setDesigns).catch(() => {});
    pickDesign(designId);
    searchParams.delete('design');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRequest = () => {
    setShowRequest(true);
    if (designs.length === 0) designsApi.list().then(setDesigns).catch(() => {});
  };
  const resetRequest = () => {
    setShowRequest(false);
    setReqDesign(''); setReqFabric(''); setReqHub(''); setDesignFabrics([]);
  };
  const pickDesign = (designId: string) => {
    setReqDesign(designId); setReqFabric(''); setDesignFabrics([]);
    if (designId) designsApi.get(designId).then((d) => setDesignFabrics(d.fabrics)).catch(() => {});
  };
  const submitRequest = async () => {
    if (!reqDesign || !reqFabric || !reqHub) {
      toast('error', 'Pick a design, fabric and hub');
      return;
    }
    const outOfStock = availAt(reqHub) === 0; // T1-18: capture before reset
    setSubmitting(true);
    try {
      await sampleJobsApi.request({ design_id: reqDesign, fabric_id: reqFabric, hub_id: reqHub });
      toast(
        outOfStock ? 'warning' : 'success',
        'Sample requested',
        outOfStock
          ? 'Note: this hub has 0m of the fabric — it will wait at cutting until stock is distributed.'
          : 'The hub will cut, stitch and submit it for review.',
      );
      resetRequest();
      load();
    } catch (e) {
      toast('error', 'Request failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };
  const cancel = async (id: string) => {
    setCancelling(id);
    try {
      await sampleJobsApi.cancel(id);
      toast('success', 'Sample request cancelled');
      load();
    } catch (err) {
      toast('error', 'Cancel failed', err instanceof Error ? err.message : undefined);
    } finally {
      setCancelling('');
    }
  };

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';

  // T1-18 (W-D1): the selected fabric's per-hub stock, so the designer doesn't request a
  // sample at a 0m hub that stalls at ops cutting days later. Hubs absent from the fabric's
  // hubs list have 0m (the backend only lists hubs with stock > 0).
  const selectedFabricHubs = designFabrics.find((f) => f.id === reqFabric)?.hubs ?? [];
  const availAt = (hubId: string) =>
    Number(selectedFabricHubs.find((h) => h.hub_id === hubId)?.available_meters ?? 0);
  const reqHubStock = reqFabric && reqHub ? availAt(reqHub) : null;
  const open = rows.filter((r) => !['reviewed', 'approved', 'rejected', 'cancelled'].includes(r.status)).length;

  const body = (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {embedded ? (
        // The shell (SamplesPage) already carries the title + intro; here we only need
        // the toolbar. The filter row below carries the action + count.
        null
      ) : (
        <div className={base.pageHeader}>
          <div>
            <h1 className={base.title}>My Sample Requests</h1>
            <p className={base.subtitle}>
              Samples you've asked a hub to stitch, and where each one is. Once a sample is reviewed, catalog can list that design.
            </p>
          </div>
        </div>
      )}

      <div className={s.toolbar}>
        <select className={s.statusSel} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="cutting">Cutting</option>
          <option value="stitching">Stitching</option>
          <option value="design_review">In review</option>
          <option value="reviewed">Reviewed</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className={s.count}>{loading ? '' : `${open} in progress · ${rows.length} total`}</span>
        <Button size="sm" onClick={openRequest}><UilPlus size={14} /> Request sample</Button>
      </div>

      <div className={base.tableWrap}>
        <table className={base.table}>
          <thead>
            <tr><th>Fabric</th><th>Design</th><th>Hub</th><th>Progress</th><th>Requested</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={base.skeleton} /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className={base.empty}>No sample requests — request one from any design.</td></tr>
            ) : (
              rows.map((r) => {
                const done = isTerminalSample(r.status);
                return (
                  <tr key={r.id} className={base.row} {...rowActivation(() => navigate(`/admin/design/samples/${r.id}`))}>
                    <td>
                      <div className={s.fabricCell}>
                        {swatch(r.fabric_image_keys)
                          ? <img className={s.thumb} src={swatch(r.fabric_image_keys)} alt="" />
                          : <div className={s.thumb}><UilImage size={16} /></div>}
                        <div className={s.fabricText}><span>{r.fabric_name}</span><span className={s.code}>{r.fabric_code}</span></div>
                      </div>
                    </td>
                    <td className={base.customerName}>{r.design_name}</td>
                    <td>{r.hub_name ?? hubName(r.hub_id)}</td>
                    <td><SampleProgress status={r.status} /></td>
                    {/* Age-pressure only matters while a sample is in flight; a done one being
                        old isn't a problem, so don't flag it red. */}
                    <td><AgeCell since={r.created_at} warnAfterH={done ? Infinity : 120} alertAfterH={done ? Infinity : 240} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {r.status === 'requested' && (
                        <Button size="sm" variant="ghost" disabled={cancelling === r.id} onClick={() => cancel(r.id)}>
                          <UilTimes size={13} /> Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showRequest} onClose={resetRequest} title="Request a sample" size="sm">
        <div className={s.reqForm}>
          <div className={s.reqField}>
            <label className={s.reqLabel}>Design</label>
            <select className={s.reqSelect} value={reqDesign} onChange={(e) => pickDesign(e.target.value)}>
              <option value="">Select a design…</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>{d.name} · {d.garment_type}</option>
              ))}
            </select>
          </div>
          <div className={s.reqField}>
            <label className={s.reqLabel}>Fabric</label>
            <select className={s.reqSelect} value={reqFabric} onChange={(e) => setReqFabric(e.target.value)} disabled={!reqDesign}>
              <option value="">{reqDesign ? 'Select a paired fabric…' : 'Pick a design first'}</option>
              {designFabrics.map((f) => (
                <option key={f.id} value={f.id}>{f.name}{f.code ? ` · ${f.code}` : ''}</option>
              ))}
            </select>
          </div>
          <div className={s.reqField}>
            <label className={s.reqLabel}>Hub</label>
            <select className={s.reqSelect} value={reqHub} onChange={(e) => setReqHub(e.target.value)}>
              <option value="">Select a hub…</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}{reqFabric ? ` — ${availAt(h.id)}m of this fabric` : ''}
                </option>
              ))}
            </select>
            {reqHubStock === 0 && (
              <div className={s.stockWarn}>
                ⚠ This hub has 0m of the selected fabric — the sample will stall at cutting until stock is distributed here. You can still request it.
              </div>
            )}
          </div>
          <div className={s.reqActions}>
            <Button variant="ghost" onClick={resetRequest}>Cancel</Button>
            <Button variant="primary" disabled={!reqDesign || !reqFabric || !reqHub || submitting} onClick={submitRequest}>
              {submitting ? 'Requesting…' : 'Request sample'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );

  return embedded ? body : <div className={base.page}>{body}</div>;
};

export default DesignSampleRequestsPage;
