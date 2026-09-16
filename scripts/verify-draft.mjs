/**
 * [DSG-10-4] The recoverable draft's non-React parts.
 *
 * The hook itself needs a renderer, but the two things that can actually lose work are
 * pure: whether a stored draft is offered at all, and whether localStorage failing takes
 * the editor down with it. Both are asserted here.
 *
 * Run: node scripts/verify-draft.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'draft-'));
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', 'src/hooks/draftStorage.ts',
   '--outDir', dir, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
   '--noCheck', '--jsx', 'react-jsx'],
  { stdio: 'inherit' },
);
const mjs = join(dir, 'draftStorage.mjs');
renameSync(join(dir, 'draftStorage.js'), mjs);

let failed = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) return console.log(`PASS  ${label}`);
  failed++;
  console.error(`FAIL  ${label}\n        got  ${g}\n        want ${w}`);
};

// A localStorage that behaves, then one that throws the way a privacy mode does.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis;

const { clearDraft, draftAge } = await import(pathToFileURL(mjs).href);

// ── draftAge: an author has to recognise their own work ──────────────────────
const T = 1_700_000_000_000;
eq('under a minute reads "just now"', draftAge(T - 20_000, T), 'just now');
eq('one minute is singular', draftAge(T - 60_000, T), '1 minute ago');
eq('minutes are plural', draftAge(T - 300_000, T), '5 minutes ago');
eq('an hour', draftAge(T - 3_600_000, T), '1 hour ago');
eq('hours', draftAge(T - 7_200_000, T), '2 hours ago');
eq('a day', draftAge(T - 86_400_000, T), '1 day ago');
eq('days', draftAge(T - 3 * 86_400_000, T), '3 days ago');
// A clock that has gone backwards must not print a negative age.
eq('a future timestamp does not read as negative', draftAge(T + 60_000, T), 'just now');

// ── clearDraft ───────────────────────────────────────────────────────────────
store.set('zav-draft:design:1', '{"snapshot":"x","basedOn":"y","savedAt":1,"step":0}');
clearDraft('design:1');
eq('clearDraft removes the key', store.has('zav-draft:design:1'), false);
eq('clearing a key that is not there is not an error', clearDraft('design:none'), undefined);

// ── storage that throws: a draft is a convenience, never a reason to fail ────
globalThis.localStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};
eq('clearDraft survives storage that throws', clearDraft('design:1'), undefined);

console.log(failed ? `\n${failed} draft check(s) FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
