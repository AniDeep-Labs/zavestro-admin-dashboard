import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { designsApi } from '../../api/adminApi';
import type { ChartRow, GarmentTemplate, SizePreviewResult, FitPresetDef, LengthBand } from '../../api/adminApi';
import { isValidSizeLabel, sizeLabelError } from '../../constants/sizeLabel';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
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
// The cut-sheet spec fields, in the order they are authored. Labels and hints name the
// downstream consumer, because the point of this section is that these numbers LEAVE the
// design plane — the previous version claimed that and was wrong. [DSG-11-8]
const CUTTING_SPEC_FIELDS = [
  { key: 'seam_allowance_cm', label: 'Seam (cm)', hint: 'added to each finished edge', step: '0.25' },
  { key: 'hem_allowance_cm', label: 'Hem (cm)', hint: 'added at the hem', step: '0.25' },
  { key: 'fabric_width_cm', label: 'Fabric width (cm)', hint: 'usable width the marker is laid on', step: '1' },
  { key: 'wastage_factor', label: 'Wastage factor', hint: 'multiplier, e.g. 1.12 = 12% waste', step: '0.01' },
  { key: 'min_fabric_meters', label: 'Min fabric (m)', hint: 'floor on the estimate', step: '0.1' },
  { key: 'max_fabric_meters', label: 'Max fabric (m)', hint: 'ceiling on the estimate', step: '0.1' },
] as const;
type CuttingSpecField = (typeof CUTTING_SPEC_FIELDS)[number]['key'];
const BLANK_SPEC = Object.fromEntries(CUTTING_SPEC_FIELDS.map((f) => [f.key, ''])) as Record<CuttingSpecField, string>;

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
// [FIT-77] The India bands — the ones actually in the database, and the ones INDIA_FINAL
// specifies. Derived here from the backend's own seeds so the arithmetic is inspectable:
//
//   INDIA_FINAL.height_bands_m      154-162, 162-170, 170-178 cm
//   INDIA_FINAL.inseam_band_seeds   [69, 72.5, 76.5] cm  ->  27.2", 28.5", 30.1"
//
// What was here before was a longer, taller Western set (160/168/176/184/191 -> 29.5 ... 35.5)
// that matched neither. One click on "fill default bands" silently replaced the India-anchored
// calibration with it — +1.00" of inseam at India's mean male stature of 165.5cm, and +2.30" at
// 160cm. A designer opening a template and pressing the obvious button re-calibrated the
// product away from its own anchor, and nothing said so.
//
// These numbers are duplicated from `INDIA_FINAL` in the backend
// (`src/ops/india-defaults.ts`). `tests/unit/india-defaults.test.ts` there asserts the seeds
// still convert to exactly these inches and names THIS file if they ever stop.
const DEFAULT_LENGTH_BANDS: LengthBand[] = [
  { length_field: 'inseam', height_min_cm: 154, length_value: 27.2 },
  { length_field: 'inseam', height_min_cm: 162, length_value: 28.5 },
  { length_field: 'inseam', height_min_cm: 170, length_value: 30.1 },
];

// Snapshot of the editable state — drives the dirty indicator (compare to load).
const snap = (
  captureSet: string[], presetDefs: FitPresetDef[], chart: ChartRow[], pains: PainRow[], types: string[], bands: LengthBand[], shapes: ShapeRow[], tol: Record<string, string>, spec: Record<string, string>,
) => JSON.stringify({ captureSet, presetDefs, chart, pains, types, bands, shapes, tol, spec });

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
  // The cut-sheet spec (garment_cutting_specs) — the numbers the tailor actually gets.
  // This used to edit garment_categories.seam_allowance_cm, which no consumer read, so a
  // designer could set 1 cm and the floor would keep cutting 1.5. [DSG-11-8]
  const [cuttingSpec, setCuttingSpec] = React.useState<Record<CuttingSpecField, string>>(BLANK_SPEC);
  // Whether the server had a spec row at all. Null means this type cannot be cut yet.
  const [hasSpec, setHasSpec] = React.useState(true);
  const [qcReality, setQcReality] = React.useState<{ has_template: boolean; check_count: number }>({ has_template: false, check_count: 0 });
  const [chart, setChart] = React.useState<ChartRow[]>([]);
  // [FIT-76] What the chart's numbers ARE. Properties of the whole chart, not of a row.
  //
  // This screen used to ASSERT them in prose — "all in inches", "these are the body
  // measurements" — which is not the same as asking. A designer importing a supplier's
  // centimetre chart, or a finished-garment tech pack, had nowhere to say so, and the engine
  // read every chart as inches-and-body. A sentence in a hint cannot stop that; a control can.
  const [chartUnit, setChartUnit] = React.useState<'in' | 'cm'>('in');
  const [chartBasis, setChartBasis] = React.useState<'body' | 'finished'>('body');
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
  const dirty = !loading && baseline !== '' && baseline !== snap(captureSet, presetDefs, chart, pains, garmentTypes, lengthBands, shapes, tolerances, cuttingSpec);
  useDirtyGuard(dirty);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));

  // [DSG-11-10] ONE hydrate, used on load AND after save.
  //
  // `save()` drops incomplete rows before sending, and the server drops more (bands with
  // height_min_cm ≤ 0 or length_value ≤ 0 are skipped; heights are rounded). The page then
  // recomputed its baseline from LOCAL state and never re-read the response, so a row the
  // server had refused stayed on screen under "no unsaved changes" — and vanished on
  // reload. `addBand` creates exactly such a row: 0 / 0.
  //
  // Re-hydrating from `saved` makes the screen show what was actually persisted. The
  // dropped row disappearing IS the feedback; a save that silently keeps your work only in
  // the browser is worse than one that visibly discards it.
  const hydrate = React.useCallback((t: GarmentTemplate) => {
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
      setChartUnit(t.chart[0]?.unit === 'cm' ? 'cm' : 'in');
      setChartBasis(t.chart[0]?.measurement_basis === 'finished' ? 'finished' : 'body');
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
      const spec = { ...BLANK_SPEC };
      for (const f of CUTTING_SPEC_FIELDS) {
        const v = t.cutting_spec?.[f.key];
        spec[f.key] = v != null ? String(v) : '';
      }
      setCuttingSpec(spec);
      setHasSpec(t.cutting_spec != null);
      setQcReality(t.qc_reality ?? { has_template: false, check_count: 0 });
      setBaseline(snap(cs, defs, t.chart, loadedPains, types, bands, loadedShapes, tol, spec));
    },
    [],
  );

  // [DSG-11-12] A 500 is not a 404.
  //
  // Any failure left `tpl` null and the page rendered "Garment type not found." — the third
  // disguise from the wallet sweep (NEW-18..30): "it's gone, stop looking", when the server
  // merely erred. The designer walks away from a template that exists.
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const loadTemplate = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    designsApi
      .getTemplate(id)
      .then(hydrate)
      .catch((e: unknown) => {
        const status = (e as { status?: number }).status;
        // Only a real 404 means "gone". Everything else is a failure and says so.
        if (status === 404) setNotFound(true);
        else setLoadError(e instanceof Error ? e.message : 'Could not load this garment type.');
      })
      .finally(() => setLoading(false));
  }, [id, hydrate]);

  React.useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

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
  // [DSG-11-11] Removing a preset also removes EVERY chart row authored under it, and
  // becomes permanent on the next save — the server deletes all garment_fit_preset rows
  // and re-inserts only what was sent. That was one unconfirmed click on a small ×, with
  // no count of what went with it and no undo. Ask first, and say what it costs.
  const [presetToRemove, setPresetToRemove] = React.useState<string | null>(null);
  const rowsUnderPreset = (p: string) => chart.filter((r) => r.fit_preset === p).length;
  const removePreset = (p: string) => {
    setPresetDefs(presetDefs.filter((x) => x.fit_preset !== p));
    setChart(chart.filter((r) => r.fit_preset !== p));
    if (activePreset === p) setActivePreset(BASE);
    setPresetToRemove(null);
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
  // [DSG-11-15] Fill the gaps, do not replace the work.
  //
  // These three built a FRESH structure and threw away whatever the designer had authored —
  // no confirm, no undo. `fillStandardFields` right above is the odd one out: it unions with
  // what is already there, which is what "Fill" means everywhere else on this page. Only
  // the two chart builders (Generate / Import) say they replace, and they say so.
  //
  // Keyed on what makes a row the same row, so a hand-tuned value survives a second click.
  const fillDefaultBands = () =>
    setLengthBands((prev) => {
      const seen = new Set(prev.map((b) => `${b.length_field}@${b.height_min_cm}`));
      const additions = DEFAULT_LENGTH_BANDS.filter(
        (b) => !seen.has(`${b.length_field}@${b.height_min_cm}`),
      ).map((b) => ({ ...b }));
      return [...prev, ...additions];
    });

  // ── body-shape menu (§5.4) ──
  const setShape = (i: number, patch: Partial<ShapeRow>) =>
    setShapes(shapes.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const fillStandardShapes = () =>
    setShapes((prev) => {
      const seen = new Set(prev.map((r) => `${r.shape}@${r.field}`));
      const additions = (STANDARD_SHAPES[tpl?.body_region ?? 'upper'] ?? STANDARD_SHAPES.upper)
        .filter((sh) => !seen.has(`${sh.shape}@${sh.field}`))
        .map((sh) => ({ shape: sh.shape, field: sh.field, delta: String(sh.delta) }));
      return [...prev, ...additions];
    });

  // ── tolerances (§3) — ± allowed deviation per field (QC band) ──
  const setTol = (field: string, v: string) => setTolerances((t) => ({ ...t, [field]: v }));
  const fillStandardTol = () =>
    setTolerances((prev) => {
      const next = { ...prev };
      // Only where nothing has been authored. A tolerance somebody set to 0.3 on purpose
      // is exactly the value this used to overwrite with 0.5.
      for (const f of fields) if (!next[f]?.toString().trim()) next[f] = '0.5';
      return next;
    });

  // ── chart grid for the active preset ──
  const presetKey = activePreset === BASE ? null : activePreset;
  const rows = chart.filter((r) => (r.fit_preset ?? BASE) === activePreset);
  // [DSG-11-4] Rows are addressed by POSITION, not by their label.
  //
  // Every mutator used to match `r.size_label === sizeLabel`, and `addSize` appends a row whose
  // label is ''. So two blank rows were the same row: clicking "Add size" twice and typing 44
  // into the first produced ["…","40","44","44"] — both took the value, and every measurement
  // typed into one landed in the other. Saving that pair broke the unique index on
  // (category, fit_preset, size_label) and returned a bare 500, with nothing to say which rows
  // clashed. A label is what the author is still editing; it cannot also be the row's identity.
  //
  // `chartIndexOf` maps a visible row to its slot in the whole chart, so mutations stay scoped to
  // the active preset without needing a key at all.
  const chartIndexOf = (visibleIdx: number): number => {
    let seen = -1;
    for (let i = 0; i < chart.length; i++) {
      if ((chart[i].fit_preset ?? BASE) !== activePreset) continue;
      if (++seen === visibleIdx) return i;
    }
    return -1;
  };
  const updateRow = (visibleIdx: number, patch: (r: ChartRow) => ChartRow) => {
    const idx = chartIndexOf(visibleIdx);
    if (idx < 0) return;
    setChart((prev) => prev.map((r, i) => (i === idx ? patch(r) : r)));
  };
  const setMeasurement = (visibleIdx: number, field: string, val: string) =>
    updateRow(visibleIdx, (r) => {
      const m = { ...r.measurements };
      if (val === '') delete m[field];
      else m[field] = Number(val);
      return { ...r, measurements: m };
    });
  const renameSize = (visibleIdx: number, label: string) =>
    updateRow(visibleIdx, (r) => ({ ...r, size_label: label }));
  const addSize = () =>
    setChart([...chart, { fit_preset: presetKey, size_label: '', measurements: {} }]);
  const removeSize = (visibleIdx: number) => {
    const idx = chartIndexOf(visibleIdx);
    if (idx < 0) return;
    setChart(chart.filter((_, i) => i !== idx));
  };

  // [DSG-11-4] Duplicate labels within a fit are what the database refuses. Caught here, named,
  // and shown against the rows — instead of a 500 the author has to guess at.
  const duplicateLabels = (() => {
    const seen = new Map<string, number>();
    const dupes = new Set<string>();
    for (const r of rows) {
      const k = r.size_label.trim();
      if (!k) continue;
      if (seen.has(k)) dupes.add(k);
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return dupes;
  })();

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
        .map((r) => ({
          ...r,
          size_label: r.size_label.trim(),
          // Stamped on every row from the chart-level choice, so a chart cannot end up half
          // in centimetres — which is the only state worse than being wholly in the wrong one.
          unit: chartUnit,
          measurement_basis: chartBasis,
        }));
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
        // Only the fields actually filled in. A blank leaves the stored value alone
        // rather than resetting a number the floor is cutting to.
        cutting_spec: Object.fromEntries(
          CUTTING_SPEC_FIELDS.filter((f) => cuttingSpec[f.key].trim() !== '').map((f) => [
            f.key,
            Number(cuttingSpec[f.key]),
          ]),
        ),
        available_fit_presets: presets,
        fit_presets: explicitPresetDefs,
        garment_types: garmentTypes,
        length_bands: lengthBands,
        chart: cleanChart,
        note: note.trim() || undefined,
      });
      // [DSG-11-10] Re-hydrate from what came BACK, not from what we sent. The old code
      // set the baseline from local state, so any row the server dropped stayed on screen
      // marked as saved. `hydrate` also clears dirty, from the persisted values.
      hydrate(saved);
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
      // [DSG-11-2] The preview posts a SLUG — the server re-reads the stored chart and stored
      // ease. It has never seen the editor's unsaved state and cannot. Proved live: changing
      // Straight's waist ease 1 → 9 and previewing returned waist 33 = 32 + 1, the SAVED ease,
      // rendered as a clean result with nothing to say it belonged to different numbers.
      //
      // A validation instrument that silently reports on other data is worse than none: it turns
      // an unsaved mistake into a green tick. Running it is gated on a clean editor below, and a
      // result already on screen is marked stale the moment the recipe changes under it.
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
  if (loadError)
    return (
      <div className={base.page}>
        <Link to="/admin/design/templates" className={s.back}><UilArrowLeft size={16} /> Back</Link>
        <EmptyState
          title="Couldn't load this garment type"
          body={loadError}
          action={{ label: 'Retry', onClick: loadTemplate }}
        />
      </div>
    );
  if (!tpl)
    return (
      <div className={base.page}>
        <Link to="/admin/design/templates" className={s.back}><UilArrowLeft size={16} /> Back</Link>
        <div className={s.center}>
          {notFound
            ? 'Garment type not found.'
            : 'Garment type not loaded — try again from the list.'}
        </div>
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
    const badSizes: string[] = [];
    for (let li = 1; li < lines.length; li++) {
      const cells = lines[li].split(delim).map((c) => c.trim());
      const size = cells[0];
      if (!size) continue;
      // The engine keys the chart by number. A letter row would import cleanly, save
      // cleanly and then vanish from every preview. [DSG-11-14]
      if (!isValidSizeLabel(size)) {
        badSizes.push(size);
        continue;
      }
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
      toast(
        'error',
        badSizes.length ? 'No usable size rows' : 'No size rows found',
        badSizes.length
          ? sizeLabelError(badSizes[0])
          : 'Each row needs a size label in the first column.',
      );
      return;
    }
    if (badSizes.length) {
      // Imported what was usable and said what was left out, rather than dropping it quietly.
      toast(
        'warning',
        `Skipped ${badSizes.length} row${badSizes.length === 1 ? '' : 's'}`,
        `${badSizes.join(', ')} — sizes must be numeric (32, 32.5). The rest were imported.`,
      );
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
      <ConfirmDialog
        open={presetToRemove !== null}
        variant="danger"
        title={`Remove the “${presetToRemove}” fit preset?`}
        message={
          <>
            This also removes{' '}
            <strong>
              {presetToRemove ? rowsUnderPreset(presetToRemove) : 0} chart row
              {presetToRemove && rowsUnderPreset(presetToRemove) === 1 ? '' : 's'}
            </strong>{' '}
            authored under it. Nothing is lost until you save — but the save deletes them for
            good, and there is no undo afterwards.
          </>
        }
        confirmLabel="Remove preset"
        onConfirm={() => presetToRemove && removePreset(presetToRemove)}
        onCancel={() => setPresetToRemove(null)}
      />
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
          <h3 className={s.sectionTitle}>Size chart <span className={s.req}>· {chartBasis === 'body' ? "the customer's BODY measurements" : 'FINISHED garment measurements'} per size ({chartUnit})</span></h3>
          <div className={s.sectionHeadActions}>
            {/* W-D2: migrate a known Excel chart in one paste instead of cell-by-cell. */}
            <Button variant="ghost" onClick={() => { setImportText(''); setShowImport(true); }} disabled={fields.length === 0}>
              <UilImport size={15} /> Paste / import
            </Button>
            <Button variant="ghost" onClick={openGrade} disabled={fields.length === 0}>
              <UilCalculatorAlt size={15} /> Generate from grade rules
            </Button>
          </div>
        {/* [DSG-11-6] For UPPER garments the engine never reads this chart.
            `runEngine` builds chart rows only when `region === 'lower'`
            (size-preview.service.ts), so `buildTop` is passed body anchors and ease and nothing
            else. Shirt has 0 chart rows and previews happily — 5 of the 7 garment types author
            data here that no engine consumes, through a grade generator, a CSV import, per-fit
            tabs and cell validation.
            Saying so is the honest half. WIRING buildTop to a chart is a calibrated-engine
            change and belongs to the upper-body programme, not to a UI fix — switching on an
            uncalibrated path quietly would be a worse version of this same bug. */}
        {tpl.body_region !== 'lower' && (
          <p className={s.chartNotConsumed}>
            <strong>The engine does not read this chart for {tpl.body_region ?? 'this'}-body
            garments yet.</strong> It builds from the customer's measured body plus the fit
            preset's ease. Authoring sizes here is still useful as a reference and for the
            grade generator, but changing a number below will not change what gets cut.
          </p>
        )}
        </div>
        <p className={s.hint}>
          One row per size, one column per measurement field. Type each by hand, or auto-build the
          whole chart from a base size + grade rules.
        </p>
        <div className={s.chartMeta}>
          <fieldset className={s.chartMetaGroup}>
            <legend className={s.chartMetaLegend}>These numbers are</legend>
            <label className={s.chartMetaOpt}>
              <input type="radio" name="chart-basis" checked={chartBasis === 'body'}
                onChange={() => setChartBasis('body')} />
              <span><strong>Body</strong> measurements — the engine adds this fit's ease on top</span>
            </label>
            <label className={s.chartMetaOpt}>
              <input type="radio" name="chart-basis" checked={chartBasis === 'finished'}
                onChange={() => setChartBasis('finished')} />
              <span><strong>Finished garment</strong> measurements — ease already included</span>
            </label>
            {chartBasis === 'finished' && (
              <p className={s.chartMetaWarn}>
                The engine drafts from body measurements and cannot use a finished chart yet. It
                will be stored and refused at preview rather than eased a second time — saying so
                is the difference between a feature that waits and one that silently does nothing.
              </p>
            )}
          </fieldset>
          <fieldset className={s.chartMetaGroup}>
            <legend className={s.chartMetaLegend}>Measured in</legend>
            <label className={s.chartMetaOpt}>
              <input type="radio" name="chart-unit" checked={chartUnit === 'in'}
                onChange={() => setChartUnit('in')} />
              <span>Inches</span>
            </label>
            <label className={s.chartMetaOpt}>
              <input type="radio" name="chart-unit" checked={chartUnit === 'cm'}
                onChange={() => setChartUnit('cm')} />
              <span>Centimetres — converted on read</span>
            </label>
          </fieldset>
        </div>
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
                    <td><input
                      className={`${s.sizeInput} ${
                        duplicateLabels.has(r.size_label.trim()) ||
                        (r.size_label.trim() !== '' && !isValidSizeLabel(r.size_label))
                          ? s.cellErr
                          : ''
                      }`}
                      value={r.size_label} placeholder="e.g. 32 or 32.5"
                      // Flag a label the engine would drop while it is being typed, not on
                      // save — this cell used to suggest "M". [DSG-11-14]
                      title={
                        duplicateLabels.has(r.size_label.trim())
                          ? `Another row in this fit is also "${r.size_label.trim()}" — sizes must be unique`
                          : r.size_label.trim() !== '' && !isValidSizeLabel(r.size_label)
                            ? sizeLabelError(r.size_label)
                            : undefined
                      }
                      onChange={(e) => renameSize(i, e.target.value)} /></td>
                    {chartFields.map((f) => {
                      const st = cellState(i, f);
                      return (
                        <td key={f}>
                          <input
                            className={`${s.cell} ${st === 'err' ? s.cellErr : st === 'warn' ? s.cellWarn : ''}`}
                            type="number" step="0.25" value={r.measurements[f] ?? ''}
                            title={st === 'err' ? 'Must be a positive number' : st === 'warn' ? 'Smaller than the size above — check this value' : undefined}
                            onChange={(e) => setMeasurement(i, f, e.target.value)} />
                        </td>
                      );
                    })}
                    <td><button type="button" className={s.iconBtn} onClick={() => removeSize(i)}><UilTimes size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {duplicateLabels.size > 0 && (
          <p className={s.chartDupWarning}>
            {duplicateLabels.size === 1
              ? `Two rows in this fit are both "${[...duplicateLabels][0]}".`
              : `Some rows in this fit share a size: ${[...duplicateLabels].join(', ')}.`}{' '}
            Sizes must be unique within a fit — saving as-is will be rejected.
          </p>
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
                  <button type="button" className={s.presetRemove} onClick={() => setPresetToRemove(d.fit_preset)} aria-label={`Remove ${d.fit_preset}`}>
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
      <summary>Customer tweaks · body shapes · expected variance · cutting spec — most garments don’t need these</summary>

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
          <h3 className={s.sectionTitle}>Expected variance <span className={s.req}>· the ± band the Engine Tester draws, ± inches</span></h3>
          <Button variant="ghost" onClick={fillStandardTol} disabled={fields.length === 0}><UilCalculatorAlt size={15} /> Fill standard (±0.5)</Button>
        </div>
        <p className={s.hint}>
          The ± you expect at each measurement, shown in the Engine Tester as e.g. chest 45.0 (44.5–45.5).
          <strong> This does not fail a garment.</strong> QC judges against the checks in{' '}
          <Link to="/admin/catalog/qc-templates">Catalog → QC templates</Link>
          {qcReality.has_template
            ? ` — ${qcReality.check_count} check${qcReality.check_count === 1 ? '' : 's'} for this garment type.`
            : ' — and this garment type has no QC template, so nothing is checked at all.'}
        </p>
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

      {/* The cut-sheet spec. Writes garment_cutting_specs — the table the cut sheet, the
          fabric calculator and checkout consumption actually read. [DSG-11-8] */}
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Cutting spec <span className={s.req}>· what the tailor is given</span></h3>
        <p className={s.hint}>
          These are the numbers the cut sheet prints and the fabric calculator bills against — change one and
          the next order is cut differently. Blank means “leave as it is”.
        </p>
        {!hasSpec && (
          <p className={s.warnNote} role="status">
            This garment type has no cutting spec yet, so it cannot produce a cut sheet — an order would stop
            with “No cutting spec configured”. Saving any value below creates one.
          </p>
        )}
        <div className={s.presetParams}>
          {CUTTING_SPEC_FIELDS.map((f) => (
            <label key={f.key} className={s.presetParam} title={f.hint}>
              <span className={s.presetParamLabel}>{f.label}</span>
              <input
                className={s.presetParamInput}
                type="number"
                step={f.step}
                min="0"
                value={cuttingSpec[f.key]}
                onChange={(e) => setCuttingSpec((x) => ({ ...x, [f.key]: e.target.value }))}
              />
              <span className={s.hint}>{f.hint}</span>
            </label>
          ))}
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
          <Button
            variant="outline"
            state={pvBusy ? 'loading' : 'default'}
            disabled={dirty}
            onClick={runPreview}
          >Preview finished spec</Button>
        </div>
        {dirty && (
          <p className={s.pvNotice}>
            The engine reads the <strong>saved</strong> chart and ease — it cannot see the changes
            on this screen. Save to test them.
          </p>
        )}
        {pvResult && dirty && (
          <p className={s.pvNotice}>
            ⚠ These numbers are from the recipe as it was <strong>last saved</strong>. It has been
            edited since.
          </p>
        )}
        {pvResult && (
          <div className={`${s.pvResult} ${dirty ? s.pvResultStale : ''}`}>
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
          placeholder={`Size\t${chartFields.slice(0, 3).join('\t') || 'chest\twaist\thip'}\n36\t36\t30\t38\n38\t38\t32\t40\n40\t40\t34\t42`}
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
