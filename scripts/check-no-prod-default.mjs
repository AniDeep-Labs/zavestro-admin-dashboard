#!/usr/bin/env node
// [SHL-2-2] GUARD — production must never be a DEFAULT.
//
// Every API module fell back to `https://api.zavestro.in` when VITE_API_URL was unset, and
// `.gitignore` excludes every env file — so a fresh clone running `npm run dev` attached the
// admin to the LIVE business: working login, and every write enabled. Prices, refunds, credits,
// stage overrides, DPDP erasure. `.env.example` documented the same URL, so the documented setup
// produced it too. Nothing on screen told the two apart.
//
// The rule is not "never mention the production host" — a deployed build must reach it. The rule
// is that it may not appear as a FALLBACK: `?? 'https://api.zavestro.in'`, `|| 'https://…'`, or
// as the value in the committed env template. Reaching production has to be a choice someone
// made, not what happens when they made none.
//
//   node scripts/check-no-prod-default.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROD = /https?:\/\/api\.zavestro\.(in|com)/;
// apiBase.ts names the hosts to RECOGNISE them; that is the fix, not the defect.
const EXEMPT = new Set(['src/api/apiBase.ts', 'scripts/check-no-prod-default.mjs']);

function* walk(dir) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n === '.git') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(p)) yield p;
  }
}

const problems = [];
const check = (rel, src) => {
  src.split('\n').forEach((line, i) => {
    if (!PROD.test(line)) return;
    if (/\?\?|\|\||default|fallback/i.test(line)) {
      problems.push(`${rel}:${i + 1}  production host used as a DEFAULT — ${line.trim().slice(0, 90)}`);
    }
  });
};

for (const f of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  if (!EXEMPT.has(rel)) check(rel, readFileSync(f, 'utf8'));
}
for (const rel of ['vite.config.ts', '.env.example']) {
  try {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    if (rel === '.env.example') {
      src.split('\n').forEach((line, i) => {
        if (/^VITE_API_URL\s*=/.test(line) && PROD.test(line))
          problems.push(`${rel}:${i + 1}  the committed template points at PRODUCTION — ${line.trim()}`);
      });
    } else check(rel, src);
  } catch { /* optional file */ }
}

if (problems.length) {
  console.error('[SHL-2-2] production-default guard FAILED:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error(
    '\nDefault to http://localhost:8080. A wrong default that FAILS is recoverable;\n' +
      'a wrong default that WORKS attaches a dev console to real customers\' money.\n',
  );
  process.exit(1);
}
console.log('[SHL-2-2] production is never a default. OK');
