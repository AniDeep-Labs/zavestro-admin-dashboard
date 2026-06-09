import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { designsApi, uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import type { FabricOption, GarmentCategoryOption } from '../../api/adminApi';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import base from './OrdersListPage.module.css';
import s from './DesignEditorPage.module.css';
import { UilArrowLeft, UilTimes, UilPlus, UilImage, UilUpload } from '@iconscout/react-unicons';

const url = (key?: string) => (key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '');

/** Editable list of free-text tags (capture-set, pain-points). */
const Chips: React.FC<{
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}> = ({ values, onChange, placeholder }) => {
  const [draft, setDraft] = React.useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className={s.chips}>
      {values.map((v) => (
        <span key={v} className={s.chip}>
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
            <UilTimes size={13} />
          </button>
        </span>
      ))}
      <input
        className={s.chipInput}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
};

export const DesignEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(isEdit);
  const [saving, setSaving] = React.useState<'' | 'draft' | 'publish'>('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [categories, setCategories] = React.useState<GarmentCategoryOption[]>([]);
  const [fabrics, setFabrics] = React.useState<FabricOption[]>([]);

  // form state
  const [name, setName] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [gender, setGender] = React.useState('men');
  const [style, setStyle] = React.useState('');
  const [fitPreset, setFitPreset] = React.useState('');
  const [meters, setMeters] = React.useState('');
  const [fabricIds, setFabricIds] = React.useState<string[]>([]);
  const [captureSet, setCaptureSet] = React.useState<string[]>([]);
  const [painPoints, setPainPoints] = React.useState<string[]>([]);
  const [techRows, setTechRows] = React.useState<{ k: string; v: string }[]>([]);
  const [refKeys, setRefKeys] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [fabricToAdd, setFabricToAdd] = React.useState('');

  const dismiss = (t: string) => setToasts((x) => x.filter((y) => y.id !== t));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((x) => [...x, createToast(type, title, msg)]);

  const category = categories.find((c) => c.id === categoryId);
  const presetOptions = category?.available_fit_presets ?? [];

  // initial load: options + (edit) the design
  React.useEffect(() => {
    Promise.all([designsApi.garmentCategories(), designsApi.fabricOptions()])
      .then(([cats, fabs]) => {
        setCategories(cats);
        setFabrics(fabs);
      })
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined));
    if (isEdit && id) {
      designsApi
        .get(id)
        .then((d) => {
          setName(d.name);
          setCategoryId(d.garment_category_id);
          setGender(d.gender ?? 'men');
          setStyle(d.style ?? '');
          setFitPreset(d.fit_preset ?? '');
          setMeters(d.meters_per_garment ?? '');
          setFabricIds(d.fabrics.map((f) => f.id));
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
        })
        .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  // pick a garment type → inherit its template (capture-set / pain-points / presets)
  const pickCategory = (catId: string) => {
    setCategoryId(catId);
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
      gender,
      style: style.trim() || null,
      fit_preset: fitPreset || null,
      meters_per_garment: meters ? Number(meters) : 0,
      tech_pack: Object.keys(tech_pack).length ? tech_pack : null,
      capture_set: captureSet.length ? captureSet : null,
      pain_point_menu: Object.keys(pain_point_menu).length ? pain_point_menu : null,
      reference_image_keys: refKeys,
      fabric_ids: fabricIds,
    };
  };

  const save = async (publish: boolean) => {
    if (!name.trim()) return toast('error', 'Name required');
    if (!categoryId) return toast('error', 'Pick a garment type');
    if (publish && fabricIds.length === 0)
      return toast('error', 'Add at least one fabric to publish');
    setSaving(publish ? 'publish' : 'draft');
    try {
      const input = buildInput();
      let saved = isEdit && id ? await designsApi.update(id, input) : await designsApi.create(input);
      if (publish) saved = await designsApi.setStatus(saved.id, 'published');
      toast('success', publish ? 'Design published' : 'Saved as draft');
      setTimeout(() => navigate(`/admin/design/library/${saved.id}`), 600);
    } catch (e) {
      toast('error', 'Save failed', e instanceof Error ? e.message : undefined);
      setSaving('');
    }
  };

  if (loading)
    return (
      <div className={base.page}>
        <div className={s.center}>
          <Spinner />
        </div>
      </div>
    );

  const availableFabrics = fabrics.filter((f) => !fabricIds.includes(f.id));

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Link to={isEdit ? `/admin/design/library/${id}` : '/admin/design/library'} className={s.back}>
        <UilArrowLeft size={16} /> {isEdit ? 'Back to design' : 'Back to library'}
      </Link>
      <h1 className={s.title}>{isEdit ? 'Edit design' : 'New design'}</h1>

      <div className={s.form}>
        {/* Basics */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>Basics</h3>
          <div className={s.grid2}>
            <Input label="Name *" value={name} onChange={setName} placeholder="e.g. Tapered Chino" />
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
            <Select
              label="Garment type *"
              value={categoryId}
              onChange={pickCategory}
              placeholder="Select a garment type"
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
            />
            <Input label="Style" value={style} onChange={setStyle} placeholder="e.g. Tapered" />
          </div>
        </section>

        {/* Fit & make */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>Fit &amp; make</h3>
          <div className={s.grid2}>
            {presetOptions.length > 0 ? (
              <Select
                label="Fit preset"
                value={fitPreset}
                onChange={setFitPreset}
                placeholder="Select fit"
                options={presetOptions.map((p) => ({ label: p, value: p }))}
              />
            ) : (
              <Input label="Fit preset" value={fitPreset} onChange={setFitPreset} placeholder="e.g. slim" />
            )}
            <Input
              label="Meters per garment"
              type="number"
              value={meters}
              onChange={setMeters}
              placeholder="e.g. 1.4"
            />
          </div>
        </section>

        {/* Fabric match */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>
            Fabric match <span className={s.req}>· ≥1 required to publish</span>
          </h3>
          <div className={s.fabricChosen}>
            {fabricIds.length === 0 && <span className={s.hint}>No fabrics matched yet.</span>}
            {fabricIds.map((fid) => {
              const f = fabrics.find((x) => x.id === fid);
              if (!f) return null;
              return (
                <span key={fid} className={s.fabricChip}>
                  <span className={s.fabricChipSwatch}>
                    {url(f.image_keys?.[0]) ? (
                      <img src={url(f.image_keys[0])} alt={f.name} />
                    ) : (
                      <UilImage size={14} />
                    )}
                  </span>
                  {f.name}
                  {f.code ? <em>· {f.code}</em> : null}
                  <button type="button" onClick={() => setFabricIds(fabricIds.filter((x) => x !== fid))}>
                    <UilTimes size={14} />
                  </button>
                </span>
              );
            })}
          </div>
          <div className={s.fabricAdd}>
            <Select
              value={fabricToAdd}
              onChange={setFabricToAdd}
              placeholder={availableFabrics.length ? 'Add a fabric SKU…' : 'No more fabrics'}
              options={availableFabrics.map((f) => ({
                label: `${f.name}${f.code ? ` (${f.code})` : ''}`,
                value: f.id,
              }))}
            />
            <Button
              variant="outline"
              disabled={!fabricToAdd}
              onClick={() => {
                if (fabricToAdd) {
                  setFabricIds([...fabricIds, fabricToAdd]);
                  setFabricToAdd('');
                }
              }}
            >
              <UilPlus size={15} /> Add
            </Button>
          </div>
        </section>

        {/* Measurements */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>
            Measurements <span className={s.req}>· inherits the garment-type template, editable</span>
          </h3>
          <label className={s.fieldLabel}>Capture-set (fields the agent measures)</label>
          <Chips values={captureSet} onChange={setCaptureSet} placeholder="add field + Enter" />
          <label className={s.fieldLabel}>Pain-point options</label>
          <Chips values={painPoints} onChange={setPainPoints} placeholder="add pain-point + Enter" />
          <p className={s.hint}>
            Size chart inherits the garment-type template (chart editing comes in a follow-up).
          </p>
        </section>

        {/* Construction */}
        <section className={s.section}>
          <h3 className={s.sectionTitle}>Construction</h3>
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

          <label className={s.fieldLabel} style={{ marginTop: 'var(--spacing-lg)' }}>
            Reference images
          </label>
          <div className={s.refImages}>
            {refKeys.map((k) => (
              <div key={k} className={s.refThumb}>
                <img src={url(k)} alt="reference" />
                <button type="button" onClick={() => setRefKeys(refKeys.filter((x) => x !== k))}>
                  <UilTimes size={14} />
                </button>
              </div>
            ))}
            <label className={s.uploadBox}>
              {uploading ? <Spinner /> : <UilUpload size={20} />}
              <span>{uploading ? 'Uploading…' : 'Upload'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>
        </section>
      </div>

      <div className={s.actionBar}>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          variant="outline"
          state={saving === 'draft' ? 'loading' : 'default'}
          onClick={() => save(false)}
        >
          Save draft
        </Button>
        <Button
          variant="primary"
          state={saving === 'publish' ? 'loading' : 'default'}
          disabled={fabricIds.length === 0}
          onClick={() => save(true)}
        >
          Publish ▸
        </Button>
      </div>
    </div>
  );
};

export default DesignEditorPage;
