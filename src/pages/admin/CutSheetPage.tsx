import React from 'react';
import { designsApi, fabricsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { DesignDetail, GarmentTemplate, SizePreviewResult, Fabric } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import s from './CutSheetPage.module.css';
import { UilPrint, UilBolt } from '@iconscout/react-unicons';

// Body measurements the engine asks for, per region (mirrors the Engine Tester).
const FIELDS_BY_REGION: Record<string, { key: string; label: string }[]> = {
  upper: [
    { key: 'chest', label: 'Chest' }, { key: 'shoulder', label: 'Shoulder' },
    { key: 'sleeve', label: 'Sleeve' }, { key: 'bicep', label: 'Bicep' },
    { key: 'neck', label: 'Neck' }, { key: 'waist', label: 'Waist' }, { key: 'height_cm', label: 'Height (cm)' },
  ],
  lower: [
    { key: 'usual_size', label: 'Usual size' }, { key: 'waist', label: 'Waist' },
    { key: 'hip', label: 'Hip' }, { key: 'thigh', label: 'Thigh' },
    { key: 'knee', label: 'Knee' }, { key: 'inseam', label: 'Length / inseam (in)' },
  ],
};

export const CutSheetModal: React.FC<{ open: boolean; designId?: string; onClose: () => void }> = ({ open, designId, onClose }) => {
  const id = designId;
  const [design, setDesign] = React.useState<DesignDetail | null>(null);
  const [tpl, setTpl] = React.useState<GarmentTemplate | null>(null);
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [preset, setPreset] = React.useState('');
  const [fabricId, setFabricId] = React.useState('');
  const [body, setBody] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<SizePreviewResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = (tid: string) => setToasts((t) => t.filter((x) => x.id !== tid));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    setResult(null);
    setBody({});
    designsApi
      .get(id)
      .then((d) => {
        setDesign(d);
        if (d.fit_preset) setPreset(d.fit_preset);
        if (d.fabrics[0]) setFabricId(d.fabrics[0].id);
        // T1-27: thread the FETCHED design through the chain. Reading `design?.fit_preset` in
        // the next .then is a stale closure (still null), so it always clobbered the design's
        // own preset with the template's first — the printed cut sheet defaulted to the wrong fit.
        return designsApi.getTemplate(d.garment_category_id).then((t) => ({ d, t }));
      })
      .then(({ d, t }) => {
        setTpl(t);
        if (!d.fit_preset && t.available_fit_presets?.[0]) setPreset(t.available_fit_presets[0]);
      })
      .catch((e) => toast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    fabricsApi.list({ active: true }).then(setFabrics).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const region = tpl?.body_region ?? null;
  const fields = region ? FIELDS_BY_REGION[region] ?? FIELDS_BY_REGION.upper : [];
  const presets = tpl?.available_fit_presets ?? [];
  const tolerances = tpl?.tolerances ?? {};
  const fabric = fabrics.find((f) => f.id === fabricId) ?? null;
  const round = (n: number) => Math.round(n * 100) / 100;

  const run = async () => {
    if (!design || !tpl) return;
    if (!preset) { toast('error', 'Pick a fit preset'); return; }
    setRunning(true);
    setResult(null);
    try {
      const anchors: Record<string, number> = {};
      for (const [k, v] of Object.entries(body)) {
        const n = Number(v);
        if (v.trim() !== '' && !Number.isNaN(n)) anchors[k] = n;
      }
      const st = fabric ? Number(fabric.stretch_pct ?? 0) : 0;
      const sh = fabric ? Number(fabric.shrinkage_pct ?? 0) : 0;
      const r = await designsApi.sizePreview({
        garment_category_slug: design.garment_slug,
        fit_preset: preset,
        ...anchors,
        ...(st > 0 ? { stretch_pct: st } : {}),
        ...(sh > 0 ? { shrinkage_pct: sh } : {}),
      });
      setResult(r);
    } catch (e) {
      toast('error', "Couldn't compute the spec", e instanceof Error ? e.message : undefined);
    } finally {
      setRunning(false);
    }
  };

  const techPackUrl = design?.spec_sheet_key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${design.spec_sheet_key}` : '';
  const typeLine = design ? [design.garment_type, design.design_garment_type].filter(Boolean).join(' · ') : '';

  const footer = (
    <div className={s.noPrint} style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', width: '100%' }}>
      <Button variant="ghost" onClick={onClose}>Close</Button>
      <Button variant="primary" onClick={() => window.print()} disabled={!result}><UilPrint size={16} /> Print</Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Cut sheet" className={s.cutSheetModal} footer={footer}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {loading ? (
        <div className={s.center}><Spinner /></div>
      ) : !design || !tpl ? (
        <div className={s.center}>Design not found.</div>
      ) : (
      <>
      <p className={`${s.subtitle} ${s.noPrint}`}>Pick the fit, fabric and a sample body, generate the finished spec, then print it for the patternmaker / sample tailor.</p>

      <div className={`${s.controls} ${s.noPrint}`}>
        <div className={s.ctrlRow}>
          <label className={s.field}>
            <span className={s.label}>Fit preset</span>
            <select className={s.input} value={preset} onChange={(e) => setPreset(e.target.value)}>
              {presets.length === 0 ? <option value="">No presets calibrated</option> : presets.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className={s.field}>
            <span className={s.label}>Fabric</span>
            <select className={s.input} value={fabricId} onChange={(e) => setFabricId(e.target.value)}>
              <option value="">No fabric (rigid)</option>
              {fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        </div>
        {region && (
          <div className={s.fieldsGrid}>
            {fields.map((f) => (
              <label key={f.key} className={s.field}>
                <span className={s.label}>{f.label}</span>
                <input className={s.input} type="number" inputMode="decimal" value={body[f.key] ?? ''} placeholder="—"
                  onChange={(e) => setBody((b) => ({ ...b, [f.key]: e.target.value }))} />
              </label>
            ))}
          </div>
        )}
        <Button variant="primary" onClick={run} state={running ? 'loading' : 'default'}><UilBolt size={16} /> Generate spec</Button>
      </div>

      {/* The printable sheet */}
      <div className={s.sheet}>
        <div className={s.sheetHead}>
          <div>
            <div className={s.brand}>Zavestro · Cut sheet</div>
            <h2 className={s.sheetTitle}>{design.name}</h2>
            <div className={s.sub}>{typeLine}{design.gender ? ` · ${design.gender}` : ''}</div>
          </div>
          <div className={s.sheetMeta}>
            <div><span className={s.metaK}>Fit</span> {preset || '—'}</div>
            <div><span className={s.metaK}>Fabric</span> {fabric ? `${fabric.name}${fabric.code ? ` (${fabric.code})` : ''}` : '—'}</div>
            {fabric && (Number(fabric.stretch_pct ?? 0) > 0 || Number(fabric.shrinkage_pct ?? 0) > 0) && (
              <div><span className={s.metaK}>Fabric fit</span> stretch {Number(fabric.stretch_pct ?? 0)}% · shrink {Number(fabric.shrinkage_pct ?? 0)}%</div>
            )}
          </div>
        </div>

        {!result ? (
          /* [KA10-7] A cut sheet with no measurements must SAY it is not a cut
             sheet. This printed "Generate the spec above — …" onto A4: a click
             instruction, on paper, where the POM table should be, with nothing on
             the page marking it incomplete. The cutter received a document whose
             only purpose is to carry numbers to a cutting table, at full
             confidence, carrying a placeholder. The screen keeps the instruction
             (there IS an "above" on screen); the PAPER gets the warning. */
          <>
            <div className={s.incompleteStamp}>INCOMPLETE — DO NOT CUT</div>
            <p className={s.empty}>
              Generate the spec above — the finished measurements + QC band will appear here,
              ready to print.
            </p>
          </>
        ) : (
          <>
            <table className={s.specTable}>
              <thead><tr><th>Measurement</th><th>Finished (in)</th><th>QC band (±)</th></tr></thead>
              <tbody>
                {Object.entries(result.spec).map(([k, v]) => {
                  const tol = Number(tolerances[k] ?? 0);
                  return (
                    <tr key={k}>
                      <td>{k.replace(/_/g, ' ')}</td>
                      <td>{v}</td>
                      <td>{tol > 0 ? `${round(v - tol)} – ${round(v + tol)}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className={s.bodyUsed}>
              <span className={s.metaK}>Body used</span>{' '}
              {Object.entries(body).filter(([, v]) => v.trim() !== '').map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ') || '—'}
            </div>
          </>
        )}

        <div className={s.notes}>
          <div className={s.note}><strong>Seam allowance:</strong> {Number(tpl.seam_allowance_cm ?? 1)} cm on seams · {Number(tpl.hem_allowance_cm ?? 4)} cm on hems — add to the net pattern (these are finished measurements).</div>
          {techPackUrl
            ? <div className={s.note}><strong>Tech pack:</strong> <a href={techPackUrl} target="_blank" rel="noreferrer">{design.spec_sheet_key}</a></div>
            : <div className={s.note}><strong>Tech pack:</strong> none attached to this design.</div>}
          <div className={s.note}><strong>Fabric pairings:</strong> {design.fabrics.map((f) => f.name).join(', ') || '—'}</div>
        </div>
      </div>
      </>
      )}
    </Modal>
  );
};

export default CutSheetModal;
