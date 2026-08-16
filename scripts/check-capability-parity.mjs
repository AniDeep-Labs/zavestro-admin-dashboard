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
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BACKEND_PERMISSIONS = join(ROOT, '..', 'zavestro-backend', 'src', 'admin', 'auth', 'permissions.ts');

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
function backendCapabilities() {
  if (!existsSync(BACKEND_PERMISSIONS)) return { caps: PINNED, source: 'pinned list (backend repo not present)' };
  const src = readFileSync(BACKEND_PERMISSIONS, 'utf8');
  const union = src.match(/export type Capability =([\s\S]*?);\n/);
  if (!union) throw new Error(`Could not find the Capability union in ${BACKEND_PERMISSIONS}`);
  const caps = [...union[1].matchAll(/'([a-z]+:[a-z]+)'/g)].map((m) => m[1]);
  if (caps.length === 0) throw new Error('Parsed the Capability union but found no capabilities');
  return { caps, source: relative(ROOT, BACKEND_PERMISSIONS) };
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

const { caps: known, source } = backendCapabilities();
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
  console.error(`  Backend source: ${source}\n`);
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
