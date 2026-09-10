/**
 * [CM-20-7] Exercises the QC checklist rules that QC-1 (house) and QC-2 (brand) now share.
 *
 * Both layers used to carry their own verbatim copy. They are meant to be COMPARABLE, so a
 * rule drifting on one side silently changes what "the same check" means between them —
 * which makes these rules exactly the kind worth pinning.
 *
 * The admin has no test runner; this follows verify-banner-reuse.mjs and compiles with the
 * project's own TypeScript, so CI fetches nothing.
 *
 * Run: node scripts/verify-qc-checklist.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'qc-checklist-'));
execFileSync(
  process.execPath,
  // --noCheck: TRANSPILE, do not typecheck. The type-only `QcCheck` import reaches
  // adminApi.ts, which uses Vite's `import.meta.env` and cannot typecheck outside a Vite
  // build. `npm run build` is what checks these files; this harness only has to RUN them.
  ['node_modules/typescript/bin/tsc', 'src/pages/admin/qc/qcChecklist.ts',
   '--outDir', dir, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
   '--noCheck'],
  { stdio: 'inherit' },
);
const mjs = join(dir, 'qcChecklist.mjs');
renameSync(join(dir, 'pages/admin/qc/qcChecklist.js'), mjs);
const { blankCheck, cleanChecks, checklistError } = await import(pathToFileURL(mjs).href);

let failed = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) return console.log(`PASS  ${label}`);
  failed++;
  console.log(`FAIL  ${label}\n        got  ${g}\n        want ${w}`);
};

const chk = (o = {}) => ({ ...blankCheck(), key: 'shade', label: 'Shade', min: 0, max: 1, ...o });

// ── blankCheck ──
eq('a new row is numeric and required', [blankCheck().type, blankCheck().required], ['numeric', true]);
eq('a new row carries no tolerances yet', [blankCheck().min, blankCheck().max], [null, null]);

// ── cleanChecks ──
eq('trims key and label', cleanChecks([chk({ key: ' a_b ', label: ' L ' })])[0].key, 'a_b');
eq('drops a wholly blank row rather than rejecting it',
   cleanChecks([chk(), { ...blankCheck() }]).length, 1);
eq('keeps a half-filled row so the error can name it',
   cleanChecks([{ ...blankCheck(), key: 'x' }]).length, 1);

// ── checklistError, in its deliberate order ──
eq('an empty list is the first complaint', checklistError([]), 'Add at least one check');
eq('a missing label is caught before the key format is judged',
   checklistError(cleanChecks([{ ...blankCheck(), key: 'BAD KEY' }])),
   'Every check needs a key and a label');
eq('keys must be lower_snake_case',
   checklistError([chk({ key: 'Shade' })]), 'Check keys must be lower_snake_case');
eq('a hyphen is not snake case',
   checklistError([chk({ key: 'shade-x' })]), 'Check keys must be lower_snake_case');
eq('digits and underscores are fine', checklistError([chk({ key: 'seam_2' })]), null);
eq('duplicate keys are refused',
   checklistError([chk({ key: 'a' }), chk({ key: 'a', label: 'Other' })]),
   'Check keys must be unique');
eq('a numeric check with neither bound is refused',
   checklistError([chk({ min: null, max: null })]),
   'A numeric check needs a min and/or max tolerance');
eq('min alone is enough', checklistError([chk({ min: 0, max: null })]), null);
eq('max alone is enough', checklistError([chk({ min: null, max: 5 })]), null);
eq('a NON-numeric check needs no tolerance at all',
   checklistError([chk({ type: 'boolean', min: null, max: null })]), null);
eq('a valid checklist reports nothing', checklistError([chk()]), null);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
