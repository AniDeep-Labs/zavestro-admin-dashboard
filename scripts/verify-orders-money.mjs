/**
 * [SHL-5-5] The two judgements behind the Orders & Money overview.
 *
 * Both decide what a founder is shown as an EXCEPTION, so a wrong answer here is worse than
 * the missing page it replaces: it would assert that nothing is stalling.
 *
 * Run: node scripts/verify-orders-money.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'orders-money-'));
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', 'src/pages/admin/ordersMoneyStats.ts',
   '--outDir', dir, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
   '--noCheck'],
  { stdio: 'inherit' },
);
const mjs = join(dir, 'ordersMoneyStats.mjs');
renameSync(join(dir, 'pages/admin/ordersMoneyStats.js'), mjs);
const { ageHours, agedOrders, AGED_DAYS, SETTLED_STAGES } = await import(pathToFileURL(mjs).href);

let failed = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) return console.log(`PASS  ${label}`);
  failed++;
  console.log(`FAIL  ${label}\n        got  ${g}\n        want ${w}`);
};

const NOW = Date.parse('2026-09-10T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();

// ── ageHours ──
eq('prefers the SERVER\'s stuck_hours, so this page agrees with the orders list',
   ageHours({ stuck_hours: 96, entered_stage_at: hoursAgo(1), created: hoursAgo(1) }, NOW), 96);
eq('falls back to entered_stage_at — the trigger-maintained stage clock',
   ageHours({ entered_stage_at: hoursAgo(50), created: hoursAgo(900) }, NOW), 50);
eq('falls back to created only when there is no stage clock',
   ageHours({ created: hoursAgo(10) }, NOW), 10);
eq('a stuck_hours of 0 is a real answer, not a missing one',
   ageHours({ stuck_hours: 0, created: hoursAgo(500) }, NOW), 0);
eq('no timestamps at all is 0, not NaN',
   ageHours({}, NOW), 0);

// The bug this guards: `updated_at` is bumped by ANY write, so an order sitting in one stage
// for a fortnight can look minutes old. It must never be consulted.
eq('IGNORES updated_at entirely',
   ageHours({ updated_at: hoursAgo(0), entered_stage_at: hoursAgo(200) }, NOW), 200);

// ── agedOrders ──
const orders = [
  { id: 'a', stage: 'stitching', entered_stage_at: hoursAgo(8 * 24) },   // aged
  { id: 'b', stage: 'stitching', entered_stage_at: hoursAgo(2 * 24) },   // fresh
  { id: 'c', stage: 'delivered', entered_stage_at: hoursAgo(90 * 24) },  // settled
  { id: 'd', stage: 'cancelled', entered_stage_at: hoursAgo(90 * 24) },  // settled
  { id: 'e', stage: 'qc',        entered_stage_at: hoursAgo(7 * 24) },   // exactly at threshold
];
eq('flags only what is still on the floor and past the threshold',
   agedOrders(orders, AGED_DAYS, NOW).map((o) => o.id), ['a', 'e']);
eq('a delivered order is never an exception, however old',
   agedOrders([orders[2]], AGED_DAYS, NOW).length, 0);
eq('a cancelled order is never an exception either',
   agedOrders([orders[3]], AGED_DAYS, NOW).length, 0);
eq('the threshold is inclusive — exactly 7 days counts as aged',
   agedOrders([orders[4]], AGED_DAYS, NOW).map((o) => o.id), ['e']);
eq('the window is adjustable', agedOrders(orders, 1, NOW).map((o) => o.id), ['a', 'b', 'e']);
eq('settled stages are exactly delivered + cancelled', SETTLED_STAGES, ['delivered', 'cancelled']);
eq('nothing in, nothing out', agedOrders([], AGED_DAYS, NOW), []);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
