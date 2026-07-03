import React from 'react';
import { Link } from 'react-router-dom';
import { designsApi, uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import type { FabricOption, GarmentCategoryOption } from '../../api/adminApi';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import s from './DesignEditorPage.module.css';
import { UilTimes, UilPlus, UilImage, UilUpload, UilFileAlt, UilCheck } from '@iconscout/react-unicons';

const url = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

export interface DesignEditorModalProps {
  open: boolean;
  designId?: string; // present = edit; absent = new
  onClose: () => void;
  onSaved?: () => void; // parent reloads its list/detail
}

export const DesignEditorModal: React.FC<DesignEditorModalProps> = ({ open, designId, onClose, onSaved }) => {
  const id = designId;
  const isEdit = Boolean(designId);

  const [loading, setLoading] = React.useState(isEdit);
  const [saving, setSaving] = React.useState<'' | 'draft' | 'publish'>('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [categories, setCategories] = React.useState<GarmentCategoryOption[]>([]);
  const [fabrics, setFabrics] = React.useState<FabricOption[]>([]);
  // Step 3: the standard finished-garment chart for the chosen (category, fit), shown inline so the
  // designer sees the sizing/grading the engine will apply. null = not loaded; [] = no chart calibrated.
  const [fitChart, setFitChart] = React.useState<Record<string, number | string>[] | null>(null);
  const [fitChartLoading, setFitChartLoading] = React.useState(false);

  // form state
  const [name, setName] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [garmentType, setGarmentType] = React.useState(''); // the cut within the garment type
  const [gender, setGender] = React.useState('men');
  const [fitPreset, setFitPreset] = React.useState('');
  const [meters, setMeters] = React.useState('');
  // Size-aware fabric (INVENTORY-FABRIC-MODEL §1): size_label → metres. Edited as rows.
  const [metersBySize, setMetersBySize] = React.useState<{ size: string; meters: string }[]>([]);
  const [matched, setMatched] = React.useState<{ fabric_id: string; meters: string }[]>([]);
  const [captureSet, setCaptureSet] = React.useState<string[]>([]);
  const [painPoints, setPainPoints] = React.useState<string[]>([]);
  const [techRows, setTechRows] = React.useState<{ k: string; v: string }[]>([]);
  const [refKeys, setRefKeys] = React.useState<string[]>([]);
  const [specSheetKey, setSpecSheetKey] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [uploadingSpec, setUploadingSpec] = React.useState(false);
  const [fabricSearch, setFabricSearch] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pendingExit, setPendingExit] = React.useState<null | (() => void)>(null);
  const [step, setStep] = React.useState(0); // wizard step (0=Basics … 4=Review)

  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((x) => [...x, createToast(type, title, msg)]);

  // Dirty tracking via a load-time snapshot (W-21 canon — same as GarmentTemplateEditor).
  const snap = () =>
    JSON.stringify({ name, categoryId, garmentType, gender, fitPreset, meters, metersBySize, matched, captureSet, painPoints, techRows, refKeys, specSheetKey });
  const [baseline, setBaseline] = React.useState('');
  const dirty = !loading && baseline !== '' && baseline !== snap();
  useDirtyGuard(dirty);

  const category = categories.find((c) => c.id === categoryId);
  const presetOptions = category?.available_fit_presets ?? [];
  // The fit→standard-chart binding is the LOWER-garment engine (jeans/trousers/…). Upper garments
  // (shirts/blazers) use a different model that isn't built yet, so fit stays optional for them.
  const isLower = category?.body_region === 'lower';

  // Option lists load once (cheap, reused across opens).
  React.useEffect(() => {
    Promise.all([designsApi.garmentCategories(), designsApi.fabricOptions()])
      .then(([cats, fabs]) => {
        setCategories(cats);
        setFabrics(fabs);
      })
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each time the modal opens: load the design (edit) or clear the form (new). Reset the wizard
  // to step 0 and re-arm the dirty baseline.
  React.useEffect(() => {
    if (!open) return;
    setStep(0);
    setFieldErrors({});
    setBaseline('');
    if (designId) {
      setLoading(true);
      designsApi
        .get(designId)
        .then((d) => {
          setName(d.name);
          setCategoryId(d.garment_category_id);
          setGarmentType(d.design_garment_type ?? '');
          setGender(d.gender ?? 'men');
          setFitPreset(d.fit_preset ?? '');
          setMeters(d.meters_per_garment ?? '');
          setMetersBySize(
            Object.entries(d.meters_by_size ?? {}).map(([size, m]) => ({ size, meters: String(m) })),
          );
          setMatched(d.fabrics.map((f) => ({ fabric_id: f.id, meters: f.meters_per_garment ?? '' })));
          setCaptureSet(Array.isArray(d.capture_set) ? (d.capture_set as string[]) : []);
          setPainPoints(d.pain_point_menu ? Object.keys(d.pain_point_menu) : []);
          setTechRows(
            d.tech_pack
              ? Object.entries(d.tech_pack).map(([k, v]) => ({
                  k,
                  v: typeof v === 'object' ? JSON.stringify(v) : String(v),
                }))
              : [],
          );
          setRefKeys(d.reference_image_keys ?? []);
          setSpecSheetKey(d.spec_sheet_key ?? '');
        })
        .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
        .finally(() => setLoading(false));
    } else {
      // New design — clear every field.
      setName(''); setCategoryId(''); setGarmentType(''); setGender('men');
      setFitPreset(''); setMeters(''); setMetersBySize([]); setMatched([]); setCaptureSet([]);
      setPainPoints([]); setTechRows([]); setRefKeys([]); setSpecSheetKey('');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, designId]);

  // Capture the load-time baseline once the form is populated (re-armed on each open).
  React.useEffect(() => {
    if (open && !loading && baseline === '') setBaseline(snap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, open]);

  // Step 3: load the standard chart whenever the (category, fit) binding is complete. Only
  // lower garments have charts — skip the fetch for upper garments (different model).
  React.useEffect(() => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!categoryId || !fitPreset.trim() || cat?.body_region !== 'lower') {
      setFitChart(null);
      return;
    }
    let cancelled = false;
    setFitChartLoading(true);
    designsApi
      .fitChart(categoryId, fitPreset.trim())
      .then((r) => {
        if (!cancelled) setFitChart(Array.isArray(r.chart) ? r.chart : []);
      })
      .catch(() => {
        if (!cancelled) setFitChart([]);
      })
      .finally(() => {
        if (!cancelled) setFitChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, fitPreset, categories]);

  // pick a garment type → inherit its template (capture-set / pain-points / presets)
  const pickCategory = (catId: string) => {
    setCategoryId(catId);
    setGarmentType(''); // types differ per category — clear the old pick
    const c = categories.find((x) => x.id === catId);
    if (!c) return;
    if (captureSet.length === 0 && Array.isArray(c.capture_set)) {
      setCaptureSet(c.capture_set as string[]);
    }
    if (painPoints.length === 0 && c.pain_point_menu) {
      setPainPoints(Object.keys(c.pain_point_menu));
    }
    if (!fitPreset && c.available_fit_presets?.length) setFitPreset(c.available_fit_presets[0]);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const keys = await Promise.all(Array.from(files).map((f) => uploadToR2(f, 'designs')));
      setRefKeys((prev) => [...prev, ...keys]);
    } catch (e) {
      toast('error', 'Upload failed', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  // Spec-sheet attachment (P6 tech pack) — one file the ops floor reads when sewing.
  const handleSpecSheet = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingSpec(true);
    try {
      const key = await uploadToR2(file, 'designs');
      setSpecSheetKey(key);
    } catch (e) {
      toast('error', 'Upload failed', e instanceof Error ? e.message : undefined);
    } finally {
      setUploadingSpec(false);
    }
  };

  // Guarded navigation away from a dirty form (FABLE §227 ConfirmDialog-on-leave).
  const attemptExit = (go: () => void) => (dirty ? setPendingExit(() => go) : go());

  const buildInput = () => {
    const tech_pack = techRows
      .filter((r) => r.k.trim())
      .reduce<Record<string, unknown>>((acc, r) => ({ ...acc, [r.k.trim()]: r.v }), {});
    const pain_point_menu = painPoints.reduce<Record<string, unknown>>(
      (acc, p) => ({ ...acc, [p]: {} }),
      {},
    );
    return {
      name: name.trim(),
      garment_category_id: categoryId,
      garment_type: garmentType || null,
      gender,
      fit_preset: fitPreset || null,
      meters_per_garment: meters ? Number(meters) : 0,
      meters_by_size: Object.fromEntries(
        metersBySize
          .filter((r) => r.size.trim() && r.meters && Number(r.meters) > 0)
          .map((r) => [r.size.trim(), Number(r.meters)]),
      ),
      tech_pack: Object.keys(tech_pack).length ? tech_pack : null,
      capture_set: captureSet.length ? captureSet : null,
      pain_point_menu: Object.keys(pain_point_menu).length ? pain_point_menu : null,
      reference_image_keys: refKeys,
      spec_sheet_key: specSheetKey || null,
      fabrics: matched.map((m) => ({
        fabric_id: m.fabric_id,
        meters_per_garment: m.meters ? Number(m.meters) : null,
      })),
    };
  };

  // zod issue path → our form field name, for inline server-error placement.
  const FIELD_MAP: Record<string, string> = {
    name: 'name',
    garment_category_id: 'categoryId',
    fit_preset: 'fitPreset',
  };

  // T0-5: when the server blocks a material edit on a live/approved design (409
  // DESIGN_LOCKED), we confirm the re-sample consequence and retry with acknowledge.
  const [lockConfirm, setLockConfirm] = React.useState<{ publish: boolean } | null>(null);

  const save = async (publish: boolean, acknowledge = false) => {
    // Client-side per-field validation (errors render at the field, not as a toast).
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = 'Give the design a name.';
    if (!categoryId) fe.categoryId = 'Pick a garment type.';
    // Step 3 rule (LOWER garments only): a bottom-wear design must bind to a fit so the engine
    // knows which standard chart + ease to apply. Upper garments don't have this model yet.
    if (isLower) {
      if (!fitPreset.trim()) fe.fitPreset = 'Pick the fit this design follows.';
      else if (fitChart !== null && fitChart.length === 0)
        fe.fitPreset = 'This garment type has no standard chart for that fit — calibrate it first.';
    }
    setFieldErrors(fe);
    if (Object.keys(fe).length) {
      // Errors live on earlier steps — jump back to the first one so they're visible.
      if (fe.name || fe.categoryId) setStep(0);
      else if (fe.fitPreset) setStep(2);
      return;
    }
    if (publish && matched.length === 0) {
      setStep(3);
      return toast('error', 'Add at least one fabric to publish');
    }
    if (publish && refKeys.length === 0) {
      setStep(1);
      return toast('error', 'Add a reference image to publish');
    }
    setSaving(publish ? 'publish' : 'draft');
    try {
      const input = buildInput();
      const saved = isEdit && id
        ? await designsApi.update(id, input, acknowledge)
        : await designsApi.create(input);
      if (publish) await designsApi.setStatus(saved.id, 'published');
      setBaseline(snap()); // clears the dirty guard so closing doesn't prompt
      toast('success', publish ? 'Design published' : 'Saved as draft');
      setTimeout(() => { onSaved?.(); onClose(); }, 600);
    } catch (e) {
      // T0-5: the design is live/approved and this edit re-triggers sampling — confirm first.
      if ((e as { code?: string }).code === 'DESIGN_LOCKED') {
        setSaving('');
        setLockConfirm({ publish });
        return;
      }
      // Map server validation issues back onto the offending fields (§225).
      const msg = e instanceof Error ? e.message : '';
      const details = (e as { details?: unknown }).details;
      const mapped: Record<string, string> = {};
      if (Array.isArray(details)) {
        for (const issue of details as { path?: (string | number)[]; message?: string }[]) {
          const key = FIELD_MAP[String(issue.path?.[0] ?? '')];
          if (key && issue.message) mapped[key] = issue.message;
        }
      }
      // Fallback: the server's "field: message; field: message" summary string.
      if (!Object.keys(mapped).length && msg.includes(':')) {
        for (const seg of msg.split(';')) {
          const i = seg.indexOf(':');
          const key = i > 0 ? FIELD_MAP[seg.slice(0, i).trim()] : undefined;
          if (key) mapped[key] = seg.slice(i + 1).trim();
        }
      }
      if (Object.keys(mapped).length) setFieldErrors(mapped);
      toast('error', 'Save failed', msg || undefined);
      setSaving('');
    }
  };

  const matchedIds = new Set(matched.map((m) => m.fabric_id));
  const q = fabricSearch.trim().toLowerCase();
  const availableFabrics = fabrics.filter(
    (f) =>
      !matchedIds.has(f.id) &&
      (!q || f.name.toLowerCase().includes(q) || (f.code ?? '').toLowerCase().includes(q)),
  );

  // ── wizard plumbing ──
  const STEP_LABELS = ['Basics', 'Photos', 'Fit', 'Fabric', 'Details', 'Review'];
  const LAST = STEP_LABELS.length - 1;
  const goBack = onClose;

  // Validate just the fields owned by a step before letting the user advance.
  const validateStep = (i: number): boolean => {
    const fe: Record<string, string> = {};
    if (i === 0) {
      if (!name.trim()) fe.name = 'Give the design a name.';
      if (!categoryId) fe.categoryId = 'Pick a garment type.';
    }
    if (i === 2 && isLower) {
      if (!fitPreset.trim()) fe.fitPreset = 'Pick the fit this design follows.';
      else if (fitChart !== null && fitChart.length === 0)
        fe.fitPreset = 'This garment type has no standard chart for that fit — calibrate it first.';
    }
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };
  const goNext = () => { if (validateStep(step)) setStep((x) => Math.min(x + 1, LAST)); };
  // Step-rail jump: back/current is free; forward only THROUGH valid steps (stop at the first
  // invalid one so its errors show) — otherwise you could skip required fields.
  const goToStep = (target: number) => {
    if (target <= step) { setStep(target); return; }
    for (let i = step; i < target; i++) {
      if (!validateStep(i)) { setStep(i); return; }
    }
    setStep(target);
  };

  const footer = loading ? null : (
    <div className={s.wizFooter}>
      <Button variant="ghost" onClick={() => attemptExit(goBack)}>Cancel</Button>
      <div className={s.wizFooterRight}>
        {dirty && <span className={s.dirtyBadge}>● Unsaved</span>}
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((x) => Math.max(x - 1, 0))}>Back</Button>
        )}
        {step < LAST ? (
          <Button variant="primary" onClick={goNext}>Next ▸</Button>
        ) : (
          <>
            <Button variant="outline" state={saving === 'draft' ? 'loading' : 'default'} onClick={() => save(false)}>
              Save draft
            </Button>
            <Button
              variant="primary"
              state={saving === 'publish' ? 'loading' : 'default'}
              disabled={matched.length === 0 || refKeys.length === 0}
              onClick={() => save(true)}
            >
              Publish ▸
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Modal
        open={open}
        onClose={() => attemptExit(goBack)}
        size="lg"
        className={s.wizardModal}
        title={isEdit ? 'Edit design' : 'New design'}
        footer={footer}
      >
        {loading ? (
          <div className={s.center}><Spinner /></div>
        ) : (
        <>
          <div className={s.wizSteps}>
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`${s.wizStep} ${i === step ? s.wizStepActive : ''} ${i < step ? s.wizStepDone : ''}`}
                onClick={() => goToStep(i)}
              >
                <span className={s.wizStepNum}>{i < step ? <UilCheck size={13} /> : i + 1}</span>
                <span className={s.wizStepLabel}>{label}</span>
              </button>
            ))}
          </div>

          <div className={s.wizBody}>
        {step === 0 && (
        <section className={s.section}>
          <h3 className={s.sectionTitle}>Basics</h3>
          <p className={s.sizeHint}>
            <strong>Garment type</strong> sets the measurements &amp; fit engine · <strong>Cut</strong> is the
            specific make within it.
          </p>
          <div className={s.grid2}>
            <Input
              label="Name *"
              value={name}
              onChange={(v) => { setName(v); if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' })); }}
              error={fieldErrors.name || undefined}
              placeholder="e.g. Tapered Chino"
            />
            <Select
              label="Garment type *"
              value={categoryId}
              onChange={(v) => { pickCategory(v); if (fieldErrors.categoryId) setFieldErrors((p) => ({ ...p, categoryId: '' })); }}
              error={fieldErrors.categoryId || undefined}
              placeholder="Select a garment type"
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
            />
            {category?.garment_types && category.garment_types.length > 0 && (
              <Select
                label="Cut"
                value={garmentType}
                onChange={setGarmentType}
                placeholder="Which cut?"
                options={category.garment_types.map((t) => ({ label: t, value: t }))}
              />
            )}
            <Select
              label="Gender"
              value={gender}
              onChange={setGender}
              options={[
                { label: 'Men', value: 'men' },
                { label: 'Women', value: 'women' },
                { label: 'Unisex', value: 'unisex' },
              ]}
            />
          </div>
        </section>
        )}

        {step === 1 && (
        <section className={s.section}>
          <h3 className={s.sectionTitle}>
            Photos <span className={s.req}>· at least one reference image required to publish</span>
          </h3>
          {category ? (
            <p className={s.refReminder}>
              📌 Reference images should show a <strong>{category.name}{garmentType ? ` · ${garmentType}` : ''}</strong> — the garment this design makes. The hub stitches to these, so a mismatched photo (e.g. a shirt on a trouser) misleads production.
            </p>
          ) : (
            <p className={s.refReminder}>
              Pick a <strong>garment type</strong> on the Basics step first — so the reference images match the garment being made.
            </p>
          )}
          <label className={s.fieldLabel}>Reference images</label>
          {refKeys.length > 0 && <p className={s.sizeHint}>The first image is the card cover — use “Cover” on another to change it.</p>}
          <div className={s.refImages}>
            {refKeys.map((k, i) => (
              <div key={k} className={`${s.refThumb} ${i === 0 ? s.refThumbCover : ''}`}>
                <img src={url(k)} alt="reference" />
                {i === 0 ? (
                  <span className={s.coverBadge}>Cover</span>
                ) : (
                  <button type="button" className={s.setCoverBtn} title="Set as cover" onClick={() => setRefKeys([k, ...refKeys.filter((x) => x !== k)])}>
                    Cover
                  </button>
                )}
                <button type="button" className={s.refRemove} onClick={() => setRefKeys(refKeys.filter((x) => x !== k))}>
                  <UilTimes size={14} />
                </button>
              </div>
            ))}
            <label className={s.uploadBox}>
              {uploading ? <Spinner /> : <UilUpload size={20} />}
              <span>{uploading ? 'Uploading…' : 'Upload'}</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
            </label>
          </div>

          {/* Spec-sheet attachment — one file the ops floor sews from. */}
          <div className={s.specBlock}>
            <label className={s.fieldLabel}>Spec sheet <span className={s.req}>· PDF/image the ops floor reads when cutting &amp; stitching (optional)</span></label>
            {specSheetKey ? (
              <div className={s.specFile}>
                <UilFileAlt size={18} />
                <a href={url(specSheetKey)} target="_blank" rel="noreferrer" className={s.specLink}>View attached spec sheet</a>
                <button type="button" className={s.iconBtn} onClick={() => setSpecSheetKey('')} aria-label="Remove spec sheet">
                  <UilTimes size={15} />
                </button>
              </div>
            ) : (
              <label className={s.uploadBox}>
                {uploadingSpec ? <Spinner /> : <UilFileAlt size={20} />}
                <span>{uploadingSpec ? 'Uploading…' : 'Upload PDF / image'}</span>
                <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => handleSpecSheet(e.target.files)} />
              </label>
            )}
          </div>
        </section>
        )}

        {step === 2 && (
        <section className={s.section}>
          <h3 className={s.sectionTitle}>
            Fit{' '}
            <span className={s.req}>
              {isLower
                ? '· binds this design to the standard size chart the engine follows'
                : '· optional fit label'}
            </span>
          </h3>
          {categoryId && !isLower && (
            <p className={s.sizeHint}>
              <strong>{category?.name}</strong> is an upper garment — the fit engine (standard charts +
              ease) is only built for lower garments so far. Fit here is just an optional label; the
              engine won’t compute a chart for it yet.
            </p>
          )}
          <div className={s.grid2}>
            {presetOptions.length > 0 ? (
              <Select
                label={isLower ? 'Fit preset *' : 'Fit preset'}
                value={fitPreset}
                onChange={(v) => { setFitPreset(v); if (fieldErrors.fitPreset) setFieldErrors((p) => ({ ...p, fitPreset: '' })); }}
                error={fieldErrors.fitPreset || undefined}
                placeholder="Select fit"
                options={presetOptions.map((p) => ({ label: p, value: p }))}
              />
            ) : (
              <Input
                label={isLower ? 'Fit preset *' : 'Fit preset'}
                value={fitPreset}
                onChange={(v) => { setFitPreset(v); if (fieldErrors.fitPreset) setFieldErrors((p) => ({ ...p, fitPreset: '' })); }}
                error={fieldErrors.fitPreset || undefined}
                placeholder="e.g. slim"
              />
            )}
          </div>

          {/* Standard chart inline (read-only): the finished-garment sizing this (category, fit)
              will be stitched to — body + ease, every size. Lower garments only. */}
          {isLower && fitPreset.trim() && (
            <div className={s.fitChart}>
              {fitChartLoading ? (
                <span className={s.hint}>Loading standard chart…</span>
              ) : fitChart && fitChart.length > 0 ? (
                <>
                  <p className={s.fitChartCaption}>
                    Standard finished-garment chart — <strong>{category?.name}</strong> · <strong>{fitPreset}</strong>
                    <span> (inches; what the engine stitches to before per-customer ease)</span>
                  </p>
                  {(() => {
                    const ORDER = ['size', 'waist', 'hip', 'thigh', 'knee', 'leg_opening', 'rise', 'inseam'];
                    const keys = Object.keys(fitChart[0]);
                    const cols = [...ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !ORDER.includes(k))];
                    const head = (k: string) => k.replace(/_/g, ' ');
                    return (
                      <div className={s.fitChartScroll}>
                        <table className={s.fitChartTable}>
                          <thead>
                            <tr>{cols.map((c) => <th key={c}>{head(c)}</th>)}</tr>
                          </thead>
                          <tbody>
                            {fitChart.map((row, i) => (
                              <tr key={i}>
                                {cols.map((c) => <td key={c}>{String(row[c] ?? '—')}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className={s.fitChartEmpty}>
                  No standard chart is calibrated for <strong>{category?.name}</strong> · <strong>{fitPreset}</strong> yet.
                  A design can’t publish on an uncalibrated fit — calibrate the chart in the{' '}
                  <Link to={`/admin/design/templates/${categoryId}`} className={s.templateLink}>garment-type template →</Link>
                </p>
              )}
            </div>
          )}
        </section>
        )}

        {step === 3 && (
        <>
        {/* Fabric needed per garment (INVENTORY-FABRIC-MODEL §1) — DEMOTED to an optional advanced
            block (production-planning detail, not core design). */}
        <details className={s.advanced}>
        <summary>Fabric consumption (optional · for production planning)</summary>
        <section className={s.section}>
          <h3 className={s.sectionTitle}>
            Fabric needed per garment <span className={s.req}>· drives stock reservation</span>
          </h3>
          <p className={s.sizeHint}>
            Start with a <strong>base / average</strong> — it’s the fallback and seeds the per-size table.
            Fabric scales with size, so set each size below; the <strong>largest</strong> is what we reserve
            before a new customer is measured.
          </p>
          <div className={s.baseMetersRow}>
            <label className={s.fieldLabel}>Base / average</label>
            <div className={s.metersField}>
              <input
                type="number"
                step="0.1"
                className={s.metersInput}
                value={meters}
                onChange={(e) => setMeters(e.target.value)}
                placeholder="e.g. 2.0"
              />
              <span>m</span>
            </div>
          </div>
          <label className={s.fieldLabel}>Per size</label>
          <div className={s.sizeRows}>
            {metersBySize.map((row, i) => (
              <div key={i} className={s.sizeRow}>
                <input
                  className={s.sizeLabelInput}
                  placeholder="Size (e.g. M)"
                  value={row.size}
                  onChange={(e) =>
                    setMetersBySize(metersBySize.map((r, j) => (j === i ? { ...r, size: e.target.value } : r)))
                  }
                />
                <div className={s.metersField}>
                  <input
                    type="number"
                    step="0.1"
                    className={s.metersInput}
                    placeholder={meters || 'm'}
                    value={row.meters}
                    onChange={(e) =>
                      setMetersBySize(metersBySize.map((r, j) => (j === i ? { ...r, meters: e.target.value } : r)))
                    }
                  />
                  <span>m</span>
                </div>
                <button
                  type="button"
                  className={s.matchedRemove}
                  onClick={() => setMetersBySize(metersBySize.filter((_, j) => j !== i))}
                >
                  <UilTimes size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className={s.sizeActions}>
            <button
              type="button"
              className={s.sizeAddBtn}
              onClick={() => setMetersBySize([...metersBySize, { size: '', meters: '' }])}
            >
              <UilPlus size={14} /> Add size
            </button>
            <button
              type="button"
              className={s.sizeAddBtn}
              onClick={() => {
                const b = Number(meters) || 2;
                const scale: [string, number][] = [['S', 0.85], ['M', 1], ['L', 1.1], ['XL', 1.25], ['XXL', 1.4]];
                setMetersBySize(scale.map(([sz, k]) => ({ size: sz, meters: String(Math.round(b * k * 10) / 10) })));
              }}
            >
              Fill standard (S–XXL)
            </button>
          </div>
        </section>
        </details>

        {/* Fabric match — swatch picker + per-fabric metreage */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>
            Fabric match <span className={s.req}>· which fabrics this design comes in · ≥1 required to publish</span>
          </h3>

          {matched.length === 0 ? (
            <span className={s.hint}>No fabrics matched yet — pick from below.</span>
          ) : (
            <div className={s.matchedList}>
              {matched.map((m) => {
                const f = fabrics.find((x) => x.id === m.fabric_id);
                return (
                  <div key={m.fabric_id} className={s.matchedRow}>
                    <span className={s.matchedSwatch}>
                      {f && url(f.image_keys?.[0]) ? <img src={url(f.image_keys[0])} alt={f.name} /> : <UilImage size={16} />}
                    </span>
                    <div className={s.matchedInfo}>
                      <strong>{f?.name ?? 'Fabric'}</strong>
                      {f?.code ? <em> · {f.code}</em> : null}
                    </div>
                    <button type="button" className={s.matchedRemove} onClick={() => setMatched(matched.filter((x) => x.fabric_id !== m.fabric_id))}>
                      <UilTimes size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <input
            className={s.fabricSearch}
            placeholder="Search fabrics to add…"
            value={fabricSearch}
            onChange={(e) => setFabricSearch(e.target.value)}
          />
          <div className={s.fabricPicker}>
            {availableFabrics.length === 0 ? (
              <span className={s.hint}>{fabrics.length ? 'No matching fabrics.' : 'No fabrics in the master yet.'}</span>
            ) : (
              availableFabrics.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={s.pickCard}
                  onClick={() => setMatched([...matched, { fabric_id: f.id, meters: '' }])}
                >
                  <span className={s.pickSwatch}>
                    {url(f.image_keys?.[0]) ? <img src={url(f.image_keys[0])} alt={f.name} /> : <UilImage size={18} />}
                  </span>
                  <span className={s.pickName}>{f.name}</span>
                  {f.code ? <span className={s.pickCode}>{f.code}</span> : null}
                </button>
              ))
            )}
          </div>
        </section>
        </>
        )}

        {step === 4 && (
        <>
        {/* Measurements — READ-ONLY: inherited from the garment-type template (editing here would
            silently diverge from the engine). Edit them in the template instead. */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>
            Measurements <span className={s.req}>· inherited from the garment-type template (read-only)</span>
          </h3>
          <label className={s.fieldLabel}>Capture-set (fields the agent measures)</label>
          {captureSet.length ? (
            <div className={s.roTags}>{captureSet.map((c) => <span key={c} className={s.roTag}>{c}</span>)}</div>
          ) : <p className={s.hint}>— none —</p>}
          <label className={s.fieldLabel}>Pain-point options</label>
          {painPoints.length ? (
            <div className={s.roTags}>{painPoints.map((p) => <span key={p} className={s.roTag}>{p}</span>)}</div>
          ) : <p className={s.hint}>— none —</p>}
          {categoryId ? (
            <p className={s.hint}>
              Size chart &amp; measured fields come from the <strong>{category?.name ?? 'garment-type'}</strong> template.{' '}
              <Link to={`/admin/design/templates/${categoryId}`} className={s.templateLink}>
                Edit them in the template →
              </Link>
            </p>
          ) : (
            <p className={s.hint}>Pick a garment type to inherit its size chart and template.</p>
          )}
        </section>

        {/* Tech-pack */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>Tech-pack <span className={s.req}>· construction spec (optional)</span></h3>
          <label className={s.fieldLabel}>Tech-pack (construction spec)</label>
          {techRows.map((r, i) => (
            <div key={i} className={s.techRow}>
              <Input
                value={r.k}
                onChange={(v) => setTechRows(techRows.map((x, j) => (j === i ? { ...x, k: v } : x)))}
                placeholder="part (e.g. collar)"
              />
              <Input
                value={r.v}
                onChange={(v) => setTechRows(techRows.map((x, j) => (j === i ? { ...x, v } : x)))}
                placeholder="spec (e.g. button-down)"
              />
              <button
                type="button"
                className={s.iconBtn}
                onClick={() => setTechRows(techRows.filter((_, j) => j !== i))}
              >
                <UilTimes size={16} />
              </button>
            </div>
          ))}
          <Button variant="ghost" onClick={() => setTechRows([...techRows, { k: '', v: '' }])}>
            <UilPlus size={15} /> Add row
          </Button>
        </section>
        </>
        )}

        {step === 5 && (
          <div className={s.wizReview}>
            <p className={s.sizeHint}>Review the design, then save it as a draft or publish it.</p>
            <dl className={s.reviewGrid}>
              <div className={s.reviewRow}><dt>Name</dt><dd>{name.trim() || '—'}</dd></div>
              <div className={s.reviewRow}><dt>Garment type</dt><dd>{category?.name ?? '—'}</dd></div>
              <div className={s.reviewRow}><dt>Cut</dt><dd>{garmentType || '—'}</dd></div>
              <div className={s.reviewRow}><dt>Gender</dt><dd>{gender}</dd></div>
              <div className={s.reviewRow}><dt>Fit</dt><dd>{fitPreset.trim() || '—'}</dd></div>
              <div className={s.reviewRow}><dt>Fabric (base)</dt><dd>{meters ? `${meters} m` : '—'}{metersBySize.length ? ` · ${metersBySize.length} sizes` : ''}</dd></div>
              <div className={s.reviewRow}><dt>Fabrics matched</dt><dd>{matched.length}</dd></div>
              <div className={s.reviewRow}><dt>Reference images</dt><dd>{refKeys.length}</dd></div>
              <div className={s.reviewRow}><dt>Spec sheet</dt><dd>{specSheetKey ? 'attached' : '—'}</dd></div>
            </dl>
            {refKeys.length > 0 && (
              <div className={s.refImages} style={{ marginTop: 'var(--spacing-md)' }}>
                {refKeys.map((k) => (
                  <div key={k} className={s.refThumb}><img src={url(k)} alt="reference" /></div>
                ))}
              </div>
            )}
            {matched.length === 0 && (
              <p className={s.fitChartEmpty}>Add at least one fabric (Fabric step) to publish — you can still <strong>Save draft</strong> now.</p>
            )}
            {refKeys.length === 0 && (
              <p className={s.fitChartEmpty}>Add a reference image (Photos step) to publish — you can still <strong>Save draft</strong> now.</p>
            )}
          </div>
        )}
          </div>
        </>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingExit !== null}
        title="Discard unsaved changes?"
        message="This design has changes you haven't saved. Leaving now will lose them."
        confirmLabel="Discard & leave"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={() => { const go = pendingExit; setPendingExit(null); go?.(); }}
        onCancel={() => setPendingExit(null)}
      />

      {/* T0-5: the design already has an approved sample or a live listing. */}
      <ConfirmDialog
        open={lockConfirm !== null}
        title="This design is already live"
        message="It has an approved sample or a live listing. Saving these changes re-opens its sample review — the previous approval no longer stands, and it must be re-sampled before it's trusted again. Proceed?"
        confirmLabel="Save & re-open review"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={() => { const p = lockConfirm?.publish ?? false; setLockConfirm(null); save(p, true); }}
        onCancel={() => setLockConfirm(null)}
      />
    </>
  );
};

export default DesignEditorModal;
