#!/usr/bin/env node
// Customer-stage-label parity — [SEA-42-5].
//
// `src/constants/customerStageLabels.ts` mirrors `customerLabel` from the backend's
// `ORDER_STAGE_CONTRACT`. A mirror that nobody diffs is just a fourth hand-maintained copy,
// which is the thing the contract exists to prevent — and this one is worse than most,
// because it is read aloud on a support call: a drifted entry means an agent tells a
// customer their screen says something it does not.
//
// Same shape as check-capability-parity.mjs: diff against a backend checkout when one is
// findable, and say plainly when it is not, rather than silently passing.
//
//   node scripts/check-stage-labels.mjs
//   ZAVESTRO_BACKEND=/path/to/zavestro-backend node scripts/check-stage-labels.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIRROR = join(ROOT, 'src', 'constants', 'customerStageLabels.ts');
const CONTRACT_REL = join('src', 'shared', 'constants', 'order-stages.ts');

const CANDIDATE_DIRS = [
  process.env.ZAVESTRO_BACKEND,
  join(ROOT, '..', 'zavestro-backend'),
  ...(existsSync(join(ROOT, '..'))
    ? readdirSync(join(ROOT, '..'))
        .filter((d) => d.startsWith('be-') || d.startsWith('zavestro-backend'))
        .map((d) => join(ROOT, '..', d))
    : []),
].filter(Boolean);

const branchOf = (dir) => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '?';
  }
};

/** slug -> customerLabel, read out of the mirror's object literal. */
function readMirror() {
  const text = readFileSync(MIRROR, 'utf8');
  const body = text.slice(text.indexOf('CUSTOMER_STAGE_LABEL'));
  const out = {};
  for (const [, slug, label] of body.matchAll(/^\s*([a-z_]+):\s*'([^']+)',/gm)) out[slug] = label;
  return out;
}

/** slug -> customerLabel, read out of the backend contract's rows. */
function readContract(file) {
  const text = readFileSync(file, 'utf8');
  const out = {};
  for (const [, slug, label] of text.matchAll(
    /\{\s*slug:\s*'([a-z_]+)'[^}]*customerLabel:\s*'([^']+)'[^}]*\}/g,
  )) {
    out[slug] = label;
  }
  return out;
}

const mirror = readMirror();
if (Object.keys(mirror).length === 0) {
  console.error('✖ stage-labels: could not read CUSTOMER_STAGE_LABEL — the parser is blind.');
  process.exit(1);
}

let contract = null;
let source = null;
for (const dir of CANDIDATE_DIRS) {
  const file = join(dir, CONTRACT_REL);
  if (!existsSync(file)) continue;
  const parsed = readContract(file);
  if (Object.keys(parsed).length === 0) continue;
  contract = parsed;
  source = `${dir} (${branchOf(dir)})`;
  break;
}

if (!contract) {
  console.log(
    `✓ stage-labels: ${Object.keys(mirror).length} labels mirrored ` +
      `(no backend checkout found — parity UNVERIFIED this run).`,
  );
  process.exit(0);
}

const slugs = new Set([...Object.keys(mirror), ...Object.keys(contract)]);
const problems = [];
for (const slug of [...slugs].sort()) {
  if (!(slug in contract)) problems.push(`  ${slug}: in the admin mirror, not in the contract`);
  else if (!(slug in mirror)) problems.push(`  ${slug}: in the contract, MISSING from the mirror`);
  else if (mirror[slug] !== contract[slug])
    problems.push(`  ${slug}: admin says "${mirror[slug]}", contract says "${contract[slug]}"`);
}

if (problems.length) {
  console.error(`✖ stage-labels: the admin's "customer sees" wording has drifted.\n`);
  problems.forEach((p) => console.error(p));
  console.error(`\nSource of truth: ${source}${CONTRACT_REL ? ' → ' + CONTRACT_REL : ''}`);
  console.error(`An agent reads this line out on a call — a drifted entry tells a customer`);
  console.error(`their screen says something it does not.`);
  process.exit(1);
}
console.log(`✓ stage-labels: ${slugs.size} customer labels match the contract — ${source}`);
