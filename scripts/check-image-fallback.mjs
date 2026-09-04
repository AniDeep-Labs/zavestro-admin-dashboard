#!/usr/bin/env node
// IMAGE-FALLBACK RATCHET — a missing object must not render as a broken image.
//
// Written after fixing the same defect three times in one pass ([DSG-12-12] on the sample
// queue and detail gallery, the collections studio, [PRC-16-9] on the listing-request
// cards). Every instance had the same shape and the same consequence: an R2 key can outlive
// the object it points at, and an `<img>` with no `onError` then paints the browser's own
// broken-image glyph — sometimes with the alt text inside it, so a fabric called "Chambray"
// appears as a FAILED GRAPHIC rather than as the fabric it names.
//
// It reads as a broken PAGE rather than a missing FILE, which is the wrong diagnosis to hand
// someone: on a sample review it is the hero the reviewer is asked to judge a garment by, and
// on the collections studio one dead key breaks the layout gallery, the live preview and the
// device preview at once.
//
// "Key present but unfetchable" is a THIRD state, distinct from "nothing was ever uploaded".
// The house pattern is a `broken` Set plus `onError`, as FabricsMasterPage and CentralStockPage
// already do; components/Image/Image.tsx also takes a `fallback`.
//
// A RATCHET, not a gate — 45 bare tags remain across 22 files. Same shape as
// check-swallowed-catch.mjs: the count is frozen per file and any INCREASE fails.
//
//   node scripts/check-image-fallback.mjs            # check (CI)
//   node scripts/check-image-fallback.mjs --update   # re-baseline after a burndown
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', 'image-fallback-baseline.json');

// Any JSX <img …> whose tag carries no onError handler. Tags are matched whole (including
// multi-line ones) so an onError on a later line still counts as handled.
const IMG_RE = /<img\b[^>]*?\/?>/gs;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.tsx')) yield p;
  }
}

const counts = {};
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const n = (src.match(IMG_RE) ?? []).filter((tag) => !tag.includes('onError')).length;
  if (n > 0) counts[rel] = n;
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`image-fallback baseline updated — ${total} in ${Object.keys(counts).length} files.`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('No baseline. Run: node scripts/check-image-fallback.mjs --update');
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
  console.error('[IMG] image-fallback ratchet FAILED — new <img> without onError:\n');
  for (const w of worse) console.error('  ✗ ' + w);
  console.error(
    '\nA key can outlive its object. Treat "present but unfetchable" as its own state:\n' +
      '  const [broken, setBroken] = useState<Set<string>>(new Set());\n' +
      '  const markBroken = (id: string) => setBroken(b => (b.has(id) ? b : new Set(b).add(id)));\n' +
      '  {url && !broken.has(id)\n' +
      '    ? <img src={url} alt="" onError={() => markBroken(id)} />\n' +
      '    : <Placeholder />}\n' +
      '\nSee FabricsMasterPage.tsx, or components/Image/Image.tsx for the fallback prop.\n',
  );
  process.exit(1);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (better.length) {
  console.log(`[IMG] bare <img> DOWN in ${better.length} file(s):`);
  for (const b of better) console.log('  ✓ ' + b);
  console.log('  Ratchet the baseline: node scripts/check-image-fallback.mjs --update');
}
console.log(`[IMG] image-fallback ratchet OK — ${total} remaining (no increase).`);
