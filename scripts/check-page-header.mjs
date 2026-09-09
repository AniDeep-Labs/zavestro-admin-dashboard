#!/usr/bin/env node
// PAGE-HEADER RATCHET — [KA11-5] · ACP-5
//
// The craft audit measured it: the pages carrying an eyebrow → title → subtitle → actions
// header are the better pages, and finance and the call console score highest largely
// because of their subtitles. A subtitle is where a page says what it is FOR — which of two
// similar tables this is, what its numbers mean, what it does not cover.
//
// `PageHeader` already exists and `subtitle` is now REQUIRED on it, so a page that adopts the
// component cannot ship without one. What that does not fix is the pages which never adopted
// it and hand-roll a heading instead.
//
// A RATCHET, not a gate. Migrating the remaining pages is a real piece of work with real
// judgement in it — each needs a subtitle someone actually means — and doing it blind would
// produce 58 filler sentences, which is worse than none. This freezes the count so it can
// only fall, and names the pages so the next person can take them a few at a time.
//
//   node scripts/check-page-header.mjs            # verify (CI / npm run guards)
//   node scripts/check-page-header.mjs --update   # re-baseline after migrating some
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PAGES_DIR = 'src/pages/admin';
const BASELINE = 'scripts/page-header-baseline.json';

// Modals, panels and embedded editors are not pages and need no page header.
const NOT_A_PAGE = /(Modal|Panel|Studio|Editor)\.tsx$/;

const offenders = readdirSync(PAGES_DIR)
  .filter((f) => f.endsWith('.tsx') && !NOT_A_PAGE.test(f))
  .filter((f) => !readFileSync(join(PAGES_DIR, f), 'utf8').includes('<PageHeader'))
  .sort();

const update = process.argv.includes('--update');
if (update) {
  writeFileSync(BASELINE, JSON.stringify({ count: offenders.length, files: offenders }, null, 2) + '\n');
  console.log(`page-header baseline updated — ${offenders.length} page(s) without <PageHeader>.`);
  process.exit(0);
}

let base;
try {
  base = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error(`[KA11-5] no baseline at ${BASELINE} — run with --update once.`);
  process.exit(1);
}

const added = offenders.filter((f) => !base.files.includes(f));
if (added.length) {
  console.error('[KA11-5] page-header ratchet FAILED — new page(s) without <PageHeader>:');
  for (const f of added) console.error(`  ✗ ${f}`);
  console.error('\n  Use <PageHeader eyebrow title subtitle actions>. The subtitle is required:');
  console.error('  say what the page is for, which of two similar tables this is, or what it does not cover.');
  process.exit(1);
}

const fixed = base.files.filter((f) => !offenders.includes(f));
if (fixed.length) {
  console.log(`[KA11-5] page-header adopted by ${fixed.length} more page(s):`);
  for (const f of fixed) console.log(`  ✓ ${f}`);
  console.log('  Ratchet the baseline: node scripts/check-page-header.mjs --update');
}
console.log(`[KA11-5] page-header ratchet OK — ${offenders.length} page(s) still hand-rolled (no increase).`);
