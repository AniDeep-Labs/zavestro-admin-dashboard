import React from 'react';
import { useParams } from 'react-router-dom';
import { qcResultsApi } from '../../api/adminApi';
import type { QcCheck, QcResultContext, QcResultAnswer } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Button } from '../../components/Button/Button';
import { Can } from '../../components/Can/Can';
// Reuses the QC Templates layout (cards, table, fields) for visual consistency.
import s from './QcTemplatesPage.module.css';

type LayerAnswers = Record<string, { value?: number | null; pass?: boolean | null }>;
type Layer = 'house' | 'brand';

// T3-4: enter a garment's QC results per layer. A 3P garment needs both house QC-1 and brand
// QC-2 at 'pass' before it can dispatch; a house garment runs QC-1 only.
export const QcResultPage: React.FC = () => {
  const { orderItemId = '' } = useParams();
  const [ctx, setCtx] = React.useState<QcResultContext | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Record<Layer, LayerAnswers>>({ house: {}, brand: {} });
  const [notes, setNotes] = React.useState<Record<Layer, string>>({ house: '', brand: '' });
  const [saving, setSaving] = React.useState<Layer | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    if (!orderItemId) return;
    setLoading(true);
    setError(null);
    qcResultsApi
      .get(orderItemId)
      .then((c) => {
        setCtx(c);
        // Pre-fill each layer's answers + note from any already-recorded result.
        const seed: Record<Layer, LayerAnswers> = { house: {}, brand: {} };
        const seedNotes: Record<Layer, string> = { house: '', brand: '' };
        for (const r of c.results) {
          seedNotes[r.layer] = r.note ?? '';
          for (const a of r.answers ?? []) {
            seed[r.layer][a.key] = { value: a.value ?? null, pass: a.pass ?? null };
          }
        }
        setAnswers(seed);
        setNotes(seedNotes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load QC context'))
      .finally(() => setLoading(false));
  }, [orderItemId]);

  React.useEffect(() => load(), [load]);

  const setAnswer = (layer: Layer, key: string, patch: { value?: number | null; pass?: boolean | null }) =>
    setAnswers((a) => ({ ...a, [layer]: { ...a[layer], [key]: { ...a[layer][key], ...patch } } }));

  const record = async (layer: Layer, checks: QcCheck[]) => {
    const payload: QcResultAnswer[] = checks.map((c) => {
      const a = answers[layer][c.key] ?? {};
      return c.type === 'numeric'
        ? { key: c.key, value: a.value ?? null }
        : { key: c.key, pass: a.pass ?? null };
    });
    setSaving(layer);
    try {
      const { verdict, failed } = await qcResultsApi.record(orderItemId, {
        layer,
        answers: payload,
        note: notes[layer] || undefined,
      });
      toast(
        verdict === 'pass' ? 'success' : 'error',
        `QC-${layer === 'house' ? '1' : '2'} recorded — ${verdict.toUpperCase()}`,
        failed.length ? `Failed: ${failed.join(', ')}` : undefined,
      );
      load();
    } catch (e) {
      toast('error', 'Could not record', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(null);
    }
  };

  const verdictFor = (layer: Layer) => ctx?.results.find((r) => r.layer === layer)?.verdict ?? null;

  const layerCard = (layer: Layer, title: string, checks: QcCheck[]) => {
    const verdict = verdictFor(layer);
    return (
      <div className={s.card} key={layer}>
        <div className={s.pageHeader}>
          <h2 className={s.cardTitle}>
            {title}
            {verdict && <span className={s.badge}> verdict: {verdict}</span>}
          </h2>
        </div>
        {checks.length === 0 ? (
          <p className={s.empty}>
            No checks configured for this layer / category — nothing to grade.
          </p>
        ) : (
          <>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Result</th>
                  <th>Spec</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.key}>
                    <td>
                      {c.label}
                      {c.required && <span className={s.muted}> *</span>}
                    </td>
                    <td>
                      {c.type === 'numeric' ? (
                        <input
                          className={s.cellInput}
                          type="number"
                          value={answers[layer][c.key]?.value ?? ''}
                          onChange={(e) =>
                            setAnswer(layer, c.key, {
                              value: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      ) : (
                        <select
                          className={s.cellInput}
                          value={
                            answers[layer][c.key]?.pass == null
                              ? ''
                              : answers[layer][c.key]?.pass
                                ? 'pass'
                                : 'fail'
                          }
                          onChange={(e) =>
                            setAnswer(layer, c.key, {
                              pass: e.target.value === '' ? null : e.target.value === 'pass',
                            })
                          }
                        >
                          <option value="">—</option>
                          <option value="pass">pass</option>
                          <option value="fail">fail</option>
                        </select>
                      )}
                    </td>
                    <td className={s.muted}>
                      {c.type === 'numeric'
                        ? `${c.min ?? '−∞'}–${c.max ?? '∞'}${c.unit ? ` ${c.unit}` : ''}`
                        : 'pass/fail'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={s.field}>
              <label className={s.fieldLabel}>Note (optional)</label>
              <input
                className={s.fieldInput}
                value={notes[layer]}
                onChange={(e) => setNotes((n) => ({ ...n, [layer]: e.target.value }))}
              />
            </div>
            <div className={s.actions}>
              <Can cap="orders:write">
                <Button onClick={() => record(layer, checks)} state={saving === layer ? 'loading' : 'default'}>
                  Record QC-{layer === 'house' ? '1' : '2'}
                </Button>
              </Can>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={s.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className={s.pageHeader}>
        <h1 className={s.title}>QC results</h1>
        <p className={s.subtitle}>
          {ctx
            ? `${ctx.category_name ?? 'Uncategorised'} · ${
                ctx.is_house ? 'House brand — QC-1 only' : `3rd-party (${ctx.brand_name ?? 'brand'}) — needs QC-1 + QC-2`
              }`
            : 'Enter house QC-1 and, for third-party garments, brand QC-2.'}
        </p>
      </div>

      {loading && <p className={s.empty}>Loading…</p>}
      {error && !loading && (
        <div className={s.card}>
          <p className={s.empty}>{error}</p>
          <div className={s.actions}>
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {ctx && !loading && (
        <>
          {layerCard('house', 'QC-1 · House', ctx.house_checks)}
          {ctx.is_house ? (
            <div className={s.card}>
              <p className={s.empty}>House-brand garment — only QC-1 applies (no brand QC-2 layer).</p>
            </div>
          ) : (
            layerCard('brand', `QC-2 · ${ctx.brand_name ?? 'Brand'}`, ctx.brand_checks)
          )}
        </>
      )}
    </div>
  );
};

export default QcResultPage;
