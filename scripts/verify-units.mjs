/**
 * [DSG-10-2] The inch↔cm display helper.
 *
 * The fit engine works in inches; the floor cuts in centimetres. The audit records a LIVE
 * bug already produced by that seam — T2-7, where a centimetre chart was consumed as
 * inches: a silent 2.54× error on every dimension. A conversion helper on the screen where
 * a designer reads the spec is exactly the code that must not be quietly wrong.
 *
 * Run: node scripts/verify-units.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'units-'));
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', 'src/utils/units.ts',
   '--outDir', dir, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
   '--noCheck'],
  { stdio: 'inherit' },
);
const mjs = join(dir, 'units.mjs');
renameSync(join(dir, 'units.js'), mjs);
const { inchesToCm, inchesWithCm, CM_PER_INCH, isMeasurementColumn } = await import(pathToFileURL(mjs).href);

let failed = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) return console.log(`PASS  ${label}`);
  failed++;
  console.error(`FAIL  ${label}\n        got  ${g}\n        want ${w}`);
};

eq('the factor is the real one', CM_PER_INCH, 2.54);
eq('a whole inch converts', inchesToCm(38), 96.5);
eq('a half inch converts', inchesToCm(38.5), 97.8);
eq('zero is a real measurement, not absence', inchesToCm(0), 0);
eq('a negative (an ease delta) keeps its sign', inchesToCm(-1.5), -3.8);
eq('a numeric STRING is parsed — JSON charts carry both', inchesToCm('32'), 81.3);

// The refusal half. A size LABEL is a name, not a length.
eq('a size label is not a measurement', inchesWithCm('M'), null);
eq('null is not a measurement', inchesWithCm(null), null);
eq('undefined is not a measurement', inchesWithCm(undefined), null);
eq('an empty string is not a measurement', inchesWithCm(''), null);
eq('NaN is not a measurement', inchesToCm(Number.NaN), null);
eq('Infinity is not a measurement', inchesToCm(Number.POSITIVE_INFINITY), null);

eq('both units, trimmed', inchesWithCm(38), { inches: '38″', cm: '96.5 cm' });
eq('a fractional inch keeps its fraction', inchesWithCm(38.5), { inches: '38.5″', cm: '97.8 cm' });
eq('zero renders as zero in both', inchesWithCm(0), { inches: '0″', cm: '0 cm' });

// The bug the RENDER caught and these tests had missed: a size label of "30" is a
// perfectly good number, so a value-level check converts it and invents a dimension.
eq('the size column is not a length', isMeasurementColumn('size'), false);
eq('…nor size_label', isMeasurementColumn('size_label'), false);
eq('waist IS a length', isMeasurementColumn('waist'), true);
eq('leg_opening IS a length', isMeasurementColumn('leg_opening'), true);
eq('matching ignores case and padding', isMeasurementColumn('  Size '), false);
// Value-level still holds for the alphabetic case.
eq('an alphabetic size is still refused by value', inchesWithCm('M'), null);

// The 2.54x error the finding is about: 96.5 cm read AS inches would be 245 cm.
const misread = inchesToCm(96.5);
eq('a cm value misread as inches is visibly absurd (the T2-7 shape)', misread > 240, true);

console.log(failed ? `\n${failed} unit check(s) FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
