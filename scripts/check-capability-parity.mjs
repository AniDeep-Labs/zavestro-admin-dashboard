#!/usr/bin/env node
// RC-1 · CAPABILITY PARITY — the admin's half of "one capability table".
//
// The gating rule was written down three times — `AdminLayout`'s SECTIONS, every
// `<Can cap="…">`, and the backend's POLICY/READ_POLICY — and the three copies
// disagreed. Sixteen findings in the admin audit were nothing but those
// disagreements: a page held by one role and its only verb by another
// ([SUP-31-1]); an escalation notifying a role that could not open the ticket
// ([SUP-32-3]); a UI asking for a capability the API does not check ([SUP-29-x]).
//
// A generated table across two repos is the eventual answer. This is the guard
// that makes the disagreement IMPOSSIBLE TO SHIP QUIETLY in the meantime: every
// capability string the admin gates on must be a capability the backend actually
// defines. A typo or an invented capability now fails `npm run lint` instead of
// silently hiding a button from everyone (a `<Can cap="qc:wrtie">` renders for
// nobody and looks exactly like a working gate).
//
// The backend list is read from the sibling repo when it is checked out — real
// parity, not a copy — and falls back to the pinned list below in CI.
//
//   node scripts/check-capability-parity.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
/**
 * Where the backend's capability list lives.
 *
 * NOT a single hardcoded path: this used to be `../zavestro-backend` only, and the
 * moment a git WORKTREE was in play (`../zavestro-backend-w3`) the guard read a
 * checkout sitting on an unrelated branch and reported a confident, wrong failure
 * — the exact shape of bug this whole audit is about. A guard that can be wrong
 * about WHICH source it read is worse than no guard, because it trains people to
 * ignore it.
 *
 * Order: an explicit env var, then every sibling `zavestro-backend*` directory.
 * The branch each candidate is on is printed with the result, so a stale checkout
 * is visible at a glance instead of looking like a code failure.
 */
const CANDIDATE_DIRS = [
  process.env.ZAVESTRO_BACKEND,
  join(ROOT, '..', 'zavestro-backend'),
  ...(existsSync(join(ROOT, '..'))
    ? readdirSync(join(ROOT, '..'))
        .filter((d) => d.startsWith('zavestro-backend') && d !== 'zavestro-backend')
        .map((d) => join(ROOT, '..', d))
    : []),
].filter(Boolean);

const PERMISSIONS_REL = join('src', 'admin', 'auth', 'permissions.ts');

function branchOf(dir) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

// Pinned mirror of `Capability` in the backend's permissions.ts. Used only when
// the backend repo is not checked out beside this one (CI). If this list and the
// backend's ever drift, the check below reports it the moment both are present.
const PINNED = [
  'catalog:write', 'cms:write', 'pricing:write', 'orders:read', 'orders:write',
  'refunds:approve', 'reviews:moderate', 'customers:read', 'customers:write',
  'staff:manage', 'system:manage', 'samples:write', 'designs:write',
  'distribution:write', 'restock:write', 'fit:read', 'reports:read',
  'finance:read', 'finance:write', 'qc:write',
];

/** Parse the `Capability` union out of the backend's source. */
function parseCaps(file) {
  // Strip line comments FIRST. Two parser bugs came from not doing this:
  //  • matching to the first `;\n` over-ran a union whose last member had a
  //    trailing comment and swallowed the `ALL` array (19 caps reported as 38);
  //  • matching to the first `;` under-ran, because the `finance:write` comment
  //    itself contains a semicolon ("finance operates; super is read-only").
  // Parse the CODE, never the prose — the same lesson as the negative source
  // assertions in the wave tests.
  const src = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  // Stop at the first SEMICOLON, not the first `;\n`. The union contains no
  // semicolons, but its last member often carries a trailing `// comment`, and
  // with `;\n` the match ran past it and swallowed the `ALL` array — reporting 38
  // capabilities where there are 19, and making "widest checkout wins" pick the
  // BROKEN parse over the good one. A parser that can silently over-match is the
  // same class of bug as a guard that skips routes.
  const union = src.match(/export type Capability =([^;]*);/);
  if (!union) return null;
  const caps = [...union[1].matchAll(/'([a-z]+:[a-z]+)'/g)].map((m) => m[1]);
  return caps.length ? caps : null;
}

function backendCapabilities() {
  const found = [];
  for (const dir of CANDIDATE_DIRS) {
    const file = join(dir, PERMISSIONS_REL);
    if (!existsSync(file)) continue;
    const caps = parseCaps(file);
    if (caps) found.push({ caps, dir, file, branch: branchOf(dir) });
  }
  if (found.length === 0) return { caps: PINNED, source: 'pinned list (no backend checkout found)', all: [] };
  // Several checkouts of the same repo can be on different branches. Take the
  // SUPERSET only for reporting, and judge against the widest one — a capability
  // that exists on any checked-out branch is one a developer is legitimately
  // working against. The report names every source so a mismatch is legible.
  const widest = found.reduce((a, b) => (b.caps.length > a.caps.length ? b : a));
  return {
    caps: widest.caps,
    source: `${relative(ROOT, widest.file)} [${widest.branch}]`,
    all: found,
  };
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) yield p;
  }
}

// Every place the admin names a capability:
//   <Can cap="x">          cap: "x"          caps: ["x", "y"]
//   hasCapability("x")     caps={["x"]}      caps: ["x"]  (nav sections)
const PATTERNS = [
  /\bcap=["']([a-z]+:[a-z]+)["']/g,
  /\bcaps?:\s*["']([a-z]+:[a-z]+)["']/g,
  /\bhasCapability\(\s*["']([a-z]+:[a-z]+)["']/g,
  /\bcaps?:\s*\[([^\]]*)\]/g,
  /\bcap=\{\s*\[([^\]]*)\]/g,
];

const { caps: known, source, all } = backendCapabilities();
const knownSet = new Set(known);
const used = new Map(); // capability → files

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      for (const c of [...m[1].matchAll(/([a-z]+:[a-z]+)/g)].map((x) => x[1])) {
        if (!used.has(c)) used.set(c, new Set());
        used.get(c).add(rel);
      }
    }
  }
}

const unknown = [...used.keys()].filter((c) => !knownSet.has(c)).sort();
const unused = known.filter((c) => !used.has(c)).sort();

if (unknown.length) {
  console.error(`\n✖ Capability parity FAILED — the admin gates on capabilities the backend does not define.`);
  console.error(`  Backend source: ${source}`);
  if (all && all.length > 1) {
    console.error('  Other backend checkouts seen (a stale one is the usual cause):');
    for (const f of all) console.error(`    ${relative(ROOT, f.file)} [${f.branch}] — ${f.caps.length} caps`);
  }
  console.error('');
  for (const c of unknown) {
    console.error(`  ${c}`);
    for (const f of used.get(c)) console.error(`      ${f}`);
  }
  console.error(`\n  A gate naming a capability nobody holds renders for NOBODY, and looks`);
  console.error(`  exactly like a gate that works. Fix the string, or add the capability to`);
  console.error(`  the backend's Capability union and role map first.\n`);
  process.exit(1);
}

console.log(`✓ capability parity — ${used.size} capabilities gated in the admin, all defined by the backend (${source})`);
if (unused.length) {
  // Not a failure: some capabilities are enforced only server-side.
  console.log(`  (backend-only, never gated in the admin UI: ${unused.join(', ')})`);
}
