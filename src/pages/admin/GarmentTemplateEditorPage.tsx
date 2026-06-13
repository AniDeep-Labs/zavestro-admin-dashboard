import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { designsApi } from '../../api/adminApi';
import type { ChartRow, GarmentTemplate } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import base from './OrdersListPage.module.css';
import s from './GarmentTemplateEditorPage.module.css';
import { UilArrowLeft, UilTimes, UilPlus } from '@iconscout/react-unicons';

const BASE = '__base__';
type PainRow = { tag: string; field: string; delta: string };

// Snapshot of the editable state — drives the dirty indicator (compare to load).
const snap = (
  captureSet: string[], presets: string[], chart: ChartRow[], pains: PainRow[],
) => JSON.stringify({ captureSet, presets, chart, pains });

export const GarmentTemplateEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tpl, setTpl] = React.useState<GarmentTemplate | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const [fields, setFields] = React.useState<string[]>([]);
  const [presets, setPresets] = React.useState<string[]>([]);
  const [captureSet, setCaptureSet] = React.useState<string[]>([]);
  const [pains, setPains] = React.useState<PainRow[]>([]);
  const [chart, setChart] = React.useState<ChartRow[]>([]);
  const [activePreset, setActivePreset] = React.useState<string>(BASE);

  const [fieldDraft, setFieldDraft] = React.useState('');
  const [presetDraft, setPresetDraft] = React.useState('');
  // Dirty tracking via a load-time snapshot (no per-setter instrumentation).
  const [baseline, setBaseline] = React.useState('');
  const dirty = !loading && baseline !== '' && baseline !== snap(captureSet, presets, chart, pains);
  useDirtyGuard(dirty);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));

  React.useEffect(() => {
    if (!id) return;
    designsApi
      .getTemplate(id)
      .then((t) => {
        setTpl(t);
        const cs = t.capture_set ?? [];
        const fromChart = Array.from(new Set(t.chart.flatMap((r) => Object.keys(r.measurements))));
        setFields(Array.from(new Set([...fromChart, ...cs])));
        setPresets(t.available_fit_presets ?? []);
        setCaptureSet(cs);
        setChart(t.chart);
        const pm = t.pain_point_menu ?? {};
        const loadedPains = Object.entries(pm).flatMap(([tag, fd]) =>
          Object.entries(fd).map(([field, delta]) => ({ tag, field, delta: String(delta) })),
        );
        setPains(loadedPains);
        setBaseline(snap(cs, t.available_fit_presets ?? [], t.chart, loadedPains));
      })
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  // ── field + preset chips ──
  const addField = () => {
    const f = fieldDraft.trim().toLowerCase();
    if (f && !fields.includes(f)) setFields([...fields, f]);
    setFieldDraft('');
  };
  const removeField = (f: string) => {
    setFields(fields.filter((x) => x !== f));
    setCaptureSet(captureSet.filter((x) => x !== f));
    setPains(pains.filter((p) => p.field !== f));
    setChart(chart.map((r) => {
      const m = { ...r.measurements };
      delete m[f];
      return { ...r, measurements: m };
    }));
  };
  const addPreset = () => {
    const p = presetDraft.trim().toLowerCase();
    if (p && !presets.includes(p)) setPresets([...presets, p]);
    setPresetDraft('');
  };
  const removePreset = (p: string) => {
    setPresets(presets.filter((x) => x !== p));
    setChart(chart.filter((r) => r.fit_preset !== p));
    if (activePreset === p) setActivePreset(BASE);
  };

  // ── chart grid for the active preset ──
  const presetKey = activePreset === BASE ? null : activePreset;
  const rows = chart.filter((r) => (r.fit_preset ?? BASE) === activePreset);
  const setMeasurement = (sizeLabel: string, field: string, val: string) => {
    setChart((prev) =>
      prev.map((r) => {
        if ((r.fit_preset ?? BASE) !== activePreset || r.size_label !== sizeLabel) return r;
        const m = { ...r.measurements };
        if (val === '') delete m[field];
        else m[field] = Number(val);
        return { ...r, measurements: m };
      }),
    );
  };
  const renameSize = (oldLabel: string, label: string) => {
    setChart((prev) =>
      prev.map((r) =>
        (r.fit_preset ?? BASE) === activePreset && r.size_label === oldLabel
          ? { ...r, size_label: label }
          : r,
      ),
    );
  };
  const addSize = () =>
    setChart([...chart, { fit_preset: presetKey, size_label: '', measurements: {} }]);
  const removeSize = (sizeLabel: string) =>
    setChart(chart.filter((r) => !((r.fit_preset ?? BASE) === activePreset && r.size_label === sizeLabel)));

  // ── pain points ──
  const setPain = (i: number, patch: Partial<PainRow>) =>
    setPains(pains.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const pain_point_menu: Record<string, Record<string, number>> = {};
      for (const p of pains) {
        if (!p.tag.trim() || !p.field || p.delta === '') continue;
        pain_point_menu[p.tag.trim()] = { ...(pain_point_menu[p.tag.trim()] ?? {}), [p.field]: Number(p.delta) };
      }
      const cleanChart = chart
        .filter((r) => r.size_label.trim() && Object.keys(r.measurements).length)
        .map((r) => ({ ...r, size_label: r.size_label.trim() }));
      const saved = await designsApi.saveTemplate(id, {
        capture_set: captureSet,
        pain_point_menu,
        available_fit_presets: presets,
        chart: cleanChart,
      });
      setTpl(saved);
      setBaseline(snap(captureSet, presets, cleanChart, pains)); // clears dirty
      toast('success', 'Template saved');
    } catch (e) {
      toast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className={base.page}><div className={s.center}><Spinner /></div></div>;
  if (!tpl)
    return (
      <div className={base.page}>
        <Link to="/admin/design/templates" className={s.back}><UilArrowLeft size={16} /> Back</Link>
        <div className={s.center}>Garment type not found.</div>
      </div>
    );

  const presetTabs = [BASE, ...presets];

  // Completeness (W-10): an incomplete chart starves the fit engine (G-35 note).
  // Ready = fields defined + ≥1 BASE chart row with measurements.
  const baseRows = chart.filter((r) => r.fit_preset == null || r.fit_preset === BASE || r.fit_preset === '');
  const sizedBaseRows = baseRows.filter((r) => r.size_label.trim() && Object.keys(r.measurements).length).length;
  const ready = fields.length > 0 && sizedBaseRows > 0;

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Link to="/admin/design/templates" className={s.back}><UilArrowLeft size={16} /> Back to templates</Link>
      <div className={s.titleRow}>
        <h1 className={s.title}>{tpl.name} <span className={s.sub}>· template</span></h1>
        {dirty && <span className={s.dirtyBadge}>● Unsaved changes</span>}
      </div>
      {/* Completeness meter — incomplete charts can't drive the engine (G-35). */}
      <div className={`${s.meter} ${ready ? s.meterReady : s.meterIncomplete}`}>
        {ready ? '✓ Ready' : '⚠ Incomplete'} ·{' '}
        {fields.length} field{fields.length === 1 ? '' : 's'} ·{' '}
        {sizedBaseRows} base size{sizedBaseRows === 1 ? '' : 's'} ·{' '}
        {presets.length} fit-preset{presets.length === 1 ? '' : 's'} ·{' '}
        {pains.length} pain-point{pains.length === 1 ? '' : 's'}
        {!ready && (
          <span className={s.meterHint}>
            {fields.length === 0 ? ' — add measurement fields' : ' — add at least one base size with values'}
          </span>
        )}
      </div>

      {/* Measurement fields */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Measurement fields</h3>
        <p className={s.hint}>The dimensions this garment is measured/cut by (e.g. chest, shoulder, sleeve).</p>
        <div className={s.chips}>
          {fields.map((f) => (
            <span key={f} className={s.chip}>{f}
              <button type="button" onClick={() => removeField(f)}><UilTimes size={13} /></button>
            </span>
          ))}
          <input className={s.chipInput} value={fieldDraft} placeholder="add field + Enter"
            onChange={(e) => setFieldDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} onBlur={addField} />
        </div>
      </section>

      {/* Fit presets */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Fit presets</h3>
        <div className={s.chips}>
          {presets.map((p) => (
            <span key={p} className={s.chip}>{p}
              <button type="button" onClick={() => removePreset(p)}><UilTimes size={13} /></button>
            </span>
          ))}
          <input className={s.chipInput} value={presetDraft} placeholder="add preset + Enter"
            onChange={(e) => setPresetDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreset(); } }} onBlur={addPreset} />
        </div>
      </section>

      {/* Size chart (per fit preset) */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Size chart <span className={s.req}>· finished measurements (inches)</span></h3>
        <div className={s.tabs}>
          {presetTabs.map((p) => (
            <button key={p} type="button" className={`${s.tab} ${activePreset === p ? s.tabActive : ''}`} onClick={() => setActivePreset(p)}>
              {p === BASE ? 'Base / any' : p}
            </button>
          ))}
        </div>
        {fields.length === 0 ? (
          <p className={s.hint}>Add measurement fields first.</p>
        ) : (
          <div className={base.tableWrap}>
            <table className={s.chart}>
              <thead><tr><th>Size</th>{fields.map((f) => <th key={f}>{f}</th>)}<th></th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={fields.length + 2} className={base.empty}>No sizes for this fit yet.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i}>
                    <td><input className={s.sizeInput} value={r.size_label} placeholder="e.g. M / 32"
                      onChange={(e) => renameSize(r.size_label, e.target.value)} /></td>
                    {fields.map((f) => (
                      <td key={f}>
                        <input className={s.cell} type="number" step="0.25" value={r.measurements[f] ?? ''}
                          onChange={(e) => setMeasurement(r.size_label, f, e.target.value)} />
                      </td>
                    ))}
                    <td><button type="button" className={s.iconBtn} onClick={() => removeSize(r.size_label)}><UilTimes size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button variant="ghost" onClick={addSize} disabled={fields.length === 0}><UilPlus size={15} /> Add size</Button>
      </section>

      {/* Capture-set */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Agent capture-set</h3>
        <p className={s.hint}>The fields the agent measures at the visit (the rest come from the chart).</p>
        <div className={s.checks}>
          {fields.map((f) => (
            <label key={f} className={s.check}>
              <input type="checkbox" checked={captureSet.includes(f)}
                onChange={(e) => setCaptureSet(e.target.checked ? [...captureSet, f] : captureSet.filter((x) => x !== f))} />
              {f}
            </label>
          ))}
          {fields.length === 0 && <span className={s.hint}>Add fields first.</span>}
        </div>
      </section>

      {/* Pain-point menu */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Pain-point menu <span className={s.req}>· customer tweak → Δ</span></h3>
        {pains.map((p, i) => (
          <div key={i} className={s.painRow}>
            <input className={s.painTag} value={p.tag} placeholder="tag (e.g. sleeve long)" onChange={(e) => setPain(i, { tag: e.target.value })} />
            <span className={s.painArrow}>→</span>
            <select className={s.painField} value={p.field} onChange={(e) => setPain(i, { field: e.target.value })}>
              <option value="">field…</option>
              {fields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input className={s.painDelta} type="number" step="0.25" value={p.delta} placeholder="Δ" onChange={(e) => setPain(i, { delta: e.target.value })} />
            <button type="button" className={s.iconBtn} onClick={() => setPains(pains.filter((_, j) => j !== i))}><UilTimes size={14} /></button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setPains([...pains, { tag: '', field: '', delta: '' }])}><UilPlus size={15} /> Add pain-point</Button>
      </section>

      <div className={s.actionBar}>
        <Button variant="ghost" onClick={() => navigate('/admin/design/templates')}>Cancel</Button>
        <Button variant="primary" state={saving ? 'loading' : 'default'} onClick={save}>Save template</Button>
      </div>
    </div>
  );
};

export default GarmentTemplateEditorPage;
