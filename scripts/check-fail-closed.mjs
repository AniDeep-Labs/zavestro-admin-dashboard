#!/usr/bin/env node
// Fail-closed identity guard — [PEN-38-5] / [SHL-3-6].
//
// `const adminRole = adminUser?.role ?? "admin"` is one character away from correct and
// completely wrong: `"admin"` is the LEGACY GOD-MODE role, and it short-circuits both the
// nav section gate and every `<Can>`. So any session the shell could not identify — a
// failed `/auth/me`, a cleared cache, a 500 — defaulted to the most privileged role in the
// system.
//
// The penetration pass found it fails open in code and in the identity chip, and that two
// accidents were masking it: the nav gates on `caps` (which default to `[]`) and each
// page's own data call 403s before it can render its actions. Neither is a security
// boundary. Both could stop being true in a refactor that touched nothing security-shaped.
//
// SHL-3-6 fixed it to `?? "pending"`. This keeps it fixed: a role must never DEFAULT to a
// privileged value. Comparisons (`role === "admin"`) are untouched — the ban is on
// fallbacks, which is where the fail-open lives.
//
//   node scripts/check-fail-closed.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

/** Roles that may never be the value something falls back TO. */
const PRIVILEGED = ['admin', 'super_admin'];
/** `?? "admin"` and `|| "admin"` — a default, not a comparison. */
const FALLBACK = new RegExp(`(\\?\\?|\\|\\|)\\s*(['"\`])(${PRIVILEGED.join('|')})\\2`, 'g');

// A role named in prose is not a fallback. Blank comments, keeping newlines so the
// reported line numbers stay true.
const stripComments = (t) =>
  t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(p)) yield p;
  }
}

const hits = [];
for (const p of walk(SRC)) {
  const lines = stripComments(readFileSync(p, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(FALLBACK)) {
      hits.push({ rel: relative(ROOT, p), line: i + 1, role: m[3], src: line.trim().slice(0, 90) });
    }
  });
}

if (hits.length) {
  console.error(`✖ fail-closed: ${hits.length} place(s) DEFAULT a role to a privileged value.\n`);
  for (const h of hits) console.error(`  ${h.rel}:${h.line}  falls back to "${h.role}"\n      ${h.src}`);
  console.error(`\nAn unidentified session must default to "pending", never to a role that`);
  console.error(`grants anything. See [PEN-38-5] and AdminLayout's comment at the cache read.`);
  process.exit(1);
}
console.log('✓ fail-closed: no role defaults to a privileged value.');
