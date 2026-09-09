import React from 'react';
import { Link } from 'react-router-dom';
import { designsApi, fabricsApi } from '../../api/adminApi';
import { ENTERED, provenanceFor } from '../../constants/provenance';
import { blockOf, DRAFTING_BLOCK_LABELS } from '../../constants/draftingBlock';
import { measurementLabel } from '../../utils/measurements';
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
type FieldDef = { key: string; label: string; required?: boolean; hint?: string };

/**
 * [DSG-13-5 / DSG-13-6] The inputs each DRAFTING BLOCK actually reads.
 *
 * Keyed by block, not by `body_region`, for the same reason [DSG-11-7] gave: the engine
 * routes on the block (three values) while `body_region` has two, so a women's-block
 * garment was being offered the men's anchors. That was worse than the audit recorded — it
 * did not just include fields the engine ignores, it OMITTED every field
 * `buildWomensUpper` requires (bust, waist, hip, length).
 *
 * Every key below is one the corresponding build function reads. Verified against
 * size-engine.ts:
 *   buildTop          — req chest, shoulder; opt neck, sleeve, bicep, shirt_length
 *   buildWomensUpper  — req bust, waist, hip, length; opt underbust
 *   buildBottom       — req usual_size; then inseam OR height_cm; opt waist, hip, thigh,
 *                       knee, calf, ankle
 *
 * What was removed and why it matters: the men's list offered **Waist** and **Height**, and
 * `buildTop` reads neither — waist is computed as `finishedChest − waist_supp`, and height
 * is not a top anchor at all. The audit proved it by running the engine four times and
 * getting an identical finished spec with waist 30 vs 44 and height 150 vs 195. On a
 * CALIBRATION instrument that is the worst possible lie: it invites you to vary a number
 * and shows you that varying it changed nothing, which reads as "the engine ignores your
 * chart" rather than "this box was never wired".
 */
const FIELDS_BY_BLOCK: Record<string, FieldDef[]> = {
  mens_upper: [
    { key: 'chest', label: 'Chest (in)', required: true },
    { key: 'shoulder', label: 'Shoulder (in)', required: true },
    { key: 'sleeve', label: 'Sleeve length (in)' },
    { key: 'bicep', label: 'Bicep / sleeve width (in)' },
    { key: 'neck', label: 'Neck (in)' },
    { key: 'shirt_length', label: 'Garment length (in)' },
  ],
  womens_upper: [
    { key: 'bust', label: 'Bust (in)', required: true },
    { key: 'waist', label: 'Waist (in)', required: true },
    { key: 'hip', label: 'Hip (in)', required: true },
    { key: 'length', label: 'Garment length (in)', required: true },
    {
      key: 'underbust',
      label: 'Underbust (in)',
      hint: 'Drives the bust dart. Without it the dart is 0 and a shaped preset drafts flat.',
    },
  ],
  lower: [
    { key: 'usual_size', label: 'Usual size (e.g. 32)', required: true },
    { key: 'waist', label: 'Waist (in)' },
    { key: 'hip', label: 'Hip (in)' },
    { key: 'thigh', label: 'Thigh (in)' },
    { key: 'knee', label: 'Knee (in)' },
    { key: 'calf', label: 'Calf (in)' },
  ],
};

/**
 * [DSG-13-6] Lower length: a DESIRED inseam, or a body height the engine interpolates the
 * length-by-height bands from.
 *
 * The tester marked `inseam` required and never offered `height_cm`, so the one calibration
 * surface it could not exercise was the length-by-height bands — whose only other test is
 * the template editor's preview. The engine takes either (`buildBottom`: inseam if given,
 * else height_cm), so the tester offers the same choice rather than picking for you.
 */
const LENGTH_SOURCES = [
  {
    key: 'inseam',
    label: 'Measured inseam',
    field: { key: 'inseam', label: 'Length / inseam (in)', required: true } as FieldDef,
    hint: 'The length the customer asked for. Used as given; the bands are not consulted.',
  },
  {
    key: 'height_cm',
    label: 'From body height',
    field: { key: 'height_cm', label: 'Height (cm)', required: true } as FieldDef,
    hint: 'Interpolates the Length-by-height bands authored on this garment type.',
  },
] as const;
type LengthSource = (typeof LENGTH_SOURCES)[number]['key'];

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
  const [enteredFields, setEnteredFields] = React.useState<Set<string>>(new Set());
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
  // [DSG-13-5] The BLOCK decides the anchors, not the region — `blockOf` is the same
  // resolver the template editor uses, so the two consoles cannot disagree about which
  // path a garment drafts on.
  const block = cat ? blockOf(cat) : null;
  // [DSG-13-6] Lower garments choose how the length is arrived at; the engine accepts
  // either, and the bands are only exercised by the height path.
  const [lengthSource, setLengthSource] = React.useState<LengthSource>('inseam');
  const fields = React.useMemo(() => {
    if (!block) return [];
    const base = FIELDS_BY_BLOCK[block] ?? FIELDS_BY_BLOCK.mens_upper;
    if (block !== 'lower') return base;
    const chosen = LENGTH_SOURCES.find((l) => l.key === lengthSource) ?? LENGTH_SOURCES[0];
    // Length sits directly under `usual_size`, where the old required inseam was.
    return [base[0], chosen.field, ...base.slice(1)];
  }, [block, lengthSource]);
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
    setLengthSource('inseam');
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
      // [DSG-11-19] The engine doesn't tag a field the caller supplied — it just echoes it.
      // Labelling an echoed input "not stated" would be its own small lie, so remember what
      // this run actually sent and render those as entered.
      setEnteredFields(
        new Set(
          Object.entries(anchors)
            .filter(([, v]) => v !== undefined && v !== null && Number.isFinite(Number(v)))
            .map(([k]) => k),
        ),
      );
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
                {/* [KA3-14] With most garment types carrying no fit recipe, picking one
                    produced an empty fit list and no explanation — the select offered seven
                    equal choices when only some can actually be tested. It says which. */}
                {cats.map((c) => {
                  const presets = c.calibrated_fit_presets != null
                    ? c.calibrated_fit_presets
                    : (c.available_fit_presets ?? []);
                  const ready = presets.length > 0;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name}{ready ? '' : ' — no fit recipe yet'}
                    </option>
                  );
                })}
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
              <h3 className={s.panelTitle}>
                2 · Enter body measurements
                {/* [DSG-13-5] Name the block being drafted. The anchors below differ by
                    block, and an operator who does not know which one they are testing
                    cannot tell a missing field from an inapplicable one. */}
                {block && <span className={s.blockChip}>{DRAFTING_BLOCK_LABELS[block]}</span>}
              </h3>
              {/* [DSG-13-6] Which way the length is arrived at. Choosing "from height" is
                  the ONLY way to exercise the length-by-height bands — the tester could not
                  reach them at all before, which left the template editor's preview as
                  their only test. */}
              {block === 'lower' && (
                <div className={s.lengthSource} role="group" aria-label="Length source">
                  <span className={s.lengthSourceLabel}>Length from</span>
                  {LENGTH_SOURCES.map((o) => (
                    <label key={o.key} className={s.radio}>
                      <input
                        type="radio"
                        name="length-source"
                        checked={lengthSource === o.key}
                        onChange={() => {
                          // Clear the OTHER length input. `buildBottom` prefers inseam
                          // whenever it is present, so leaving a stale inseam behind would
                          // make "from height" silently not use height — the same
                          // varying-a-number-changes-nothing lie [DSG-13-5] is about.
                          const other = LENGTH_SOURCES.find((x) => x.key !== o.key);
                          if (other) setField(other.field.key, '');
                          setLengthSource(o.key);
                        }}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                  <span className={s.lengthSourceHint}>
                    {LENGTH_SOURCES.find((o) => o.key === lengthSource)?.hint}
                  </span>
                </div>
              )}
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
                      {f.hint && <span className={s.fieldHint}>{f.hint}</span>}
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

          {/* [KA3-13] The whole form — Run included — sits inside `region &&`, so until a
              garment was chosen the page's own empty state promised an action that was not
              on screen anywhere. A control that does not exist cannot tell you why it is
              unavailable; a disabled one can. */}
          {!region && (
            <div className={s.actions}>
              <Button variant="primary" disabled>
                <UilBolt size={16} /> Run engine
              </Button>
              <span className={s.hint}>Choose a garment type above to build a test body.</span>
            </div>
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
                        {/* [DSG-11-19] Where each number came from. A trouser chart has two
                            columns and this table shows seven fields — without this the five
                            the engine invented looked exactly like the two you calibrated. */}
                        <th>Source</th>
                        {hasTolerances && <th className={s.num}>Expected ± </th>}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.spec).map(([k, v]) => {
                        const tol = Number(tols[k] ?? 0);
                        const prov = enteredFields.has(k)
                          ? ENTERED
                          : provenanceFor(result.provenance?.[k]);
                        return (
                          <tr key={k}>
                            {/* [DSG-13-13] Raw engine keys (`leg_opening`) leaked into
                                the one table a designer reads most, while every other
                                surface humanises them. */}
                            <td>{measurementLabel(k)}</td>
                            <td className={`${s.num} ${s.finished}`}>{v}</td>
                            <td>
                              <span
                                className={prov.provisional ? s.provProvisional : s.provSolid}
                                title={prov.detail}
                              >
                                {prov.label}
                              </span>
                            </td>
                            {hasTolerances && (
                              <td className={s.num}>{tol > 0 ? `${round(v - tol)} – ${round(v + tol)}` : '—'}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(() => {
                    const guessed = Object.keys(result.spec).filter(
                      (k) => !enteredFields.has(k) && provenanceFor(result.provenance?.[k]).provisional,
                    );
                    return guessed.length ? (
                      <p className={s.provNote}>
                        <strong>{guessed.length} of {Object.keys(result.spec).length} numbers are not calibrated</strong>{' '}
                        ({guessed.map(measurementLabel).join(', ')}). They come from national-average relations with a ±4cm
                        residual, held as provisional until the sew-test run. Adding those columns to
                        this garment type’s size chart replaces them.
                      </p>
                    ) : null;
                  })()}
                  <p className={s.resultHint}>
                    {hasTolerances ? (
                      /* [DSG-13-10] The band is `garment_categories.tolerances`, which has
                         no reader outside the design plane — QC scores against the QC
                         checklist. The sentence already said so; the bare "[CM-20-4]" at
                         the end of it was an internal finding ID rendered to an operator,
                         the only one in the admin. Replaced with the thing they would
                         actually want: where the real thresholds live. */
                      <>
                        Target measurements after the “{result.fit_preset}” ease (plus any fabric /
                        body-shape). The band is the expected variance authored on this garment type
                        — <strong>it is not what QC judges against</strong>; QC scores a finished
                        garment against the{' '}
                        <Link to="/admin/catalog/qc-templates" className={s.inlineLink}>
                          QC checklist
                        </Link>{' '}
                        for its category.
                      </>
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
