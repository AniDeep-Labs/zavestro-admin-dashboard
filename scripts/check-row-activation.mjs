#!/usr/bin/env node
// [DSA-45-1] GUARD — a clickable table row must be operable from a keyboard.
//
// Every list in this console opens its detail by clicking the row, so the row IS the
// primary navigation. They were bare `<tr onClick=…>`: no tabindex, no role, no key
// handler, on orders, customers, returns, alterations, tickets and invoices. A screen
// reader announced a row of cells with nothing actionable in it, and the main path into
// a record was mouse-only.
//
// A later pass sprayed `tabIndex={0} role="button" onKeyDown={Enter}` onto each row by
// hand, which fixed most of it and introduced two new problems: Space (which every real
// button honours, and which `role="button"` promises) did nothing but scroll the page,
// and rows that were only CONDITIONALLY clickable announced themselves as buttons even
// when inert. That is what a hand-applied pattern does across 26 sites.
//
// So the rule this guard enforces is not "have the attributes" — it is "use the ONE
// helper", `src/utils/rowActivation.ts`, which is the only place the behaviour is
// defined and therefore the only place it can be fixed.
//
//   node scripts/check-row-activation.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.tsx')) yield p;
  }
}

/** End index of the JSX tag opening at `start`, brace-aware. */
function tagEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

const problems = [];

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const re = /<tr\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const end = tagEnd(src, m.index);
    if (end < 0) continue;
    const tag = src.slice(m.index, end + 1);
    if (!tag.includes('onClick')) continue;
    if (tag.includes('rowActivation')) continue;
    const line = src.slice(0, m.index).split('\n').length;
    problems.push(
      `${rel}:${line}  a clickable <tr> that does not use rowActivation() — ` +
        `spread {...rowActivation(fn)} instead of hand-writing tabIndex/role/onKeyDown`,
    );
  }
}

// The helper itself must keep the two properties the hand-rolled version lacked, or the
// rule above enforces nothing.
const helper = readFileSync(join(SRC, 'utils/rowActivation.ts'), 'utf8');
if (!/e\.key === " "/.test(helper)) {
  problems.push(
    'src/utils/rowActivation.ts  no Space handling — role="button" promises Enter AND Space',
  );
}
if (!/preventDefault/.test(helper)) {
  problems.push(
    'src/utils/rowActivation.ts  no preventDefault — Space on a focused row would scroll the list',
  );
}
if (!/e\.target !== e\.currentTarget/.test(helper)) {
  problems.push(
    'src/utils/rowActivation.ts  no target guard — a key press on a button INSIDE the row would also open it',
  );
}

if (problems.length) {
  console.error('\n[DSA-45-1] clickable rows that are not keyboard-operable:\n');
  for (const p of problems) console.error('  ' + p);
  console.error(`\n${problems.length} problem(s).\n`);
  process.exit(1);
}
console.log('[DSA-45-1] every clickable <tr> goes through rowActivation(). OK');
