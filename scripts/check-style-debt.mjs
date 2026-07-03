#!/usr/bin/env node
// Style-debt RATCHET (FABLE-ADMIN-UIUX §2.1 / report §6.4 CI guards).
//
// Counts (a) inline `style={{` usages per .tsx file and (b) raw hex colors per
// .css file (outside the token file), then compares against the committed
// baseline. Any INCREASE fails the build — new debt is un-mergeable. Decreases
// print a reminder to ratchet the baseline down (run with --update).
//
//   node scripts/check-style-debt.mjs            # check (CI)
//   node scripts/check-style-debt.mjs --update   # rewrite baseline after a burndown
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', 'style-debt-baseline.json');

// Token files are the ONLY place raw colors may live.
const TOKEN_FILES = new Set(['src/styles/variables.css']);

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const INLINE_RE = /style=\{\{/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const counts = {};
for (const p of walk(SRC)) {
  const rel = relative(ROOT, p);
  if (p.endsWith('.tsx')) {
    const n = (readFileSync(p, 'utf8').match(INLINE_RE) ?? []).length;
    if (n > 0) counts[rel] = (counts[rel] ?? 0) + n;
  } else if (p.endsWith('.css') && !TOKEN_FILES.has(rel)) {
    const n = (readFileSync(p, 'utf8').match(HEX_RE) ?? []).length;
    if (n > 0) counts[rel] = (counts[rel] ?? 0) + n;
  }
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
  console.log(`style-debt baseline updated (${Object.keys(counts).length} files).`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('No baseline found — run: node scripts/check-style-debt.mjs --update');
  process.exit(1);
}

const regressions = [];
let improved = 0;
for (const [file, n] of Object.entries(counts)) {
  const base = baseline[file] ?? 0;
  if (n > base) regressions.push(`  ${file}: ${base} → ${n}`);
  else if (n < base) improved++;
}
for (const file of Object.keys(baseline)) {
  if (!(file in counts)) improved++;
}

if (regressions.length) {
  console.error('✖ Style debt INCREASED (inline style={{}} or raw hex outside variables.css):');
  console.error(regressions.join('\n'));
  console.error('\nUse design tokens + CSS modules instead. (FABLE-ADMIN-UIUX §2)');
  process.exit(1);
}
if (improved > 0) {
  console.log(`✓ Style debt reduced in ${improved} file(s) — ratchet it: node scripts/check-style-debt.mjs --update`);
} else {
  console.log('✓ Style debt unchanged.');
}
