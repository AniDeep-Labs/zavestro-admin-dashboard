/**
 * [SHL-0-6] The component canon exists and is partly unused; pages hand-roll around it.
 *
 * Measured, not eyeballed. `src/components/` holds canon components — all exported from the
 * barrel — and page stylesheets keep redefining the same primitives beside them:
 *
 *     StatusBadge   used by 38 pages   `.statusPill` redefined in 14 page stylesheets
 *     PageHeader    used by 24 pages   `.pageHeader` redefined in 20
 *     EmptyState    used by 22 pages   `.empty`      redefined in 31
 *
 * Each copy is a place the design can drift: a status pill that is a different height on one
 * page, an empty state that says nothing useful on another. The canon exists precisely so
 * that "what an empty table looks like" is decided once.
 *
 * A RATCHET, not a gate — and deliberately so. Migrating 65 live definitions is real work
 * that needs somebody who can SEE the result; every one of them is referenced by its page
 * (checked), so none is a free deletion. What this does is stop the number growing, and name
 * the files so the next person can take a few at a time.
 *
 *   node scripts/check-canon-adoption.mjs            # CI
 *   node scripts/check-canon-adoption.mjs --update   # re-baseline after migrating some
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PAGES_DIR = 'src/pages/admin';
const BASELINE = 'scripts/canon-adoption-baseline.json';

/** Hand-rolled primitive → the canon component that already does it. */
const PRIMITIVES = {
  statusPill: 'StatusBadge',
  pageHeader: 'PageHeader',
  empty: 'EmptyState',
};

const sheets = readdirSync(PAGES_DIR).filter((f) => f.endsWith('.module.css'));

const current = {};
for (const [prim, canon] of Object.entries(PRIMITIVES)) {
  // A DEFINITION at the start of a line — not a usage, and not `.emptyBody` or similar.
  const re = new RegExp(`^\\.${prim}\\s*[,{]`, 'm');
  current[prim] = {
    canon,
    files: sheets.filter((f) => re.test(readFileSync(join(PAGES_DIR, f), 'utf8'))).sort(),
  };
}

const update = process.argv.includes('--update');
if (update) {
  const out = Object.fromEntries(
    Object.entries(current).map(([k, v]) => [k, { canon: v.canon, count: v.files.length, files: v.files }]),
  );
  writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n');
  for (const [k, v] of Object.entries(out)) console.log(`  .${k}: ${v.count}`);
  console.log('canon-adoption baseline updated.');
  process.exit(0);
}

let base;
try {
  base = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error(`[SHL-0-6] no baseline at ${BASELINE} — run with --update once.`);
  process.exit(1);
}

let failed = false;
const fell = [];
for (const [prim, { canon, files }] of Object.entries(current)) {
  const was = base[prim]?.files ?? [];
  const added = files.filter((f) => !was.includes(f));
  if (added.length) {
    failed = true;
    console.error(`[SHL-0-6] canon-adoption ratchet FAILED — new hand-rolled .${prim}:`);
    for (const f of added) console.error(`  ✗ ${f}`);
    console.error(`  <${canon}> already does this. Use it instead of a local copy.\n`);
  }
  const gone = was.filter((f) => !files.includes(f));
  if (gone.length) fell.push(`.${prim} ${was.length} → ${files.length}`);
}

if (failed) process.exit(1);

if (fell.length) {
  console.log(`[SHL-0-6] canon adoption improved: ${fell.join(', ')}`);
  console.log('  Ratchet it down: node scripts/check-canon-adoption.mjs --update');
} else {
  const total = Object.values(current).reduce((t, v) => t + v.files.length, 0);
  console.log(`[SHL-0-6] canon-adoption ratchet OK — ${total} hand-rolled primitive(s) (no increase).`);
}
