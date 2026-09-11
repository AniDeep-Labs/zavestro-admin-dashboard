/**
 * [SHL-4-8] Exercises the role landing block's arithmetic.
 *
 * These are the numbers design and procurement will read on a page that previously answered
 * nothing, so the failure mode is a confident wrong figure rather than a blank — which is
 * worse than the emptiness it replaces.
 *
 * Run: node scripts/verify-role-landing.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'role-landing-'));
// --noCheck: transpile only. The type-only imports reach adminApi.ts, which uses Vite's
// `import.meta.env` and cannot typecheck outside a Vite build. `npm run build` checks it.
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', 'src/components/RoleLanding/roleLandingStats.ts',
   '--outDir', dir, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
   '--noCheck'],
  { stdio: 'inherit' },
);
const mjs = join(dir, 'roleLandingStats.mjs');
renameSync(join(dir, 'components/RoleLanding/roleLandingStats.js'), mjs);
const { supplySummary, samplingSummary } = await import(pathToFileURL(mjs).href);

let failed = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) return console.log(`PASS  ${label}`);
  failed++;
  console.log(`FAIL  ${label}\n        got  ${g}\n        want ${w}`);
};

// ── supplySummary ──
const stock = [
  { is_low: true,  in_transit_meters: '12.5' },
  { is_low: false, in_transit_meters: 30 },
  { is_low: true,  in_transit_meters: null },       // null must not become NaN
  { is_low: undefined, in_transit_meters: undefined },
];
eq('counts only the shelves the SERVER marked low',
   supplySummary(stock, []).low, 2);
eq('sums in-transit across string, number, null and undefined',
   supplySummary(stock, []).inTransitMeters, 42.5);
eq('a null metre figure is 0, never NaN',
   Number.isNaN(supplySummary([{ in_transit_meters: null }], []).inTransitMeters), false);

const restocks = [
  { status: 'shipped',   qty: 35, qty_fulfilled: 20, outstanding: 15 },  // owed
  { status: 'requested', qty: 10, qty_fulfilled: 0,  outstanding: 10 },  // owed
  { status: 'shipped',   qty: 8,  qty_fulfilled: 8,  outstanding: 0 },   // fully received
  { status: 'fulfilled', qty: 5,  qty_fulfilled: 5,  outstanding: 0 },   // settled
  { status: 'cancelled', qty: 9,  qty_fulfilled: 0,  outstanding: 9 },   // owes nothing
];
eq('counts what is still OWED, not what is merely open', supplySummary([], restocks).restocksOwed, 2);
eq('a cancelled request owes nothing however its numbers read',
   supplySummary([], [restocks[4]]).restocksOwed, 0);
eq('falls back to qty - qty_fulfilled when the server sent no `outstanding`',
   supplySummary([], [{ status: 'shipped', qty: 20, qty_fulfilled: 5 }]).restocksOwed, 1);
eq('and that fallback still excludes a fully-received request',
   supplySummary([], [{ status: 'shipped', qty: 20, qty_fulfilled: 20 }]).restocksOwed, 0);
eq('nothing to show is zeroes, not a crash', supplySummary([], []), { low: 0, inTransitMeters: 0, restocksOwed: 0 });

// ── samplingSummary ──
const jobs = [
  { status: 'design_review' }, { status: 'design_review' },
  { status: 'stitching' }, { status: 'cutting' }, { status: 'requested' },
];
eq('separates what waits on DESIGN from what waits on a hub',
   samplingSummary(jobs), { awaitingVerdict: 2, inFlight: 3 });
eq('an empty pipeline is zeroes', samplingSummary([]), { awaitingVerdict: 0, inFlight: 0 });
eq('every non-review status counts as in-flight, including ones added later',
   samplingSummary([{ status: 'some_future_status' }]), { awaitingVerdict: 0, inFlight: 1 });

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
