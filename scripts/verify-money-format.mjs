/**
 * [UNI-43-5] Money renders with a STABLE number of decimals.
 *
 * `MoneyCell` hand-rolled `maximumFractionDigits: 2` with no minimum, so one column could
 * show ₹31,876, ₹58.98 and ₹2,499.5 in three consecutive rows. A money column is read by
 * running an eye down it — when the decimal position moves per row, the alignment stops
 * carrying magnitude.
 *
 * Asserted on the house formatter itself (ACP-2 `money()`), which `MoneyCell` now delegates
 * to, because the durable property is "one formatter", not "two that agree today".
 *
 * Run: node scripts/verify-money-format.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'money-fmt-'));
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', 'src/utils/money.ts',
   '--outDir', dir, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
   '--noCheck'],
  { stdio: 'inherit' },
);
const mjs = join(dir, 'money.mjs');
renameSync(join(dir, 'money.js'), mjs);
const { money, moneyCompact, percent } = await import(pathToFileURL(mjs).href);

let failed = 0;
const eq = (label, got, want) => {
  if (got === want) return console.log(`PASS  ${label}`);
  failed++;
  console.error(`FAIL  ${label}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

// The exact column the finding measured.
const COLUMN = [31876, 58.98, 2499.5];
const decimalsOf = (s) => (s.split('.')[1] ?? '').length;

const plain = COLUMN.map((v) => money(v));
eq('a column shares ONE decimal position (whole rupees)',
   new Set(plain.map(decimalsOf)).size, 1);
const withPaise = COLUMN.map((v) => money(v, { paise: true }));
eq('and one decimal position with paise too',
   new Set(withPaise.map(decimalsOf)).size, 1);

eq('Indian grouping, not thousands', money(249999), '₹2,49,999');
eq('whole rupees by default (the house rule)', money(2499.5), '₹2,500');
eq('paise when the record has them', money(2499.5, { paise: true }), '₹2,499.50');
eq('a whole number still shows .00 in paise mode', money(31876, { paise: true }), '₹31,876.00');

// RC-3 in a money cell: absence must not read as zero.
eq('null renders the dash, never 0', money(null), '—');
eq('undefined renders the dash', money(undefined), '—');
eq('empty string renders the dash', money(''), '—');
eq('a non-numeric string renders the dash', money('abc'), '—');
eq('zero is a REAL amount and renders as one', money(0), '₹0');
eq('a numeric string is parsed', money('1499.50', { paise: true }), '₹1,499.50');
eq('bare drops the symbol for an already-headed column', money(1200, { bare: true }), '1,200');
eq('the minus sits OUTSIDE the symbol, not inside it', money(-450), '-₹450');
eq('negative with paise', money(-2499.5, { paise: true }), '-₹2,499.50');
eq('negative bare keeps the sign', money(-450, { bare: true }), '-450');
eq('minus zero does not print a sign in front of nothing', money(-0), '₹0');

// [KA1-12] the compact form must never make a number less informative.
eq('compact leaves sub-lakh alone', moneyCompact(2499), '₹2,499');
eq('compact only above a lakh', moneyCompact(250000), '₹2.5L');
eq('compact absent is the dash', moneyCompact(null), '—');

// [KA6-5] false precision on a whole percentage.
eq('a whole percentage carries no decimals', percent(10), '10%');
eq('a fractional percentage keeps one', percent(10.25), '10.3%');
eq('absent percentage is the dash', percent(null), '—');

console.log(failed ? `\n${failed} money-format check(s) FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
