import React from 'react';
import { EmptyState } from './EmptyState';
import type { EmptyStateProps } from './EmptyState';
import { isDenied, errorMessage } from './asyncState';

/**
 * RC-3 — an empty state must say WHICH empty.
 *
 * The house rule this component exists to enforce: **every list and panel
 * distinguishes empty · loading · denied · failed, and no `catch(() => {})` may
 * render a value.**
 *
 * The audit found the same defect on body data, on CX context, on money and on a
 * zero-capability account's dashboard: a request fails, the catch swallows it, and
 * the UI renders the *absence* as a *fact about the business*. A 403 on
 * `/users/:id/fit-profiles` read "No fit profiles found for this customer."; a
 * denied customers list read "0 customers total"; a role-less account was told
 * "All clear — nothing needs you right now ✓".
 *
 * Those are not cosmetic. "No notes yet" hides a fraud note. "No open re-measure
 * request" makes an agent raise a duplicate. An empty credit ledger under a
 * balance taken from a different source is money with no history. And a denial
 * rendered as emptiness tells an operator the business is quiet when in fact the
 * screen simply refused them.
 *
 * Usage — the catch keeps the error instead of discarding it:
 *
 *   const [notes, setNotes] = useState<Note[] | null>(null);
 *   const [notesErr, setNotesErr] = useState<unknown>(null);
 *   api.notes(id).then(setNotes).catch(setNotesErr);
 *
 *   <AsyncPanel
 *     loading={notes === null && !notesErr}
 *     error={notesErr}
 *     isEmpty={notes?.length === 0}
 *     empty={{ title: 'No notes yet', body: 'Notes you add appear here.' }}
 *   >
 *     {notes?.map(...)}
 *   </AsyncPanel>
 */

export interface AsyncPanelProps {
  /** True while the request is in flight — NOT the same as "the result was empty". */
  loading?: boolean;
  /** The caught error, kept rather than swallowed. */
  error?: unknown;
  /** True when the request SUCCEEDED and returned nothing. */
  isEmpty?: boolean;
  /** What to say when it genuinely is empty. */
  empty: Pick<EmptyStateProps, 'title' | 'body' | 'action' | 'icon'>;
  /** Optional retry for the failed branch. */
  onRetry?: () => void;
  size?: EmptyStateProps['size'];
  children?: React.ReactNode;
}

export const AsyncPanel: React.FC<AsyncPanelProps> = ({
  loading,
  error,
  isEmpty,
  empty,
  onRetry,
  size = 'compact',
  children,
}) => {
  // Order matters: loading, then failure, then emptiness. Emptiness is the ONLY
  // one of the three that is a statement about the business, so it must be the
  // last thing considered and never a fallback for the other two.
  if (loading) {
    return <EmptyState size={size} title="Loading…" />;
  }

  if (error) {
    return isDenied(error) ? (
      <EmptyState
        size={size}
        title="You don't have access to this"
        body={
          errorMessage(error) ??
          'Your admin role cannot view this section. Nothing is missing — it is not being shown to you.'
        }
      />
    ) : (
      <EmptyState
        size={size}
        title="Couldn't load this"
        body={errorMessage(error) ?? 'Something went wrong fetching this section.'}
        action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
      />
    );
  }

  if (isEmpty) return <EmptyState size={size} {...empty} />;

  return <>{children}</>;
};

export default AsyncPanel;
