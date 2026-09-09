/**
 * [CM-22-9] Exercises the banner reuse + asset-provenance derivations against fixtures.
 *
 * The admin has no test runner, so this follows verify-me-coalescing.mjs: bundle the module
 * with esbuild, then assert. It is the only way the logic behind "Start from another banner"
 * and the "Shared creative" readout is checked at all — the page component that used to hold
 * it is 1,400 lines and offered no seam.
 *
 * Run: node scripts/verify-banner-reuse.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Compiled with the project's OWN TypeScript rather than `npx --yes esbuild`, so this runs in
// CI without reaching the network. bannerAssets.ts imports only a TYPE, so a single-file
// transpile is self-contained — no bundler needed.
const dir = mkdtempSync(join(tmpdir(), 'banner-reuse-'));
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', 'src/pages/admin/canvas/bannerAssets.ts',
   '--outDir', dir, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler'],
  { stdio: 'inherit' },
);
const js = join(dir, 'bannerAssets.js');
const mjs = join(dir, 'bannerAssets.mjs');
renameSync(js, mjs); // .mjs so node treats it as ESM regardless of the temp dir's package type
const { assetKeysOf, startableFrom, assetReuse, canvasForSlot } = await import(pathToFileURL(mjs).href);

let failed = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) return console.log(`PASS  ${label}`);
  failed++;
  console.log(`FAIL  ${label}\n        got  ${g}\n        want ${w}`);
};

const doc = (...keys) => ({ elements: keys.map((k, i) => ({ id: String(i), type: 'image', imageKey: k })) });

const spring = {
  id: 'b1', title: 'Spring',
  image_key: 'hero/spring.jpg', logo_key: 'brand/logo.png',
  compose_style: { canvas_mobile: doc('shot/model.jpg'), canvas_web: doc('shot/wide.jpg') },
};
const summer = {
  id: 'b2', title: 'Summer',
  image_key: 'hero/summer.jpg',
  compose_style: { canvas_mobile: doc('shot/model.jpg') },   // reuses spring's model shot
};
const legacy = {
  id: 'b3', title: 'Legacy',
  compose_style: { canvas: doc('shot/old.jpg') },            // pre-split shared canvas
};
const empty = { id: 'b4', title: 'Empty', compose_style: {} };
const library = [spring, summer, legacy, empty];

// ── assetKeysOf: creative + logo + every canvas, both devices and the legacy field ──
eq('assetKeysOf covers image, logo and both canvases',
   assetKeysOf(spring).sort(),
   ['brand/logo.png', 'hero/spring.jpg', 'shot/model.jpg', 'shot/wide.jpg']);
eq('assetKeysOf skips absent fields rather than emitting empties',
   assetKeysOf(empty), []);

// ── canvasForSlot: `canvas` falls back for MOBILE only ──
eq('legacy shared canvas is read for mobile', !!canvasForSlot(legacy, 'canvas_mobile'), true);
eq('legacy shared canvas is NOT borrowed by web', canvasForSlot(legacy, 'canvas_web'), undefined);

// ── startableFrom: excludes self and anything with no design for this device ──
eq('mobile offers the other banners that have a mobile design',
   startableFrom(library, 'b1', 'canvas_mobile').map(x => x.bn.id), ['b2', 'b3']);
eq('web offers only banners with a web design (legacy does not count)',
   startableFrom(library, 'b2', 'canvas_web').map(x => x.bn.id), ['b1']);
eq('a banner is never offered itself',
   startableFrom(library, 'b1', 'canvas_mobile').some(x => x.bn.id === 'b1'), false);
eq('an empty library offers nothing', startableFrom([], 'b1', 'canvas_mobile'), []);

// ── assetReuse: only genuinely shared keys, naming who else uses them ──
const shared = assetReuse(spring, library);
eq('only the shared key is reported', shared.map(a => a.key), ['shot/model.jpg']);
eq('and it names the other banner', shared[0]?.others.map(o => o.id), ['b2']);
eq('a banner sharing nothing reports nothing', assetReuse(legacy, library), []);
eq('self is never counted as another user',
   assetReuse(spring, [spring]).length, 0);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
