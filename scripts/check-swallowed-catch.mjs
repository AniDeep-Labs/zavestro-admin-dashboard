#!/usr/bin/env node
// [RC-3] SWALLOWED-CATCH RATCHET — an empty state must say WHICH empty.
//
// Wave 4's house rule: every list and panel distinguishes empty · loading · denied · failed,
// and **no `catch(() => {})` may render a value**. `components/EmptyState/AsyncPanel.tsx` is the
// component that enforces it, and `asyncState.ts` (`isDenied`, `errorMessage`) is how a page
// tells a 403 from a quiet day.
//
// Wave 4 applied the rule to the panels the audit had named and stopped there. The rest of the
// console still discards its errors, so a denial or a network failure renders as a FACT ABOUT
// THE BUSINESS: "No fit profiles found for this customer" for a 403, "0 customers total" for a
// refused list, "All clear — nothing needs you right now ✓" for a role-less account. Those are
// not cosmetic — "No notes yet" hides a fraud note, and an empty credit ledger beside a balance
// from another source is money with no history.
//
// Fixing all of them at once is a wave of its own, so this is a RATCHET rather than a gate,
// following check-style-debt.mjs: the current count is frozen per file and any INCREASE fails.
// New debt is un-mergeable; the tail burns down a page at a time.
//
// A swallowed catch on a post-action REFRESH counts too. It is quieter — the screen keeps stale
// rows under a success toast — but the operator is still being told something that is not true.
//
//   node scripts/check-swallowed-catch.mjs            # check (CI)
//   node scripts/check-swallowed-catch.mjs --update   # re-baseline after a burndown
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', 'swallowed-catch-baseline.json');

// `catch(() => {})`, `.catch(() => {})`, `catch {}` and `catch { }` — the forms that keep
// nothing. A catch that stores the error, toasts, or logs is not debt and is not matched.
const SWALLOW_RE = /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)|catch\s*\{\s*\}/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) yield p;
  }
}

const counts = {};
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const n = (src.match(SWALLOW_RE) ?? []).length;
  if (n > 0) counts[rel] = n;
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`swallowed-catch baseline updated — ${total} in ${Object.keys(counts).length} files.`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('No baseline. Run: node scripts/check-swallowed-catch.mjs --update');
  process.exit(1);
}

const worse = [];
const better = [];
for (const [f, n] of Object.entries(counts)) {
  const was = baseline[f] ?? 0;
  if (n > was) worse.push(`${f}: ${was} → ${n}`);
}
for (const [f, was] of Object.entries(baseline)) {
  const n = counts[f] ?? 0;
  if (n < was) better.push(`${f}: ${was} → ${n}`);
}

if (worse.length) {
  console.error('[RC-3] swallowed-catch ratchet FAILED — new discarded errors:\n');
  for (const w of worse) console.error('  ✗ ' + w);
  console.error(
    '\nKeep the error instead of discarding it, and let the panel say which empty:\n' +
      "  const [rows, setRows] = useState<T[] | null>(null);\n" +
      "  const [rowsErr, setRowsErr] = useState<unknown>(null);\n" +
      "  api.list().then(setRows).catch(setRowsErr);\n" +
      "  <AsyncPanel loading={!rows && !rowsErr} error={rowsErr} isEmpty={rows?.length === 0} …>\n" +
      '\nSee src/components/EmptyState/AsyncPanel.tsx.\n',
  );
  process.exit(1);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (better.length) {
  console.log(`[RC-3] swallowed catches DOWN in ${better.length} file(s):`);
  for (const b of better) console.log('  ✓ ' + b);
  console.log('  Ratchet the baseline: node scripts/check-swallowed-catch.mjs --update');
}
console.log(`[RC-3] swallowed-catch ratchet OK — ${total} remaining (no increase).`);
