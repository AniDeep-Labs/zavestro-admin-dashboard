/**
 * [CM-20-7] The QC checklist row editor, shared by both layers.
 *
 * `BrandQcPage` and `QcTemplatesPage` held this table verbatim — the same columns, the same
 * inputs, the same remove button. The only difference between the two copies was two
 * placeholder strings, which are now props.
 *
 * One shared editor is what keeps QC-1 and QC-2 from drifting, and the two layers are meant
 * to be comparable: a column added to one copy and not the other would make "the same check"
 * mean two things.
 */
import React from 'react';
import type { QcCheck } from '../../../api/adminApi';
import { UilTrashAlt } from '@iconscout/react-unicons';
import s from '../QcTemplatesPage.module.css';

export const QcChecklistEditor: React.FC<{
  checks: QcCheck[];
  onPatch: (i: number, patch: Partial<QcCheck>) => void;
  onRemove: (i: number) => void;
  /** Example key for this layer — e.g. `shade` (house) vs `stitch_gauge` (brand). */
  keyPlaceholder: string;
  /** Example label, matching the key. */
  labelPlaceholder: string;
}> = ({ checks, onPatch, onRemove, keyPlaceholder, labelPlaceholder }) => {
  const patchCheck = onPatch;
  const removeCheck = onRemove;
  return (
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
                          placeholder={keyPlaceholder}
                        />
                      </td>
                      <td>
                        <input
                          className={s.cellInput}
                          value={c.label}
                          onChange={(e) => patchCheck(i, { label: e.target.value })}
                          placeholder={labelPlaceholder}
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
                            placeholder="%"
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
  );
};
