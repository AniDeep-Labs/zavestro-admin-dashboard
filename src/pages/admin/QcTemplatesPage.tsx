import React from 'react';
import { designsApi, qcTemplatesApi } from '../../api/adminApi';
import type { GarmentCategoryOption, QcCheck, QcTemplate } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { fmtDate } from '../../utils/date';
import s from './QcTemplatesPage.module.css';
// [CM-20-7] The rules and the row editor are shared with the other QC layer — the two are
// meant to be comparable, so a rule drifting on one side changes what "the same check" means.
import { blankCheck, cleanChecks, checklistError } from './qc/qcChecklist';
import { QcChecklistEditor } from './qc/QcChecklistEditor';
import { UilPlus } from '@iconscout/react-unicons';

// T1-13b: define the inbound-QC checklist (required checks + tolerances) per garment category.
// Phase 2 renders this on the distribution receive-QC form, resolved from the design's category.
export const QcTemplatesPage: React.FC = () => {
  const [categories, setCategories] = React.useState<GarmentCategoryOption[]>([]);
  const [templates, setTemplates] = React.useState<QcTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [catId, setCatId] = React.useState('');
  const [name, setName] = React.useState('');
  const [checks, setChecks] = React.useState<QcCheck[]>([]);
  const [existingId, setExistingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const loadTemplates = React.useCallback(() => {
    qcTemplatesApi.list().then(setTemplates).catch(() => {});
  }, []);

  React.useEffect(() => {
    Promise.all([designsApi.garmentCategories(), qcTemplatesApi.list()])
      .then(([cats, tpls]) => {
        setCategories(cats);
        setTemplates(tpls);
      })
      .catch((e) => toast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, []);

  const selectCategory = (id: string) => {
    setCatId(id);
    if (!id) {
      setName('');
      setChecks([]);
      setExistingId(null);
      return;
    }
    qcTemplatesApi
      .forCategory(id)
      .then((t) => {
        setExistingId(t?.id ?? null);
        setName(t?.name ?? '');
        setChecks(t?.checks?.length ? t.checks : [blankCheck()]);
      })
      .catch((e) => toast('error', 'Failed to load template', e instanceof Error ? e.message : undefined));
  };

  const patchCheck = (i: number, patch: Partial<QcCheck>) =>
    setChecks((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCheck = (i: number) => setChecks((cs) => cs.filter((_, idx) => idx !== i));

  const save = async () => {
    const cleaned = cleanChecks(checks);
    const problem = checklistError(cleaned);
    if (problem) return toast('error', problem);
    setSaving(true);
    try {
      // Drop min/max/unit on boolean checks so the payload is clean.
      const payload = cleaned.map((c) =>
        c.type === 'boolean'
          ? { key: c.key, label: c.label, type: c.type, required: c.required }
          : c,
      );
      await qcTemplatesApi.upsert(catId, { name: name.trim() || undefined, checks: payload });
      toast('success', 'Template saved');
      loadTemplates();
      selectCategory(catId);
    } catch (e) {
      toast('error', 'Could not save', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!existingId) return;
    try {
      await qcTemplatesApi.remove(existingId);
      toast('success', 'Template deleted');
      setConfirmDelete(false);
      loadTemplates();
      selectCategory(catId);
    } catch (e) {
      toast('error', 'Could not delete', e instanceof Error ? e.message : undefined);
    }
  };

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  // [CM-20-8] The stored template for the category being edited — the source of the reach
  // figures the delete confirm quotes. `checks` in state is the DRAFT; deleting removes
  // what is SAVED, so the confirm must speak from the saved row, not the unsaved edits.
  const currentTemplate = templates.find((t) => t.garment_category_id === catId);

  return (
    <div className={s.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className={s.pageHeader}>
        <h1 className={s.title}>QC Templates</h1>
        {/* [CM-20-5] This described one of the table's two jobs. The same rows are read by
            checksForLayer('house') in the dispatch gate, so a CM authoring "seam strength"
            for a FABRIC RECEIPT was simultaneously defining what a FINISHED GARMENT must
            pass — with nothing on screen saying so. Splitting the two uses into separate
            templates is a bigger change; saying what these rows actually do is not. */}
        <p className={s.subtitle}>
          Per-garment-category QC checklists — the required checks and their pass tolerances.
        </p>
        <p className={s.subtitleWarn}>
          These rows are used <strong>twice</strong>: on the distribution receive-QC form when
          fabric arrives, <strong>and</strong> as the house layer of the garment QC gate at
          dispatch. A check added here has to make sense for both — it decides whether cloth is
          accepted <em>and</em> whether a finished garment may ship.
        </p>
        {/* [CM-20-3] You author the standard; you do not record the verdict. That split was
            invisible here, so a CM had no way to know why their checklist showed no results
            — the usage column below now says "never used", and this says who would change
            that. Recording moved off `orders:write` in SUP-27-1 precisely because it is a
            FLOOR verb: for a third-party garment the verdict is what releases it for
            dispatch, so it belongs to whoever inspected the garment, not to whoever wrote
            the rule and not to the CX role that used to hold it. */}
        <p className={s.subtitle}>
          You author these checks; you do not grade against them. Verdicts are recorded by
          the floor, or in the back office as a logged exception that must state why the
          floor did not — so a checklist here can be correct and still show no results.
        </p>
      </div>

      <div className={s.card}>
        <div className={s.field}>
          <label className={s.fieldLabel}>Garment category</label>
          <select
            className={s.fieldSelect}
            value={catId}
            onChange={(e) => selectCategory(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {catId && (
          <>
            <div className={s.field}>
              <label className={s.fieldLabel}>Template name (optional)</label>
              <input
                className={s.fieldInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. ${catName(catId)} inbound QC`}
              />
            </div>

            <QcChecklistEditor
              checks={checks}
              onPatch={patchCheck}
              onRemove={removeCheck}
              keyPlaceholder="shade"
              labelPlaceholder="Shade ΔE"
            />

            <div className={s.actions}>
              <button className={s.addBtn} onClick={() => setChecks((cs) => [...cs, blankCheck()])}>
                <UilPlus size={15} /> Add check
              </button>
              <Button onClick={save} state={saving ? 'loading' : 'default'}>
                {existingId ? 'Save changes' : 'Create template'}
              </Button>
              {existingId && (
                <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                  Delete template
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className={s.card}>
        <h2 className={s.cardTitle}>Categories with a template</h2>
        {templates.length === 0 ? (
          <p className={s.empty}>No templates yet — pick a category above and add its checks.</p>
        ) : (
          <div>
            {templates.map((t) => (
              <div
                key={t.id}
                className={s.summaryRow}
                onClick={() => selectCategory(t.garment_category_id)}
              >
                <span className={s.summaryName}>{t.category_name ?? t.garment_category_id}</span>
                <span className={s.badge}>
                  {t.checks.length} check{t.checks.length === 1 ? '' : 's'}
                </span>
                {/* [CM-20-9] Is this layer DOING anything? A checklist with checks and no
                    verdicts is indistinguishable from a working one until you say so.
                    "Never used" is a fact worth stating, not a blank to be read past. */}
                <span className={(t.graded ?? 0) > 0 ? s.usage : s.usageIdle}>
                  {(t.graded ?? 0) === 0
                    ? 'never used'
                    : `${t.graded} graded · ${t.failed ?? 0} failed${
                        t.last_graded_at ? ` · last ${fmtDate(t.last_graded_at)}` : ''
                      }`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this QC template?"
        message={
          <>
            {/* [CM-20-8] Name the category, the reach, and BOTH consequences. It named only
                the category and the receiving fallback — not that the house layer of the
                two-layer dispatch gate would then have no checks for this category, and
                not how much grading history stands behind the thing being deleted. */}
            <p>
              Remove the inbound-QC checklist for <strong>{catName(catId)}</strong>, and its{' '}
              <strong>
                {currentTemplate?.checks.length ?? 0} check
                {(currentTemplate?.checks.length ?? 0) === 1 ? '' : 's'}
              </strong>
              .
            </p>
            <p>
              {(currentTemplate?.graded ?? 0) > 0 ? (
                <>
                  <strong>{currentTemplate?.graded}</strong> garment
                  {currentTemplate?.graded === 1 ? ' has' : 's have'} been graded against it.
                  Those records stay; nothing new will be graded.
                </>
              ) : (
                <>No garment has been graded against it yet.</>
              )}
            </p>
            <p>
              Afterwards, receiving for this category falls back to the uniform
              accept/hold/reject gate, and the <strong>house layer of the dispatch gate</strong>{' '}
              will have no checks for it.
            </p>
          </>
        }
        confirmLabel="Delete template"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default QcTemplatesPage;
