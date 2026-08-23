import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { designsApi } from '../../api/adminApi';
import type { ChartRow, GarmentTemplate, SizePreviewResult, FitPresetDef, LengthBand } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import base from './OrdersListPage.module.css';
import s from './GarmentTemplateEditorPage.module.css';
import { Modal } from '../../components/Modal/Modal';
import { UilArrowLeft, UilTimes, UilPlus, UilCalculatorAlt, UilImport } from '@iconscout/react-unicons';

const BASE = '__base__';
// Body anchors the engine preview asks for, per body region (G-81).
const ANCHOR_FIELDS: Record<string, string[]> = {
  lower: ['usual_size', 'height_cm', 'waist', 'hip'],
  upper: ['chest', 'shoulder', 'height_cm', 'sleeve', 'neck', 'bicep'],
};
// Standard measurement fields per body region — the "Fill standard" helper for blank /
// under-configured templates (mirrors the backend pre-seed for new types).
const STANDARD_FIELDS: Record<string, string[]> = {
  upper: ['chest', 'shoulder', 'sleeve', 'neck', 'bicep', 'waist'],
  lower: ['waist', 'hip', 'thigh', 'knee', 'calf', 'inseam'],
};
// Clean labels for the preview anchors (auto-humanising gives ugly "Height Cm").
const ANCHOR_LABELS: Record<string, string> = {
  usual_size: 'Usual size',
  height_cm: 'Height (cm)',
  waist: 'Waist',
  hip: 'Hip',
  chest: 'Chest',
  shoulder: 'Shoulder',
  sleeve: 'Sleeve',
  neck: 'Neck',
  bicep: 'Bicep',
};
// The preset CONSTANTS the designer defines per body region — these are exactly
// the ease fields the engine reads (TopFitParams / BottomFitParams). The engine
// computes finished = body measurement + ease.
// `floor` mirrors UPPER_EASE_FLOORS in the backend (src/ops/upper-ease-floors.ts). Some ease
// is a fact about bodies rather than an opinion about fit: a collar at the exact neck girth
// cannot be buttoned, a sleeve at the exact bicep girth cannot be bent into. The engine applies
// these regardless of what is typed, so the editor says so rather than letting a designer
// believe a number that will not be used.
const PRESET_PARAM_FIELDS: Record<string, { key: string; label: string; hint: string; floor?: number }[]> = {
  upper: [
    { key: 'chest_ease', label: 'Chest ease', hint: 'roominess added across the chest' },
    { key: 'waist_supp', label: 'Waist suppression', hint: 'how much to take IN at the waist (more = more fitted)' },
    { key: 'hem_supp', label: 'Hem suppression', hint: 'how much to taper the bottom hem' },
    { key: 'shoulder_ease', label: 'Shoulder ease', hint: 'extra across the shoulders' },
    { key: 'sleeve_ease', label: 'Sleeve ease', hint: 'extra sleeve length' },
    { key: 'neck_ease', label: 'Neck ease', hint: 'extra room at the neck', floor: 0.5 },
    { key: 'bicep_ease', label: 'Bicep ease', hint: 'extra sleeve width at the bicep', floor: 1 },
  ],
  lower: [
    { key: 'thigh_ease', label: 'Thigh ease', hint: 'roominess added at the thigh' },
    { key: 'knee_ease', label: 'Knee ease', hint: 'roominess at the knee' },
    { key: 'hip_ease', label: 'Hip ease', hint: 'roominess at the seat / hip' },
    { key: 'waist_ease', label: 'Waist ease', hint: 'roominess added at the waist' },
    { key: 'hem_vs_knee', label: 'Leg opening vs knee', hint: 'hem width relative to the knee (− tapered, + flared)' },
  ],
};
// Starter values when a designer adds a preset — tuned by the preset name so
// "slim/regular/relaxed" begin sensibly different (designer then tweaks).
function defaultPresetParams(region: string, name: string): Record<string, number> {
  const n = name.toLowerCase();
  if (region === 'lower') {
    if (n.includes('skinny') || n.includes('slim'))
      return { thigh_ease: 1.0, knee_ease: 0.5, hip_ease: 1.0, waist_ease: 0.5, hem_vs_knee: -2.0 };
    if (n.includes('loose') || n.includes('relax'))
      return { thigh_ease: 2.5, knee_ease: 1.5, hip_ease: 2.5, waist_ease: 1.5, hem_vs_knee: 1.5 };
    return { thigh_ease: 1.5, knee_ease: 1.0, hip_ease: 1.5, waist_ease: 1.0, hem_vs_knee: -0.5 };
  }
  if (n.includes('slim'))
    return { chest_ease: 3, waist_supp: 5, hem_supp: 4, shoulder_ease: 0, sleeve_ease: 0, neck_ease: 0.5, bicep_ease: 1 };
  if (n.includes('relax') || n.includes('loose'))
    return { chest_ease: 8, waist_supp: 1, hem_supp: 0, shoulder_ease: 1.5, sleeve_ease: 1, neck_ease: 1, bicep_ease: 3.5 };
  return { chest_ease: 5, waist_supp: 3, hem_supp: 2, shoulder_ease: 0.5, sleeve_ease: 0.5, neck_ease: 0.5, bicep_ease: 2 };
}
type PainRow = { tag: string; field: string; delta: string };
type ShapeRow = { shape: string; field: string; delta: string };
// Standard body-shape catalog (deltas "at full"; applied at intensity). References
// the engine's output fields. One-click starter the designer then tweaks.
const STANDARD_SHAPES: Record<string, { shape: string; field: string; delta: number }[]> = {
  upper: [
    { shape: 'belly', field: 'waist', delta: 4 }, { shape: 'belly', field: 'hem', delta: 3 },
    { shape: 'athletic (V-taper)', field: 'waist', delta: -2 },
    { shape: 'broad shoulders', field: 'shoulder', delta: 1 },
  ],
  lower: [
    { shape: 'belly', field: 'waist', delta: 3 }, { shape: 'belly', field: 'hip', delta: 1 },
    { shape: 'full seat', field: 'hip', delta: 2 },
    { shape: 'athletic thigh', field: 'thigh', delta: 1.5 },
  ],
};

// Grade-rule starter values (India-anchored body measurements, inches) — base value
// at the base size + how much the field grows per size step. Editable by the designer.
const GRADE_DEFAULTS: Record<string, Record<string, { base: number; inc: number }>> = {
  lower: {
    waist: { base: 32, inc: 2 }, hip: { base: 40, inc: 2 }, thigh: { base: 22.5, inc: 1 },
    knee: { base: 16, inc: 0.6 }, rise: { base: 11, inc: 0.25 },
  },
  upper: {
    chest: { base: 40, inc: 2 }, shoulder: { base: 17.5, inc: 0.5 }, waist: { base: 36, inc: 2 },
    neck: { base: 15.5, inc: 0.5 }, sleeve: { base: 24.5, inc: 0.5 }, hem: { base: 40, inc: 2 },
  },
};
const DEFAULT_SIZES: Record<string, string> = { lower: '28,30,32,34,36,38,40', upper: '36,38,40,42,44,46' };
// India-anchored inseam-by-height starter bands (cm → inches). Editable.
const DEFAULT_LENGTH_BANDS: LengthBand[] = [
  { length_field: 'inseam', height_min_cm: 160, length_value: 29.5 },
  { length_field: 'inseam', height_min_cm: 168, length_value: 31 },
  { length_field: 'inseam', height_min_cm: 176, length_value: 32.5 },
  { length_field: 'inseam', height_min_cm: 184, length_value: 34 },
  { length_field: 'inseam', height_min_cm: 191, length_value: 35.5 },
];

// Snapshot of the editable state — drives the dirty indicator (compare to load).
const snap = (
  captureSet: string[], presetDefs: FitPresetDef[], chart: ChartRow[], pains: PainRow[], types: string[], bands: LengthBand[], shapes: ShapeRow[], tol: Record<string, string>, seam: { seam: string; hem: string },
) => JSON.stringify({ captureSet, presetDefs, chart, pains, types, bands, shapes, tol, seam });

export const GarmentTemplateEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tpl, setTpl] = React.useState<GarmentTemplate | null>(null);
  useBreadcrumbTitle(tpl?.name);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const [fields, setFields] = React.useState<string[]>([]);
  const [presetDefs, setPresetDefs] = React.useState<FitPresetDef[]>([]);
  const presets = presetDefs.map((p) => p.fit_preset); // names — drives chart tabs + preview
  const [captureSet, setCaptureSet] = React.useState<string[]>([]);
  const [pains, setPains] = React.useState<PainRow[]>([]);
  const [shapes, setShapes] = React.useState<ShapeRow[]>([]);
  const [tolerances, setTolerances] = React.useState<Record<string, string>>({}); // field → ±
  const [seamAllow, setSeamAllow] = React.useState<{ seam: string; hem: string }>({ seam: '', hem: '' });
  const [chart, setChart] = React.useState<ChartRow[]>([]);
  const [garmentTypes, setGarmentTypes] = React.useState<string[]>([]);
  const [lengthBands, setLengthBands] = React.useState<LengthBand[]>([]);
  const [activePreset, setActivePreset] = React.useState<string>(BASE);

  const [fieldDraft, setFieldDraft] = React.useState('');
  const [presetDraft, setPresetDraft] = React.useState('');
  const [typeDraft, setTypeDraft] = React.useState('');
  // ── W-D2: paste / CSV import (migrate a known Excel chart in one shot) ──
  const [showImport, setShowImport] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  // ── grade-rule generator (auto-build the size chart) ──
  const [showGrade, setShowGrade] = React.useState(false);
  const [gradeSizes, setGradeSizes] = React.useState('');
  const [gradeBase, setGradeBase] = React.useState('');
  const [gradeRules, setGradeRules] = React.useState<Record<string, { base: string; below: string; above: string }>>({});
  const [note, setNote] = React.useState(''); // "what changed" → audit (FABLE §4C)
  // G-81 engine preview — validate this chart against a sample body.
  const [pvPreset, setPvPreset] = React.useState('');
  const [pvAnchors, setPvAnchors] = React.useState<Record<string, string>>({});
  const [pvResult, setPvResult] = React.useState<SizePreviewResult | null>(null);
  const [pvBusy, setPvBusy] = React.useState(false);
  // Dirty tracking via a load-time snapshot (no per-setter instrumentation).
  const [baseline, setBaseline] = React.useState('');
  const dirty = !loading && baseline !== '' && baseline !== snap(captureSet, presetDefs, chart, pains, garmentTypes, lengthBands, shapes, tolerances, seamAllow);
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
        // Preset DEFINITIONS (name + ease constants). Backend returns one per name —
        // legacy names with no params come back with empty params for the designer to fill.
        const defs: FitPresetDef[] =
          t.fit_presets ?? (t.available_fit_presets ?? []).map((fp) => ({ fit_preset: fp, params: {} }));
        setPresetDefs(defs);
        setCaptureSet(cs);
        setChart(t.chart);
        const types = t.garment_types ?? [];
        setGarmentTypes(types);
        const bands = t.length_bands ?? [];
        setLengthBands(bands);
        const pm = t.pain_point_menu ?? {};
        const loadedPains = Object.entries(pm).flatMap(([tag, fd]) =>
          Object.entries(fd).map(([field, delta]) => ({ tag, field, delta: String(delta) })),
        );
        setPains(loadedPains);
        const bsm = t.body_shape_menu ?? {};
        const loadedShapes = Object.entries(bsm).flatMap(([shape, fd]) =>
          Object.entries(fd).map(([field, delta]) => ({ shape, field, delta: String(delta) })),
        );
        setShapes(loadedShapes);
        const tol: Record<string, string> = {};
        for (const [field, v] of Object.entries(t.tolerances ?? {})) tol[field] = String(v);
        setTolerances(tol);
        const seam = {
          seam: t.seam_allowance_cm != null ? String(t.seam_allowance_cm) : '',
          hem: t.hem_allowance_cm != null ? String(t.hem_allowance_cm) : '',
        };
        setSeamAllow(seam);
        setBaseline(snap(cs, defs, t.chart, loadedPains, types, bands, loadedShapes, tol, seam));
      })
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  // ── field + preset chips ──
  const fillStandardFields = () => {
    const std = STANDARD_FIELDS[tpl?.body_region ?? ''] ?? [];
    if (std.length === 0) return;
    setFields((prev) => Array.from(new Set([...prev, ...std])));
    setCaptureSet((prev) => Array.from(new Set([...prev, ...std])));
  };
  const addField = () => {
    const f = fieldDraft.trim().toLowerCase();
    if (f && !fields.includes(f)) setFields([...fields, f]);
    setFieldDraft('');
  };
  // T2-39 (§3.3): removing a field must clean EVERY structure that references it, or orphaned
  // deltas / QC-bands / length rows survive and mis-drive the engine. Audited the full state:
  // fields, capture set, pains, chart cells, shape deltas (ShapeRow.field), tolerance QC-bands
  // (keyed by field), and length bands (LengthBand.length_field). Preset params (ease params
  // like chest_ease) and seam allowances are NOT field-keyed, so they're left alone.
  const removeField = (f: string) => {
    setFields(fields.filter((x) => x !== f));
    setCaptureSet(captureSet.filter((x) => x !== f));
    setPains(pains.filter((p) => p.field !== f));
    setChart(chart.map((r) => {
      const m = { ...r.measurements };
      delete m[f];
      return { ...r, measurements: m };
    }));
    setShapes(shapes.filter((s) => s.field !== f)); // orphan body-shape deltas
    setTolerances((prev) => {
      const t = { ...prev };
      delete t[f]; // orphan QC band
      return t;
    });
    setLengthBands(lengthBands.filter((b) => b.length_field !== f)); // orphan length rows
  };
  const addPreset = () => {
    const p = presetDraft.trim().toLowerCase();
    if (p && !presets.includes(p)) {
      const region = tpl?.body_region ?? 'upper';
      setPresetDefs([...presetDefs, { fit_preset: p, params: defaultPresetParams(region, p) }]);
    }
    setPresetDraft('');
  };
  const removePreset = (p: string) => {
    setPresetDefs(presetDefs.filter((x) => x.fit_preset !== p));
    setChart(chart.filter((r) => r.fit_preset !== p));
    if (activePreset === p) setActivePreset(BASE);
  };
  const setPresetParam = (name: string, key: string, value: string) => {
    setPresetDefs(
      presetDefs.map((d) => {
        if (d.fit_preset !== name) return d;
        const params = { ...d.params };
        if (value.trim() === '') delete params[key];
        else params[key] = Number(value);
        return { ...d, params };
      }),
    );
  };

  // ── grade-rule generator ──
  const openGrade = () => {
    const region = tpl?.body_region ?? 'upper';
    const defs = GRADE_DEFAULTS[region] ?? GRADE_DEFAULTS.upper;
    const rules: Record<string, { base: string; below: string; above: string }> = {};
    for (const f of fields) {
      const d = defs[f];
      rules[f] = {
        base: d ? String(d.base) : '',
        below: d ? String(d.inc) : '',
        above: d ? String(d.inc) : '',
      };
    }
    setGradeRules(rules);
    const sizes = gradeSizes || DEFAULT_SIZES[region] || DEFAULT_SIZES.upper;
    setGradeSizes(sizes);
    if (!gradeBase) {
      const arr = sizes.split(',').map((x) => x.trim()).filter(Boolean);
      setGradeBase(arr[Math.floor(arr.length / 2)] ?? '');
    }
    setShowGrade(true);
  };
  const setGradeRule = (field: string, k: 'base' | 'below' | 'above', v: string) =>
    setGradeRules((r) => ({ ...r, [field]: { ...(r[field] ?? { base: '', below: '', above: '' }), [k]: v } }));
  const gradeSizeList = gradeSizes.split(',').map((x) => x.trim()).filter(Boolean);
  const generateChart = () => {
    if (gradeSizeList.length === 0) { toast('error', 'Add at least one size'); return; }
    const baseIdx = Math.max(0, gradeSizeList.indexOf(gradeBase));
    const generated: ChartRow[] = gradeSizeList.map((size, i) => {
      const measurements: Record<string, number> = {};
      for (const f of fields) {
        const r = gradeRules[f];
        if (!r || r.base.trim() === '') continue;
        const base = Number(r.base);
        const inc = i >= baseIdx ? Number(r.above || 0) : Number(r.below || 0);
        const val = base + (i - baseIdx) * inc;
        if (Number.isFinite(val)) measurements[f] = Math.round(val * 100) / 100;
      }
      return { fit_preset: null, size_label: size, measurements };
    });
    // Replace the BASE (body) rows; keep any per-fit-preset chart rows untouched.
    setChart([...chart.filter((r) => r.fit_preset != null), ...generated]);
    setActivePreset(BASE);
    setShowGrade(false);
    toast('success', `Generated ${generated.length} sizes`, 'Review the chart, tweak any cell, then Save.');
  };

  // ── length-by-height bands (G-85) ──
  const addBand = () =>
    setLengthBands([...lengthBands, { length_field: 'inseam', height_min_cm: 0, length_value: 0 }]);
  const removeBand = (i: number) => setLengthBands(lengthBands.filter((_, j) => j !== i));
  const setBand = (i: number, k: 'height_min_cm' | 'length_value', v: string) =>
    setLengthBands(lengthBands.map((b, j) => (j === i ? { ...b, [k]: v === '' ? 0 : Number(v) } : b)));
  const fillDefaultBands = () => setLengthBands(DEFAULT_LENGTH_BANDS.map((b) => ({ ...b })));

  // ── body-shape menu (§5.4) ──
  const setShape = (i: number, patch: Partial<ShapeRow>) =>
    setShapes(shapes.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const fillStandardShapes = () =>
    setShapes(
      (STANDARD_SHAPES[tpl?.body_region ?? 'upper'] ?? STANDARD_SHAPES.upper).map((sh) => ({
        shape: sh.shape, field: sh.field, delta: String(sh.delta),
      })),
    );

  // ── tolerances (§3) — ± allowed deviation per field (QC band) ──
  const setTol = (field: string, v: string) => setTolerances((t) => ({ ...t, [field]: v }));
  const fillStandardTol = () => {
    const t: Record<string, string> = {};
    for (const f of fields) t[f] = '0.5';
    setTolerances(t);
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

  // ── cell-level validation (FABLE §4C: non-numeric/non-positive = error; a value
  // smaller than the size above it in the same column = a likely-typo descending run).
  const cellState = (rowIdx: number, field: string): '' | 'warn' | 'err' => {
    const v = rows[rowIdx]?.measurements[field];
    if (v == null) return '';
    if (Number.isNaN(v) || v <= 0) return 'err';
    for (let k = rowIdx - 1; k >= 0; k--) {
      const pv = rows[k].measurements[field];
      if (pv != null) return v < pv ? 'warn' : '';
    }
    return '';
  };
  // Hard-invalid cells across the whole chart (block save + name the cell).
  const invalidCells = chart
    .filter((r) => r.size_label.trim())
    .flatMap((r) =>
      Object.entries(r.measurements)
        .filter(([, v]) => Number.isNaN(v) || (v as number) <= 0)
        .map(([f]) => ({ size: r.size_label.trim(), field: f })),
    );

  // ── pain points ──
  const setPain = (i: number, patch: Partial<PainRow>) =>
    setPains(pains.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!id) return;
    if (invalidCells.length) {
      const c = invalidCells[0];
      toast('error', 'Fix the highlighted cell', `Size “${c.size}” · ${c.field} must be a positive number.`);
      return;
    }
    setSaving(true);
    try {
      const pain_point_menu: Record<string, Record<string, number>> = {};
      for (const p of pains) {
        if (!p.tag.trim() || !p.field || p.delta === '') continue;
        pain_point_menu[p.tag.trim()] = { ...(pain_point_menu[p.tag.trim()] ?? {}), [p.field]: Number(p.delta) };
      }
      const body_shape_menu: Record<string, Record<string, number>> = {};
      for (const sh of shapes) {
        if (!sh.shape.trim() || !sh.field || sh.delta === '') continue;
        body_shape_menu[sh.shape.trim()] = { ...(body_shape_menu[sh.shape.trim()] ?? {}), [sh.field]: Number(sh.delta) };
      }
      const cleanChart = chart
        .filter((r) => r.size_label.trim() && Object.keys(r.measurements).length)
        .map((r) => ({ ...r, size_label: r.size_label.trim() }));
      const tolerancesOut: Record<string, number> = {};
      for (const [field, v] of Object.entries(tolerances)) {
        if (v !== '' && Number.isFinite(Number(v))) tolerancesOut[field] = Number(v);
      }
      // [FIT-74] A cleared box must not persist as an ABSENT key.
      //
      // `setPresetParam` deletes the key while the box is empty — it has to, or a designer
      // could not clear a field to retype it. The bug was that the deletion survived the save:
      // the engine reads a missing key as zero, so a blank box and a deliberate 0 became the
      // same stored row, and the sensible starter value the editor had supplied vanished with
      // no trace that anything had been dropped.
      //
      // The live data still shows it. All three shirt presets hold exactly this editor's first
      // three starter values and none of its four POM eases — three presets x three matching
      // numbers is not coincidence. That is how every collar in the product came to be cut to
      // the exact girth of the neck it goes around.
      //
      // So the save makes every field explicit. What is stored is now what the designer can
      // see, and "I meant zero" and "I did not fill this in" can no longer produce the same row.
      const presetFields = (PRESET_PARAM_FIELDS[tpl?.body_region ?? 'upper'] ?? []).map((f) => f.key);
      const explicitPresetDefs = presetDefs.map((d) => {
        const params = { ...d.params };
        for (const key of presetFields) if (params[key] === undefined) params[key] = 0;
        return { ...d, params };
      });
      const saved = await designsApi.saveTemplate(id, {
        capture_set: captureSet,
        pain_point_menu,
        body_shape_menu,
        tolerances: tolerancesOut,
        seam_allowance_cm: seamAllow.seam.trim() !== '' ? Number(seamAllow.seam) : undefined,
        hem_allowance_cm: seamAllow.hem.trim() !== '' ? Number(seamAllow.hem) : undefined,
        available_fit_presets: presets,
        fit_presets: explicitPresetDefs,
        garment_types: garmentTypes,
        length_bands: lengthBands,
        chart: cleanChart,
        note: note.trim() || undefined,
      });
      setTpl(saved);
      setPresetDefs(explicitPresetDefs);
      setBaseline(snap(captureSet, explicitPresetDefs, cleanChart, pains, garmentTypes, lengthBands, shapes, tolerances, seamAllow)); // clears dirty
      setNote('');
      toast('success', 'Template saved');
    } catch (e) {
      toast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!tpl) return;
    if (!pvPreset) {
      toast('error', 'Pick a fit preset to preview');
      return;
    }
    setPvBusy(true);
    setPvResult(null);
    try {
      const anchors: Record<string, number> = {};
      for (const [k, v] of Object.entries(pvAnchors)) {
        const n = Number(v);
        if (v !== '' && !Number.isNaN(n)) anchors[k] = n;
      }
      const r = await designsApi.sizePreview({
        garment_category_slug: tpl.slug,
        fit_preset: pvPreset,
        ...anchors,
      });
      setPvResult(r);
    } catch (e) {
      toast('error', 'Preview failed', e instanceof Error ? e.message : undefined);
    } finally {
      setPvBusy(false);
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
  const paramFields = PRESET_PARAM_FIELDS[tpl.body_region ?? 'upper'] ?? PRESET_PARAM_FIELDS.upper;

  // Completeness (W-10): an incomplete chart starves the fit engine (G-35 note).
  // Ready = fields defined + ≥1 BASE chart row with measurements.
  const baseRows = chart.filter((r) => r.fit_preset == null || r.fit_preset === BASE || r.fit_preset === '');
  const sizedBaseRows = baseRows.filter((r) => r.size_label.trim() && Object.keys(r.measurements).length).length;
  const ready = fields.length > 0 && sizedBaseRows > 0;
  // #3: for lower garments the inseam comes from the Length-by-height bands, not the size
  // chart — so drop it from the chart columns (it would just sit there empty & confuse).
  const lengthField =
    (tpl?.body_region ?? '') === 'lower'
      ? lengthBands.find((b) => b.length_field)?.length_field || 'inseam'
      : null;
  const chartFields = lengthField ? fields.filter((f) => f !== lengthField) : fields;

  // W-D2: parse a pasted Excel/CSV block into chart rows for the ACTIVE fit preset. First row =
  // header (first cell = the size column, rest = measurement-field names). Each following row =
  // size label + numbers. Tab-delimited (Excel paste) or comma. Unmatched columns are ignored.
  const importChart = () => {
    const text = importText.trim();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      toast('error', 'Nothing to import', 'Paste a header row plus at least one size row.');
      return;
    }
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
    const headerCols = lines[0].split(delim).slice(1).map((h) => h.trim());
    const fieldForCol = headerCols.map((c) => chartFields.find((f) => norm(f) === norm(c)) ?? null);
    const matchedCount = fieldForCol.filter(Boolean).length;
    if (matchedCount === 0) {
      toast('error', 'No columns matched', `Header names must match this template's fields: ${chartFields.join(', ')}.`);
      return;
    }
    const newRows: ChartRow[] = [];
    for (let li = 1; li < lines.length; li++) {
      const cells = lines[li].split(delim).map((c) => c.trim());
      const size = cells[0];
      if (!size) continue;
      const measurements: Record<string, number> = {};
      fieldForCol.forEach((field, ci) => {
        if (!field) return;
        const raw = cells[ci + 1];
        if (raw == null || raw === '') return;
        const n = Number(raw);
        if (Number.isFinite(n)) measurements[field] = n;
      });
      newRows.push({ fit_preset: presetKey, size_label: size, measurements });
    }
    if (newRows.length === 0) {
      toast('error', 'No size rows found', 'Each row needs a size label in the first column.');
      return;
    }
    // Replace only the active preset's rows (other presets untouched) — like Generate.
    setChart([...chart.filter((r) => (r.fit_preset ?? BASE) !== activePreset), ...newRows]);
    setShowImport(false);
    setImportText('');
    const unmatched = headerCols.length - matchedCount;
    toast('success', `Imported ${newRows.length} sizes`, unmatched > 0 ? `${unmatched} unmatched column(s) ignored.` : 'Review the chart, then Save.');
  };

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Link to="/admin/design/templates" className={s.back}><UilArrowLeft size={16} /> Back to templates</Link>
      <div className={s.titleRow}>
        <h1 className={s.title}>
          {tpl.name} <span className={s.sub}>· fit recipe</span>
          {tpl.body_region && <span className={s.regionChip}>{tpl.body_region} body · locked</span>}
        </h1>
        {dirty && <span className={s.dirtyBadge}>● Unsaved changes</span>}
      </div>
      <p className={s.intro}>
        This is the <strong>fit recipe</strong> for {tpl.name}. The engine builds every customer's garment as{' '}
        <strong>finished&nbsp;=&nbsp;their body measurement&nbsp;+&nbsp;the fit's ease</strong>. Here you set the{' '}
        <strong>size chart</strong> (body measurements per size), the <strong>ease for each fit</strong> (slim / regular / relaxed),
        and which fields the agent measures. Every design of type “{tpl.name}” inherits all of this.
      </p>
      <div className={base.twoCol}>
        <div className={base.main}>

      <h2 className={s.groupHeader}>1 · What you make</h2>

      {/* Cuts — the specific makes within this garment type (all share its fit recipe) */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Cuts</h3>
        <p className={s.hint}>The specific makes within {tpl.name} (e.g. for Trouser: chino, cargo, formal). A design picks one cut; they all share this fit recipe.</p>
        <div className={s.chips}>
          {garmentTypes.map((t) => (
            <span key={t} className={s.chip}>{t}
              <button type="button" onClick={() => setGarmentTypes(garmentTypes.filter((x) => x !== t))}><UilTimes size={13} /></button>
            </span>
          ))}
          <input
            className={s.chipInput}
            value={typeDraft}
            placeholder="add a cut + Enter"
            onChange={(e) => setTypeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const t = typeDraft.trim();
                if (t && !garmentTypes.includes(t)) setGarmentTypes([...garmentTypes, t]);
                setTypeDraft('');
              }
            }}
          />
        </div>
      </section>

      <h2 className={s.groupHeader}>2 · Measurements</h2>

      {/* Measurement fields */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <h3 className={s.sectionTitle}>Measurement fields</h3>
          {(tpl.body_region === 'upper' || tpl.body_region === 'lower') && (
            <Button variant="ghost" onClick={fillStandardFields}><UilCalculatorAlt size={15} /> Fill standard ({tpl.body_region})</Button>
          )}
        </div>
        <p className={s.hint}>Every body dimension this garment is built from (e.g. chest, shoulder, sleeve). You’ll enter values for each of these, per size, in the size chart below.</p>
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

      {/* What the agent measures — paired with the fields above */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>What the agent measures</h3>
        <p className={s.hint}>Tick which of the measurement fields above the agent actually records on the customer at the visit. The rest are filled in from the size chart using the customer’s usual size.</p>
        <div className={s.checks}>
          {fields.map((f) => (
            <label key={f} className={s.check}>
              <input type="checkbox" checked={captureSet.includes(f)}
                onChange={(e) => setCaptureSet(e.target.checked ? [...captureSet, f] : captureSet.filter((x) => x !== f))} />
              {f}
            </label>
          ))}
          {fields.length === 0 && <span className={s.hint}>Add the measurement fields first.</span>}
        </div>
      </section>

      <h2 className={s.groupHeader}>3 · Sizing</h2>

      {/* Size chart (per fit preset) */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <h3 className={s.sectionTitle}>Size chart <span className={s.req}>· the customer's BODY measurements per size (inches)</span></h3>
          <div className={s.sectionHeadActions}>
            {/* W-D2: migrate a known Excel chart in one paste instead of cell-by-cell. */}
            <Button variant="ghost" onClick={() => { setImportText(''); setShowImport(true); }} disabled={fields.length === 0}>
              <UilImport size={15} /> Paste / import
            </Button>
            <Button variant="ghost" onClick={openGrade} disabled={fields.length === 0}>
              <UilCalculatorAlt size={15} /> Generate from grade rules
            </Button>
          </div>
        </div>
        <p className={s.hint}>
          One row per size, one column per measurement field — all in <strong>inches</strong>. These are the
          <strong> body</strong> measurements, not the finished garment: the engine adds the fit's ease on top.
          Type each by hand, or auto-build the whole chart from a base size + grade rules.
        </p>
        {lengthField && <p className={s.hint}>Note: <strong>{lengthField}</strong> isn’t a column here — it’s set in <strong>Length by height</strong> below.</p>}
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
              <thead><tr><th>Size</th>{chartFields.map((f) => <th key={f}>{f}</th>)}<th></th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={chartFields.length + 2} className={base.empty}>No sizes for this fit yet.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i}>
                    <td><input className={s.sizeInput} value={r.size_label} placeholder="e.g. M / 32"
                      onChange={(e) => renameSize(r.size_label, e.target.value)} /></td>
                    {chartFields.map((f) => {
                      const st = cellState(i, f);
                      return (
                        <td key={f}>
                          <input
                            className={`${s.cell} ${st === 'err' ? s.cellErr : st === 'warn' ? s.cellWarn : ''}`}
                            type="number" step="0.25" value={r.measurements[f] ?? ''}
                            title={st === 'err' ? 'Must be a positive number' : st === 'warn' ? 'Smaller than the size above — check this value' : undefined}
                            onChange={(e) => setMeasurement(r.size_label, f, e.target.value)} />
                        </td>
                      );
                    })}
                    <td><button type="button" className={s.iconBtn} onClick={() => removeSize(r.size_label)}><UilTimes size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button variant="ghost" onClick={addSize} disabled={fields.length === 0}><UilPlus size={15} /> Add size</Button>
      </section>

      {/* Length by height (G-85) — lower garments need this for the inseam */}
      {(tpl.body_region ?? '') === 'lower' && (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h3 className={s.sectionTitle}>Length by height <span className={s.req}>· inseam (inches) at body height (cm)</span></h3>
            <Button variant="ghost" onClick={fillDefaultBands}><UilCalculatorAlt size={15} /> Fill India defaults</Button>
          </div>
          <p className={s.hint}>The engine reads the inseam off the customer's height, interpolating between these points. Lower garments won't preview without at least two bands.</p>
          <table className={s.chart}>
            <thead><tr><th>Height from (cm)</th><th>Inseam (in)</th><th></th></tr></thead>
            <tbody>
              {lengthBands.length === 0 ? (
                <tr><td colSpan={3} className={base.empty}>No bands yet — add rows or fill India defaults.</td></tr>
              ) : lengthBands.map((b, i) => (
                <tr key={i}>
                  <td><input className={s.presetParamInput} type="number" step="1" value={b.height_min_cm || ''} placeholder="168" onChange={(e) => setBand(i, 'height_min_cm', e.target.value)} /></td>
                  <td><input className={s.presetParamInput} type="number" step="0.25" value={b.length_value || ''} placeholder="31" onChange={(e) => setBand(i, 'length_value', e.target.value)} /></td>
                  <td><button type="button" className={s.iconBtn} onClick={() => removeBand(i)}><UilTimes size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="ghost" onClick={addBand}><UilPlus size={15} /> Add band</Button>
        </section>
      )}

      <h2 className={s.groupHeader}>4 · Fit</h2>

      {/* Fit presets — designer-defined ease CONSTANTS the engine adds to the body */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Fit presets <span className={s.req}>· ease the engine adds to the body</span></h3>
        <p className={s.hint}>
          Each preset is a constant. The engine does <strong>finished = body measurement + ease</strong> — e.g. chest 40 + chest-ease 5 = a 45 garment. Define slim / regular / relaxed, then test them in the Engine Tester.
        </p>
        {presetDefs.length === 0 ? (
          <p className={s.hint}>No presets yet — add slim / regular / relaxed below (they start with sensible values you can tweak).</p>
        ) : (
          <div className={s.presetList}>
            {presetDefs.map((d) => (
              <div key={d.fit_preset} className={s.presetRow}>
                <div className={s.presetHead}>
                  <span className={s.presetName}>{d.fit_preset}</span>
                  <button type="button" className={s.presetRemove} onClick={() => removePreset(d.fit_preset)} aria-label={`Remove ${d.fit_preset}`}>
                    <UilTimes size={14} />
                  </button>
                </div>
                <div className={s.presetParams}>
                  {paramFields.map((f) => (
                    <label key={f.key} className={s.presetParam}>
                      <span className={s.presetParamLabel}>{f.label}</span>
                      <span className={s.easeHint}>{f.hint}</span>
                      <span className={s.easeInputWrap}>
                      <input
                        className={s.presetParamInput}
                        type="number"
                        step="0.5"
                        value={d.params[f.key] ?? ''}
                        placeholder="0"
                        onChange={(e) => setPresetParam(d.fit_preset, f.key, e.target.value)}
                      />
                      <span className={s.easeUnit}>in</span>
                      </span>
                      {f.floor !== undefined && Number(d.params[f.key] ?? 0) < f.floor && (
                        <span className={s.easeFloorNote}>
                          the engine applies a {f.floor}in minimum here — a garment cut to the
                          exact body girth at this point cannot be put on
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={s.chips}>
          <input className={s.chipInput} value={presetDraft} placeholder="add a fit (e.g. slim) + Enter"
            onChange={(e) => setPresetDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreset(); } }} />
        </div>
      </section>

      <h2 className={s.groupHeader}>5 · Advanced — optional fine-tuning</h2>
      <details className={s.advanced}>
      <summary>Customer tweaks · body shapes · QC tolerance · seam allowance — most garments don’t need these</summary>

      {/* Pain-point menu */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Customer fit tweaks <span className={s.req}>· optional adjustments a customer can pick (e.g. “sleeve long” → add inches)</span></h3>
        {pains.map((p, i) => (
          <div key={i} className={s.painRow}>
            <input className={s.painTag} value={p.tag} placeholder="tag (e.g. sleeve long)" onChange={(e) => setPain(i, { tag: e.target.value })} />
            <span className={s.painArrow}>→</span>
            <select className={s.painField} value={p.field} onChange={(e) => setPain(i, { field: e.target.value })}>
              <option value="">field…</option>
              {fields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input className={s.painDelta} type="number" step="0.25" value={p.delta} placeholder="± in" onChange={(e) => setPain(i, { delta: e.target.value })} />
            <button type="button" className={s.iconBtn} onClick={() => setPains(pains.filter((_, j) => j !== i))}><UilTimes size={14} /></button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setPains([...pains, { tag: '', field: '', delta: '' }])}><UilPlus size={15} /> Add tweak</Button>
      </section>

      {/* Body shapes (§5.4) — shape class → coordinated deltas "at full", applied at intensity */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <h3 className={s.sectionTitle}>Body shapes <span className={s.req}>· extra room for a body shape (e.g. belly), scaled by how strong it is</span></h3>
          <Button variant="ghost" onClick={fillStandardShapes}><UilCalculatorAlt size={15} /> Fill standard shapes</Button>
        </div>
        <p className={s.hint}>
          So one size fits different body types. Each shape adjusts measurements by the Δ "at full"; the customer's
          intensity (slight / moderate / strong) scales it. Add a row per shape × field — repeat a shape name for multiple fields.
        </p>
        {shapes.map((sh, i) => (
          <div key={i} className={s.painRow}>
            <input className={s.painTag} value={sh.shape} placeholder="shape (e.g. belly)" onChange={(e) => setShape(i, { shape: e.target.value })} />
            <span className={s.painArrow}>→</span>
            <select className={s.painField} value={sh.field} onChange={(e) => setShape(i, { field: e.target.value })}>
              <option value="">field…</option>
              {fields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input className={s.painDelta} type="number" step="0.25" value={sh.delta} placeholder="± in" onChange={(e) => setShape(i, { delta: e.target.value })} />
            <button type="button" className={s.iconBtn} onClick={() => setShapes(shapes.filter((_, j) => j !== i))}><UilTimes size={14} /></button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setShapes([...shapes, { shape: '', field: '', delta: '' }])}><UilPlus size={15} /> Add shape</Button>
      </section>

      {/* Tolerances (§3) — ± allowed deviation per measurement; QC checks the band */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <h3 className={s.sectionTitle}>QC tolerance <span className={s.req}>· how much a finished garment may differ from target, ± inches</span></h3>
          <Button variant="ghost" onClick={fillStandardTol} disabled={fields.length === 0}><UilCalculatorAlt size={15} /> Fill standard (±0.5)</Button>
        </div>
        <p className={s.hint}>The ± a finished garment may vary by at each measurement. QC fails a garment outside the band; the Engine Tester shows it as e.g. chest 45.0 (44.5–45.5).</p>
        {fields.length === 0 ? (
          <p className={s.hint}>Add measurement fields first.</p>
        ) : (
          <table className={s.chart}>
            <thead><tr><th>Measurement</th><th>± tolerance (in)</th></tr></thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f}>
                  <td>{f}</td>
                  <td><input className={s.presetParamInput} type="number" step="0.25" min="0" value={tolerances[f] ?? ''} placeholder="0.5" onChange={(e) => setTol(f, e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Seam allowance — added to the net pattern; printed on the cut sheet */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Seam allowance <span className={s.req}>· added to the net pattern (cm)</span></h3>
        <p className={s.hint}>What the patternmaker adds to each finished edge. Printed on the cut sheet. Defaults: 1 cm seams · 4 cm hems.</p>
        <div className={s.presetParams}>
          <label className={s.presetParam}>
            <span className={s.presetParamLabel}>Seam (cm)</span>
            <input className={s.presetParamInput} type="number" step="0.25" min="0" value={seamAllow.seam} placeholder="1" onChange={(e) => setSeamAllow((x) => ({ ...x, seam: e.target.value }))} />
          </label>
          <label className={s.presetParam}>
            <span className={s.presetParamLabel}>Hem (cm)</span>
            <input className={s.presetParamInput} type="number" step="0.25" min="0" value={seamAllow.hem} placeholder="4" onChange={(e) => setSeamAllow((x) => ({ ...x, hem: e.target.value }))} />
          </label>
        </div>
      </section>
      </details>

      <h2 className={s.groupHeader}>Test it</h2>

      {/* Engine preview (G-81) — validate this chart against a sample body. Read-only:
          runs the chart + fit-preset through the sizing engine, returns the finished spec. */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Preview fit <span className={s.req}>· test this chart against a sample body (engine — read-only)</span></h3>
        <p className={s.hint}>
          Runs the chart + selected fit preset through the sizing engine and shows the finished garment spec —
          sanity-check the calibration before it ships. An error tells you what's missing (body region / preset calibration).
          {lengthField && <> Here <strong>Height (cm)</strong> is used on purpose — it exercises the <strong>Length by height</strong> bands you set above (the agent app captures the length directly).</>}
        </p>
        <div className={s.previewControls}>
          <select className={s.pvSelect} value={pvPreset} onChange={(e) => setPvPreset(e.target.value)}>
            <option value="">Fit preset…</option>
            {presets.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {(ANCHOR_FIELDS[tpl.body_region ?? ''] ?? ['usual_size', 'height_cm', 'chest', 'waist']).map((field) => (
            <label key={field} className={s.pvAnchor}>
              <span>{ANCHOR_LABELS[field] ?? field.replace(/_/g, ' ')}</span>
              <input
                type="number" step="0.25" className={s.cell}
                value={pvAnchors[field] ?? ''}
                onChange={(e) => setPvAnchors((a) => ({ ...a, [field]: e.target.value }))}
              />
            </label>
          ))}
          <Button variant="outline" state={pvBusy ? 'loading' : 'default'} onClick={runPreview}>Preview finished spec</Button>
        </div>
        {pvResult && (
          <div className={s.pvResult}>
            <div className={s.pvResultHead}>{pvResult.garment} · {pvResult.fit_preset} · {pvResult.type}</div>
            <table className={s.chart}>
              <thead><tr><th>Field</th><th>Finished (in)</th></tr></thead>
              <tbody>
                {Object.entries(pvResult.spec).map(([k, v]) => (
                  <tr key={k}><td>{k.replace(/_/g, ' ')}</td><td>{typeof v === 'number' ? v : String(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

        </div>{/* /main */}

        <aside className={s.rail}>
          <div className={`${s.railCard} ${ready ? s.railReady : s.railIncomplete}`}>
            <div className={s.railStatus}>{ready ? '✓ Ready to use' : '⚠ Not ready yet'}</div>
            <ul className={s.railChecklist}>
              <li className={fields.length > 0 ? s.railDone : ''}>
                <span className={s.railTick}>{fields.length > 0 ? '✓' : '○'}</span>
                {fields.length} measurement field{fields.length === 1 ? '' : 's'}
              </li>
              <li className={sizedBaseRows > 0 ? s.railDone : ''}>
                <span className={s.railTick}>{sizedBaseRows > 0 ? '✓' : '○'}</span>
                {sizedBaseRows} size{sizedBaseRows === 1 ? '' : 's'} in the chart
              </li>
              <li className={presets.length > 0 ? s.railDone : ''}>
                <span className={s.railTick}>{presets.length > 0 ? '✓' : '○'}</span>
                {presets.length} fit{presets.length === 1 ? '' : 's'}
              </li>
              <li className={s.railOptional}>
                <span className={s.railTick}>·</span>
                {pains.length} customer tweak{pains.length === 1 ? '' : 's'} <span className={s.railMuted}>(optional)</span>
              </li>
            </ul>
            {!ready && (
              <p className={s.railHint}>
                {fields.length === 0 ? 'Start by adding measurement fields.' : 'Add at least one size row with values.'}
              </p>
            )}
          </div>

          <div className={s.railCard}>
            <div className={s.railCardTitle}>Used by</div>
            <div className={s.railStat}><strong>{tpl.used_by_designs ?? 0}</strong> design{(tpl.used_by_designs ?? 0) === 1 ? '' : 's'}</div>
            <div className={s.railStat}><strong>{tpl.used_by_orders ?? 0}</strong> order{(tpl.used_by_orders ?? 0) === 1 ? '' : 's'} cut to it</div>
            {(tpl.used_by_orders ?? 0) > 0 && <p className={s.railHint}>Chart changes affect future orders only.</p>}
          </div>
        </aside>
      </div>{/* /twoCol */}

      <div className={s.actionBar}>
        <input
          className={s.noteInput}
          value={note}
          maxLength={280}
          placeholder="What changed? (optional — recorded in the audit log)"
          onChange={(e) => setNote(e.target.value)}
        />
        <Button variant="ghost" onClick={() => navigate('/admin/design/templates')}>Cancel</Button>
        <Button variant="primary" state={saving ? 'loading' : 'default'} onClick={save}>Save template</Button>
      </div>

      {/* W-D2: paste an existing Excel/CSV size chart to migrate it in one shot. */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title={`Paste / import size chart — ${activePreset === BASE ? 'Base / any' : activePreset}`} size="lg">
        <p className={s.hint}>
          Paste from Excel or a CSV. First row = a header: the <strong>first column is the size label</strong>, the rest are
          measurement fields. Column names must match this template's fields (<strong>{chartFields.join(', ') || '—'}</strong>) —
          unmatched columns are ignored. This <strong>replaces</strong> the rows for the current fit tab.
        </p>
        <textarea
          className={s.importArea}
          rows={10}
          value={importText}
          placeholder={`Size\t${chartFields.slice(0, 3).join('\t') || 'chest\twaist\thip'}\nS\t36\t30\t38\nM\t38\t32\t40\nL\t40\t34\t42`}
          onChange={(e) => setImportText(e.target.value)}
        />
        <div className={s.gradeActions}>
          <Button variant="ghost" onClick={() => setShowImport(false)}>Cancel</Button>
          <Button variant="primary" onClick={importChart} disabled={!importText.trim()}>Import</Button>
        </div>
      </Modal>

      <Modal open={showGrade} onClose={() => setShowGrade(false)} title="Generate size chart from grade rules" size="lg">
        <p className={s.hint}>
          Set the base size and how much each measurement grows per size step. The engine builds the whole body chart —
          you can tweak any cell afterwards. Starter values are India-anchored; adjust them to your own block. Use
          different below/above steps for non-linear grading (the grade often accelerates at larger sizes).
        </p>
        <div className={s.gradeForm}>
          <label className={s.field}>
            <span className={s.gradeLabel}>Sizes (comma-separated, smallest → largest)</span>
            <input className={s.gradeText} value={gradeSizes} placeholder="28,30,32,34,36,38,40"
              onChange={(e) => setGradeSizes(e.target.value)} />
          </label>
          <label className={s.field}>
            <span className={s.gradeLabel}>Base size (the one you drafted)</span>
            <select className={s.gradeText} value={gradeBase} onChange={(e) => setGradeBase(e.target.value)}>
              {gradeSizeList.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
            </select>
          </label>
          <table className={s.chart}>
            <thead><tr><th>Measurement</th><th>Base value</th><th>−/step (below base)</th><th>+/step (above base)</th></tr></thead>
            <tbody>
              {chartFields.length === 0 ? (
                <tr><td colSpan={4} className={base.empty}>Add measurement fields first.</td></tr>
              ) : chartFields.map((f) => (
                <tr key={f}>
                  <td>{f}</td>
                  <td><input className={s.presetParamInput} type="number" step="0.25" value={gradeRules[f]?.base ?? ''} onChange={(e) => setGradeRule(f, 'base', e.target.value)} /></td>
                  <td><input className={s.presetParamInput} type="number" step="0.25" value={gradeRules[f]?.below ?? ''} onChange={(e) => setGradeRule(f, 'below', e.target.value)} /></td>
                  <td><input className={s.presetParamInput} type="number" step="0.25" value={gradeRules[f]?.above ?? ''} onChange={(e) => setGradeRule(f, 'above', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={s.hint}>This replaces the base (body) size rows; per-fit-preset chart rows are kept. Length (inseam) comes from height bands, not from a size — author those separately.</p>
          <div className={s.gradeActions}>
            <Button variant="ghost" onClick={() => setShowGrade(false)}>Cancel</Button>
            <Button variant="primary" onClick={generateChart} disabled={gradeSizeList.length === 0 || fields.length === 0}>
              Generate {gradeSizeList.length} size{gradeSizeList.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GarmentTemplateEditorPage;
