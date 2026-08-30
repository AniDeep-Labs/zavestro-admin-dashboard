import React from 'react';
import { Link } from 'react-router-dom';
import { designsApi, fabricsApi } from '../../api/adminApi';
import type { GarmentCategoryOption, SizePreviewResult, Fabric } from '../../api/adminApi';
import { PageHeader } from '../../components';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './EngineTesterPage.module.css';
import { UilBolt, UilSave, UilTrashAlt, UilRulerCombined } from '@iconscout/react-unicons';

// The body measurements the engine reads, grouped by body region. Friendly labels
// so a design teammate (not an engineer) knows what to type. Keys MUST match
// SizePreviewInput fields. `required` mirrors what the engine hard-requires, so we
// can validate client-side instead of relying on its 400.
type FieldDef = { key: string; label: string; required?: boolean };
const FIELDS_BY_REGION: Record<string, FieldDef[]> = {
  upper: [
    { key: 'chest', label: 'Chest (in)', required: true },
    { key: 'shoulder', label: 'Shoulder (in)', required: true },
    { key: 'sleeve', label: 'Sleeve length (in)' },
    { key: 'bicep', label: 'Bicep / sleeve width (in)' },
    { key: 'neck', label: 'Neck (in)' },
    { key: 'waist', label: 'Waist (in)' },
    { key: 'height_cm', label: 'Height (cm)' },
  ],
  lower: [
    { key: 'usual_size', label: 'Usual size (e.g. 32)', required: true },
    { key: 'inseam', label: 'Length / inseam (in)', required: true },
    { key: 'waist', label: 'Waist (in)' },
    { key: 'hip', label: 'Hip (in)' },
    { key: 'thigh', label: 'Thigh (in)' },
    { key: 'knee', label: 'Knee (in)' },
  ],
};

type SavedBody = { name: string; body: Record<string, string> };
const BODIES_KEY = 'zav-engine-test-bodies';

function loadBodies(): SavedBody[] {
  try {
    const raw = localStorage.getItem(BODIES_KEY);
    return raw ? (JSON.parse(raw) as SavedBody[]) : [];
  } catch {
    return [];
  }
}

export const EngineTesterPage: React.FC = () => {
  const [cats, setCats] = React.useState<GarmentCategoryOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [catId, setCatId] = React.useState('');
  const [preset, setPreset] = React.useState('');
  const [body, setBody] = React.useState<Record<string, string>>({});
  const [shapeIntensity, setShapeIntensity] = React.useState<Record<string, number>>({});
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [fabricId, setFabricId] = React.useState('');
  const [result, setResult] = React.useState<SizePreviewResult | null>(null);
  // What fabric (if any) was actually folded into the LAST run — so the result meta
  // can say so, rather than the user wondering if the dropdown mattered.
  const [appliedFabric, setAppliedFabric] = React.useState<{ name: string; stretch: number; shrink: number } | null>(null);
  const [running, setRunning] = React.useState(false);
  const [triedRun, setTriedRun] = React.useState(false);
  const [bodies, setBodies] = React.useState<SavedBody[]>(loadBodies);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    designsApi
      .garmentCategories()
      .then(setCats)
      .catch((e) => toast('error', 'Could not load garment types', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    fabricsApi.list({ active: true }).then(setFabrics).catch(() => {});
  }, []);

  const cat = cats.find((c) => c.id === catId) ?? null;
  const region = cat?.body_region ?? null;
  const fields = region ? FIELDS_BY_REGION[region] ?? FIELDS_BY_REGION.upper : [];
  // Presets the engine can actually RUN (garment_fit_preset rows), not the authored
  // column — the two drift (G-83). Fall back to the column only if the field is absent.
  const presets = cat?.calibrated_fit_presets ?? cat?.available_fit_presets ?? [];
  const shapeNames = Object.keys(cat?.body_shape_menu ?? {});

  // When the garment changes, reset the preset to the first one it actually has.
  React.useEffect(() => {
    setResult(null);
    setPreset(presets[0] ?? '');
    setShapeIntensity({});
    setTriedRun(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catId]);

  const setField = (k: string, v: string) => setBody((b) => ({ ...b, [k]: v }));

  const run = async () => {
    setTriedRun(true);
    if (!cat) {
      toast('error', 'Pick a garment type first');
      return;
    }
    if (!region) {
      toast('error', `"${cat.name}" has no body region set`, 'Set its body region in Garment Types first.');
      return;
    }
    if (!preset) {
      toast('error', 'Pick a fit preset', 'This garment has no fit presets calibrated yet.');
      return;
    }
    // Client-side guard: the engine hard-requires certain fields per region. Catch
    // them here with a clear message instead of letting it 400.
    const missing = fields.filter((f) => f.required && (body[f.key] ?? '').trim() === '');
    if (missing.length > 0) {
      toast('error', 'Missing required measurements', `Enter: ${missing.map((f) => f.label.replace(/\s*\(.*\)/, '')).join(', ')}.`);
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const anchors: Record<string, number> = {};
      for (const [k, v] of Object.entries(body)) {
        const n = Number(v);
        if (v.trim() !== '' && !Number.isNaN(n)) anchors[k] = n;
      }
      const body_shapes: Record<string, number> = {};
      for (const [shape, intensity] of Object.entries(shapeIntensity)) {
        if (intensity > 0) body_shapes[shape] = intensity;
      }
      const fabric = fabrics.find((f) => f.id === fabricId);
      const stretch = fabric ? Number(fabric.stretch_pct ?? 0) : 0;
      const shrink = fabric ? Number(fabric.shrinkage_pct ?? 0) : 0;
      const r = await designsApi.sizePreview({
        garment_category_slug: cat.slug,
        fit_preset: preset,
        ...anchors,
        ...(Object.keys(body_shapes).length ? { body_shapes } : {}),
        ...(stretch > 0 ? { stretch_pct: stretch } : {}),
        ...(shrink > 0 ? { shrinkage_pct: shrink } : {}),
      });
      setResult(r);
      setAppliedFabric(fabric ? { name: fabric.name, stretch, shrink } : null);
    } catch (e) {
      // The engine fails loudly with a plain message ("needs chest and shoulder",
      // "no fit preset calibrated") — surface it so the author knows what to fix.
      toast('error', "Engine couldn't compute a fit", e instanceof Error ? e.message : undefined);
    } finally {
      setRunning(false);
    }
  };

  const persist = (next: SavedBody[]) => {
    setBodies(next);
    try {
      localStorage.setItem(BODIES_KEY, JSON.stringify(next));
    } catch {
      /* storage full / disabled — non-fatal */
    }
  };

  const saveBody = () => {
    const filled = Object.values(body).some((v) => v.trim() !== '');
    if (!filled) {
      toast('error', 'Nothing to save', 'Enter some measurements first.');
      return;
    }
    const name = window.prompt('Save these measurements as (e.g. "my body"):')?.trim();
    if (!name) return;
    const next = [...bodies.filter((b) => b.name !== name), { name, body: { ...body } }];
    persist(next);
    toast('success', `Saved "${name}"`, 'Reuse it across garments from the chips above.');
  };

  const applyBody = (b: SavedBody) => {
    setBody({ ...b.body });
    setResult(null);
    toast('info', `Loaded "${b.name}"`);
  };

  const deleteBody = (name: string) => persist(bodies.filter((b) => b.name !== name));

  if (loading) return <div className={base.page}><div className={s.center}><Spinner /></div></div>;

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow="Design · Fit engine"
        title="Engine Tester"
        subtitle="Type in any body's measurements and see the finished garment the fit engine would cut. Use it to sanity-check a chart, or test your own fit before trusting it."
      />

      <div className={s.grid}>
        {/* ── Input panel ── */}
        <div className={s.panel}>
          <h3 className={s.panelTitle}>1 · Pick a garment & fit</h3>
          <div className={s.row}>
            <label className={s.field}>
              <span className={s.label}>Garment type</span>
              <select className={s.select} value={catId} onChange={(e) => setCatId(e.target.value)}>
                <option value="">Select a garment…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              <span className={s.label}>Fit preset</span>
              <select
                className={s.select}
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                disabled={!cat || presets.length === 0}
              >
                {!cat ? (
                  <option value="">Select a garment first</option>
                ) : presets.length === 0 ? (
                  <option value="">No presets calibrated</option>
                ) : (
                  presets.map((p) => <option key={p} value={p}>{p}</option>)
                )}
              </select>
            </label>
          </div>
          <label className={s.field}>
            <span className={s.label}>Fabric (optional — applies its stretch / shrinkage)</span>
            <select className={s.select} value={fabricId} onChange={(e) => setFabricId(e.target.value)}>
              <option value="">No fabric (rigid, no shrink)</option>
              {fabrics.map((f) => {
                const st = Number(f.stretch_pct ?? 0);
                const sh = Number(f.shrinkage_pct ?? 0);
                const tags = [st > 0 ? `stretch ${st}%` : '', sh > 0 ? `shrink ${sh}%` : ''].filter(Boolean).join(' · ');
                return <option key={f.id} value={f.id}>{f.name}{tags ? ` (${tags})` : ''}</option>;
              })}
            </select>
          </label>

          {cat && presets.length === 0 && (
            <div className={s.notice}>
              <strong>"{cat.name}" isn't calibrated yet.</strong> The engine has no fit presets
              for it, so it can't compute a fit. Calibrate a fit (slim / regular / …) in{' '}
              <Link to={`/admin/design/templates/${cat.id}`} className={s.noticeLink}>Garment Types</Link>,
              then come back.
            </div>
          )}

          {region && (
            <>
              <h3 className={s.panelTitle}>2 · Enter body measurements</h3>
              <div className={s.fieldsGrid}>
                {fields.map((f) => {
                  const isMissing = triedRun && !!f.required && (body[f.key] ?? '').trim() === '';
                  return (
                    <label key={f.key} className={s.field}>
                      <span className={s.label}>
                        {f.label}{f.required && <span className={s.reqMark}> *</span>}
                      </span>
                      <input
                        className={`${s.input} ${isMissing ? s.inputMissing : ''}`}
                        type="number"
                        inputMode="decimal"
                        value={body[f.key] ?? ''}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.required ? 'required' : '—'}
                      />
                    </label>
                  );
                })}
              </div>
              {shapeNames.length > 0 && (
                <>
                  <h3 className={s.panelTitle}>3 · Body shape (optional)</h3>
                  <div className={s.fieldsGrid}>
                    {shapeNames.map((shape) => (
                      <label key={shape} className={s.field}>
                        <span className={s.label}>{shape}</span>
                        <select
                          className={s.input}
                          value={String(shapeIntensity[shape] ?? 0)}
                          onChange={(e) => setShapeIntensity((m) => ({ ...m, [shape]: Number(e.target.value) }))}
                        >
                          <option value="0">None</option>
                          <option value="0.33">Slight</option>
                          <option value="0.66">Moderate</option>
                          <option value="1">Strong</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <div className={s.actions}>
                <Button variant="primary" onClick={run} state={running ? 'loading' : 'default'}>
                  <UilBolt size={16} /> Run engine
                </Button>
                <Button variant="ghost" onClick={saveBody}><UilSave size={15} /> Save this body</Button>
              </div>
            </>
          )}

          {!region && cat && (
            <p className={s.warn}>"{cat.name}" has no body region set — set it in Garment Types first.</p>
          )}

          {bodies.length > 0 && (
            <div className={s.saved}>
              <span className={s.savedLabel}>Saved bodies:</span>
              {bodies.map((b) => (
                <span key={b.name} className={s.chip}>
                  <button className={s.chipMain} onClick={() => applyBody(b)} type="button">{b.name}</button>
                  <button className={s.chipX} onClick={() => deleteBody(b.name)} type="button" aria-label={`Delete ${b.name}`}>
                    <UilTrashAlt size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Result panel ── */}
        <div className={`${s.panel} ${s.resultPanel}`}>
          <h3 className={s.panelTitle}>Finished garment spec</h3>
          {!result ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}><UilRulerCombined size={26} /></div>
              <p className={s.emptyText}>
                Pick a garment, enter measurements, and run the engine — the cut-to measurements appear here.
              </p>
            </div>
          ) : (
            (() => {
              const tols = cat?.tolerances ?? {};
              const hasTolerances = Object.keys(result.spec).some((k) => Number(tols[k] ?? 0) > 0);
              const round = (n: number) => Math.round(n * 100) / 100;
              return (
                <>
                  <p className={s.resultMeta}>
                    {result.garment} · {result.fit_preset} · {result.region}
                  </p>
                  {appliedFabric && (appliedFabric.stretch > 0 || appliedFabric.shrink > 0) && (
                    <p className={s.fabricNote}>
                      Adjusted for <strong>{appliedFabric.name}</strong>
                      {appliedFabric.stretch > 0 ? ` · −${appliedFabric.stretch}% ease (stretch)` : ''}
                      {appliedFabric.shrink > 0 ? ` · +${appliedFabric.shrink}% cut (shrink)` : ''}
                    </p>
                  )}
                  <table className={s.specTable}>
                    <thead>
                      <tr>
                        <th>Measurement</th>
                        <th className={s.num}>Finished (in)</th>
                        {hasTolerances && <th className={s.num}>Expected ± </th>}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.spec).map(([k, v]) => {
                        const tol = Number(tols[k] ?? 0);
                        return (
                          <tr key={k}>
                            <td>{k}</td>
                            <td className={`${s.num} ${s.finished}`}>{v}</td>
                            {hasTolerances && (
                              <td className={s.num}>{tol > 0 ? `${round(v - tol)} – ${round(v + tol)}` : '—'}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className={s.resultHint}>
                    {hasTolerances ? (
                      <>Target measurements after the "{result.fit_preset}" ease (plus any fabric / body-shape). The band is the expected variance authored on the garment type — it is not what QC judges against. [CM-20-4]</>
                    ) : (
                      <>Target measurements after the "{result.fit_preset}" ease (plus any fabric / body-shape). No expected-variance band is set for this garment — add one in Garment Types to see it here.</>
                    )}
                  </p>
                </>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

export default EngineTesterPage;
