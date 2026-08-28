import React from 'react';
import { designsApi, brandQcApi, brandLedgerApi } from '../../api/adminApi';
import type {
  GarmentCategoryOption,
  QcCheck,
  BrandQcConfig,
  BrandSummary,
} from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Button } from '../../components/Button/Button';
import { AccessDenied } from '../../components/AccessDenied/AccessDenied';
// Same layout as QC Templates (the house QC-1 editor) — this is its brand QC-2 sibling.
import s from './QcTemplatesPage.module.css';
import { UilPlus, UilTrashAlt } from '@iconscout/react-unicons';

// T3-4: a brand's second QC layer (QC-2), per garment category. A 3P order can't dispatch until
// BOTH the house QC-1 and this brand QC-2 pass; house-brand orders use only QC-1.
const blankCheck = (): QcCheck => ({
  key: '',
  label: '',
  type: 'numeric',
  required: true,
  min: null,
  max: null,
  unit: '',
});

export const BrandQcPage: React.FC = () => {
  const [brands, setBrands] = React.useState<BrandSummary[]>([]);
  const [categories, setCategories] = React.useState<GarmentCategoryOption[]>([]);
  const [configs, setConfigs] = React.useState<BrandQcConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [brandId, setBrandId] = React.useState('');
  const [catId, setCatId] = React.useState('');
  const [checks, setChecks] = React.useState<QcCheck[]>([]);
  const [hasExisting, setHasExisting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  // [KA5-1 / CM-20-1] A refusal is not a load failure.
  //
  // Opening this page as catalog_manager — the role whose console it lives in — fired the
  // brand list, was refused (it was gated finance:read alone; fixed backend-side), and drew
  // two identical red toasts ANCHORED OVER THE HEADER, covering the theme toggle, the bell
  // and part of the identity chip, truncating this page's own subtitle mid-sentence, above a
  // "Select a brand…" dropdown with nothing in it. The page half-rendered its full furniture
  // and explained the failure on top of the navigation.
  //
  // A 403 now renders the one refusal screen the product already has, and does NOT toast: a
  // page that refuses cleanly does not need to shout as well.
  const [denied, setDenied] = React.useState(false);

  React.useEffect(() => {
    Promise.all([designsApi.garmentCategories(), brandLedgerApi.listBrands()])
      .then(([cats, { brands: bs }]) => {
        setCategories(cats);
        // QC-2 is the third-party layer — the house brand only ever runs QC-1.
        setBrands(bs.filter((b) => !b.is_house_brand));
      })
      .catch((e) => {
        if ((e as { status?: number })?.status === 403) {
          setDenied(true);
          return;
        }
        toast('error', 'Failed to load', e instanceof Error ? e.message : undefined);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadConfigs = React.useCallback((id: string) => {
    if (!id) return setConfigs([]);
    brandQcApi
      .list(id)
      .then(setConfigs)
      .catch(() => setConfigs([]));
  }, []);

  const selectBrand = (id: string) => {
    setBrandId(id);
    setCatId('');
    setChecks([]);
    setHasExisting(false);
    loadConfigs(id);
  };

  const selectCategory = (id: string) => {
    setCatId(id);
    if (!id || !brandId) {
      setChecks([]);
      setHasExisting(false);
      return;
    }
    brandQcApi
      .forCategory(brandId, id)
      .then((c) => {
        setHasExisting(!!c);
        setChecks(c?.checks?.length ? c.checks : [blankCheck()]);
      })
      .catch((e) => toast('error', 'Failed to load config', e instanceof Error ? e.message : undefined));
  };

  const patchCheck = (i: number, patch: Partial<QcCheck>) =>
    setChecks((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCheck = (i: number) => setChecks((cs) => cs.filter((_, idx) => idx !== i));

  const save = async () => {
    const cleaned = checks
      .map((c) => ({ ...c, key: c.key.trim(), label: c.label.trim() }))
      .filter((c) => c.key || c.label);
    if (cleaned.length === 0) return toast('error', 'Add at least one check');
    if (cleaned.some((c) => !c.key || !c.label))
      return toast('error', 'Every check needs a key and a label');
    if (cleaned.some((c) => !/^[a-z0-9_]+$/.test(c.key)))
      return toast('error', 'Check keys must be lower_snake_case');
    if (new Set(cleaned.map((c) => c.key)).size !== cleaned.length)
      return toast('error', 'Check keys must be unique');
    if (cleaned.some((c) => c.type === 'numeric' && c.min == null && c.max == null))
      return toast('error', 'A numeric check needs a min and/or max tolerance');
    setSaving(true);
    try {
      // Drop min/max/unit on boolean checks so the payload is clean.
      const payload = cleaned.map((c) =>
        c.type === 'boolean'
          ? { key: c.key, label: c.label, type: c.type, required: c.required }
          : c,
      );
      await brandQcApi.upsert(brandId, catId, { checks: payload });
      toast('success', 'QC-2 checks saved');
      loadConfigs(brandId);
      selectCategory(catId);
    } catch (e) {
      toast('error', 'Could not save', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  if (denied) {
    return (
      <AccessDenied
        what="Brand QC-2"
        requires={['catalog:write', 'reports:read', 'finance:read']}
      />
    );
  }

  return (
    <div className={s.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className={s.pageHeader}>
        <h1 className={s.title}>Brand QC-2</h1>
        <p className={s.subtitle}>
          A third-party brand's second QC layer, per garment category. A brand order can't dispatch
          until both the house QC-1 and this QC-2 pass — house-brand orders use only QC-1.
        </p>
      </div>

      <div className={s.card}>
        <div className={s.field}>
          <label className={s.fieldLabel}>Brand</label>
          <select
            className={s.fieldSelect}
            value={brandId}
            onChange={(e) => selectBrand(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a brand…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {brandId && (
          <div className={s.field}>
            <label className={s.fieldLabel}>Garment category</label>
            <select
              className={s.fieldSelect}
              value={catId}
              onChange={(e) => selectCategory(e.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {brandId && catId && (
          <>
            <div>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Label</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Unit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          className={s.cellInput}
                          value={c.key}
                          onChange={(e) => patchCheck(i, { key: e.target.value })}
                          placeholder="stitch_gauge"
                        />
                      </td>
                      <td>
                        <input
                          className={s.cellInput}
                          value={c.label}
                          onChange={(e) => patchCheck(i, { label: e.target.value })}
                          placeholder="Stitch gauge"
                        />
                      </td>
                      <td>
                        <select
                          className={s.cellInput}
                          value={c.type}
                          onChange={(e) =>
                            patchCheck(i, { type: e.target.value as QcCheck['type'] })
                          }
                        >
                          <option value="numeric">numeric</option>
                          <option value="boolean">pass/fail</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={c.required}
                          onChange={(e) => patchCheck(i, { required: e.target.checked })}
                        />
                      </td>
                      <td className={s.numCell}>
                        {c.type === 'numeric' ? (
                          <input
                            className={s.cellInput}
                            type="number"
                            value={c.min ?? ''}
                            onChange={(e) =>
                              patchCheck(i, { min: e.target.value === '' ? null : Number(e.target.value) })
                            }
                          />
                        ) : (
                          <span className={s.muted}>—</span>
                        )}
                      </td>
                      <td className={s.numCell}>
                        {c.type === 'numeric' ? (
                          <input
                            className={s.cellInput}
                            type="number"
                            value={c.max ?? ''}
                            onChange={(e) =>
                              patchCheck(i, { max: e.target.value === '' ? null : Number(e.target.value) })
                            }
                          />
                        ) : (
                          <span className={s.muted}>—</span>
                        )}
                      </td>
                      <td>
                        {c.type === 'numeric' ? (
                          <input
                            className={s.cellInput}
                            value={c.unit ?? ''}
                            onChange={(e) => patchCheck(i, { unit: e.target.value })}
                            placeholder="spi"
                          />
                        ) : (
                          <span className={s.muted}>—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={s.rowBtn}
                          onClick={() => removeCheck(i)}
                          aria-label="Remove check"
                        >
                          <UilTrashAlt size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={s.actions}>
              <button className={s.addBtn} onClick={() => setChecks((cs) => [...cs, blankCheck()])}>
                <UilPlus size={15} /> Add check
              </button>
              <Button onClick={save} state={saving ? 'loading' : 'default'}>
                {hasExisting ? 'Save changes' : 'Create QC-2 checks'}
              </Button>
            </div>
          </>
        )}
      </div>

      {brandId && (
        <div className={s.card}>
          <h2 className={s.cardTitle}>{brandName(brandId)} — categories with QC-2</h2>
          {configs.length === 0 ? (
            <p className={s.empty}>
              No QC-2 checks yet — pick a category above and add this brand's checks.
            </p>
          ) : (
            <div>
              {configs.map((cfg) => (
                <div
                  key={cfg.garment_category_id}
                  className={s.summaryRow}
                  onClick={() => selectCategory(cfg.garment_category_id)}
                >
                  <span className={s.summaryName}>
                    {cfg.category_name ?? catName(cfg.garment_category_id)}
                  </span>
                  <span className={s.badge}>
                    {cfg.checks.length} check{cfg.checks.length === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrandQcPage;
