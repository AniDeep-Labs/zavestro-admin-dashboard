import React from 'react';
import { isDenied, errorMessage } from './asyncState';
import styles from './PickerNote.module.css';

/**
 * Why a picker is empty — [RC-3] for dropdowns.
 *
 * A select whose options failed to load renders as a select with no options, which reads
 * as "there are none" and sends an operator looking for the record they are sure exists.
 * The panels got this treatment in Wave 4; the pickers are the long tail the checklist
 * names, and they are the ones that block the actual job: you cannot file a listing
 * request against a design list that silently came back empty.
 *
 * ## Denied is not the same as broken, and must not shout
 *
 * The checklist records this being got wrong twice: a naive error state fired on EVERY
 * load for a role that is legitimately 403 on that endpoint — worse than the swallow it
 * replaced, because now the console cries wolf at someone who is working normally.
 *
 * So a denial says one quiet sentence and offers nothing to retry (retrying a 403 is
 * theatre). A genuine failure says so and offers the retry, because that one is worth
 * trying again.
 *
 * Renders nothing at all when there is no error — the healthy path must be untouched.
 */
export const PickerNote: React.FC<{
  error: unknown;
  /** What the picker holds, for the sentence: "designs", "hubs", "fabrics". */
  noun: string;
  onRetry?: () => void;
}> = ({ error, noun, onRetry }) => {
  if (!error) return null;

  if (isDenied(error)) {
    return (
      <span className={styles.denied}>
        Your role cannot list {noun} — this is not an empty {noun} list.
      </span>
    );
  }

  const detail = errorMessage(error);
  return (
    <span className={styles.failed}>
      Couldn&apos;t load {noun}
      {detail ? ` — ${detail}` : ''}. This is not an empty list.
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      )}
    </span>
  );
};
