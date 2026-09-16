/**
 * The storage half of the recoverable draft — [DSG-10-4].
 *
 * Split from the hook so it carries no React import, which makes it directly runnable by
 * `scripts/verify-draft.mjs`. The two things here are the two that can actually lose an
 * author's work: whether a stored draft is readable, and whether storage failing takes the
 * editor down with it.
 */
export interface StoredDraft {
  /** The form snapshot, in the caller's own serialised shape. */
  snapshot: string;
  /** The server-loaded baseline this draft was taken against. */
  basedOn: string;
  /** Epoch ms. */
  savedAt: number;
  /** Which wizard step the author was on, so they return where they left. */
  step: number;
}

const PREFIX = 'zav-draft:';

/**
 * Storage can be unavailable for the whole session (a privacy mode, a full quota), so the
 * warning is said ONCE. [RC-3] bans discarding the error, and rightly: silence here is how
 * you end up unable to explain why drafts never appear for one particular user. It is a
 * console warning rather than a toast because a missing draft is not an event the author
 * did anything to cause.
 */
let storageWarned = false;
function noteStorageFailure(op: string, err: unknown): void {
  if (storageWarned) return;
  storageWarned = true;
  console.warn(`[draft] localStorage ${op} failed — drafts are disabled this session`, err);
}

/**
 * Every access is wrapped. `localStorage` throws outright in some privacy modes and when
 * the quota is full, and a form that cannot save a draft must still work. A draft is a
 * convenience; it may never be the reason the editor fails to open.
 */
export function readDraft(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as StoredDraft;
    if (typeof d?.snapshot !== 'string' || typeof d?.basedOn !== 'string') return null;
    return d;
  } catch (err) {
    noteStorageFailure('read', err);
    return null;
  }
}

export function writeDraft(key: string, d: StoredDraft): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(d));
  } catch (err) {
    noteStorageFailure('write', err);
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (err) {
    noteStorageFailure('clear', err);
  }
}

/** "3 minutes ago" — enough for someone to recognise their own work. */
export function draftAge(savedAt: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - savedAt) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
