import React from 'react';
import { designsApi } from '../../api/adminApi';
import type { TemplateVersionRow, TemplateVersionDetail, TemplateChange } from '../../api/adminApi';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { Spinner } from '../Spinner';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { Can } from '../Can/Can';
import s from './TemplateHistory.module.css';

/**
 * [DSG-11-9] The revision history of a garment type's fit recipe.
 *
 * The console overwrote the recipe in place. The only trace a save left was an audit row
 * of COUNTS — `{"sizes":1,"fields":3,"presets":1}` — so "who widened the chest by two
 * inches last month, and what was it before?" could not be answered from the admin at all,
 * about a garment that had already been cut wrong.
 *
 * This panel is the answer to that question, and the ONLY consumer-facing part of the fix
 * that a person sees. So it is built around the named change, not the timestamp: a version
 * row that says "3 changes" and nothing else would be the same failure in a nicer font.
 */

/** A value as it should read in a diff cell. `null` is an absence, and says so. */
function renderValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span className={s.absent}>not set</span>;
  if (typeof v === 'object') return <code className={s.code}>{JSON.stringify(v)}</code>;
  if (v === '') return <span className={s.absent}>empty</span>;
  return <code className={s.code}>{String(v)}</code>;
}

const ChangeList: React.FC<{ changes: TemplateChange[]; total: number; truncated: boolean }> = ({
  changes,
  total,
  truncated,
}) => {
  if (!total) return <p className={s.none}>Nothing changed in this save.</p>;
  return (
    <>
      <table className={s.diff}>
        <thead>
          <tr>
            <th>What</th>
            <th>Was</th>
            <th>Became</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.path}>
              <th scope="row" className={s.path}>{c.path}</th>
              <td className={s.was}>{renderValue(c.from)}</td>
              <td className={s.became}>{renderValue(c.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Say it, rather than let the list end and imply that was all of it. */}
      {truncated && (
        <p className={s.truncated}>
          Showing the first {changes.length} of {total} changes.
        </p>
      )}
    </>
  );
};

const sourceLabel: Record<string, string> = {
  save: 'Saved',
  baseline: 'Before versioning',
  restore: 'Restored',
};

export interface TemplateHistoryProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  templateName: string;
  /** The version the editor is currently showing, so "you are here" is visible. */
  currentVersion: number;
  /** True while the editor holds unsaved edits — a restore would discard them. */
  dirty: boolean;
  /** Called after a successful restore with the template the server returned. */
  onRestored: (t: Awaited<ReturnType<typeof designsApi.restoreTemplateVersion>>) => void;
  onError: (message: string) => void;
}

export const TemplateHistory: React.FC<TemplateHistoryProps> = ({
  open,
  onClose,
  categoryId,
  templateName,
  currentVersion,
  dirty,
  onRestored,
  onError,
}) => {
  const [rows, setRows] = React.useState<TemplateVersionRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  // [DSG-11-12 pattern] A failure is its own state, not an empty list. "No history yet" for
  // a template with forty saves would be a new lie on the page built to stop lying.
  const [error, setError] = React.useState<string | null>(null);
  const [openVersion, setOpenVersion] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<TemplateVersionDetail | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [restoreTarget, setRestoreTarget] = React.useState<number | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    designsApi
      .listTemplateVersions(categoryId)
      .then(setRows)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load this template's history."),
      )
      .finally(() => setLoading(false));
  }, [categoryId]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Expanding a row fetches the full record, because the list deliberately does not carry
  // forty snapshots. `diff_vs_current` is the one the reader wants and cannot precompute.
  const expand = (version: number) => {
    if (openVersion === version) {
      setOpenVersion(null);
      return;
    }
    setOpenVersion(version);
    setDetail(null);
    setDetailBusy(true);
    designsApi
      .getTemplateVersion(categoryId, version)
      .then(setDetail)
      .catch((e: unknown) =>
        onError(e instanceof Error ? e.message : `Couldn't load version ${version}.`),
      )
      .finally(() => setDetailBusy(false));
  };

  const doRestore = async () => {
    if (restoreTarget == null) return;
    setRestoring(true);
    try {
      const t = await designsApi.restoreTemplateVersion(categoryId, restoreTarget);
      onRestored(t);
      setRestoreTarget(null);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={`History — ${templateName}`} size="lg">
        {loading && <Spinner />}

        {!loading && error && (
          <div className={s.error}>
            <p>{error}</p>
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && rows?.length === 0 && (
          <p className={s.none}>
            No revisions recorded yet. The next save records this recipe's current state as a
            restorable baseline, and every save after it as a change.
          </p>
        )}

        {!loading && !error && !!rows?.length && (
          <ol className={s.list}>
            {rows.map((v) => (
              <li key={v.version} className={v.version === currentVersion ? s.current : undefined}>
                <button
                  type="button"
                  className={s.rowBtn}
                  onClick={() => expand(v.version)}
                  aria-expanded={openVersion === v.version}
                >
                  <span className={s.vno}>v{v.version}</span>
                  <span className={s.meta}>
                    <strong>{sourceLabel[v.source] ?? v.source}</strong>
                    {' by '}
                    {/* The baseline has no author. Naming one would be a small lie about
                        who touched the recipe. */}
                    {v.created_by ? v.created_by.name : <em>the system</em>}
                    {' · '}
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                  <span className={s.count}>
                    {v.changed === 1 ? '1 change' : `${v.changed} changes`}
                  </span>
                  {v.version === currentVersion && <span className={s.hereChip}>you are here</span>}
                </button>
                {v.note && <p className={s.note}>“{v.note}”</p>}

                {openVersion === v.version && (
                  <div className={s.detail}>
                    {detailBusy && <Spinner />}
                    {!detailBusy && detail?.version === v.version && (
                      <>
                        <h4 className={s.detailTitle}>What this save changed</h4>
                        <ChangeList
                          changes={detail.diff.changes ?? []}
                          total={detail.diff.total ?? 0}
                          truncated={Boolean(detail.diff.truncated)}
                        />
                        {v.version !== currentVersion && (
                          <>
                            <h4 className={s.detailTitle}>
                              What restoring it would change now
                            </h4>
                            <ChangeList
                              changes={detail.diff_vs_current.changes ?? []}
                              total={detail.diff_vs_current.total ?? 0}
                              truncated={Boolean(detail.diff_vs_current.truncated)}
                            />
                            <Can cap="designs:write">
                              <Button
                                variant="secondary"
                                onClick={() => setRestoreTarget(v.version)}
                              >
                                Restore this version
                              </Button>
                            </Can>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Modal>

      <ConfirmDialog
        open={restoreTarget != null}
        title={`Restore version ${restoreTarget}?`}
        variant="danger"
        confirmLabel="Restore"
        loading={restoring}
        message={
          <>
            <p>
              This replaces the whole recipe — size chart, fit presets, length bands and
              capture set — with what version {restoreTarget} held. Designs of type “
              {templateName}” are drafted from it immediately.
            </p>
            <p>
              Nothing is lost: the restore is recorded as a new version, so the current
              recipe stays in the history and can be restored back.
            </p>
            {/* The one thing a restore really does destroy. */}
            {dirty && (
              <p>
                <strong>Your unsaved edits on this page will be discarded.</strong>
              </p>
            )}
          </>
        }
        onConfirm={doRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </>
  );
};
