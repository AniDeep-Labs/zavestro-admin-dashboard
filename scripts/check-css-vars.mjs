#!/usr/bin/env node
// Undefined-token guard — [DSA-45-5].
//
// `var(--nope)` with no fallback is not a style mistake, it is a DELETED DECLARATION: the
// custom property is invalid at computed-value time, so the browser throws the whole
// declaration away and paints the initial value. Nothing warns. The build is green. The
// element just quietly renders as something else.
//
// Found by rendering, not by reading: the support page's "Create Ticket" button carried an
// inline `background: "var(--green)"`. There is no `--green` in this design system (it is
// `--color-primary`), so the background was dropped to transparent while `color: "#fff"`
// survived — a 130x38 white-on-white button that has been invisible on a live page, on the
// screen whose empty state reads "Nothing here — inbox zero". An invisible control on a page
// that says there is nothing to do is not a thing anyone reports.
//
// The sweep found 45 more like it across 13 files, including 18 uses of `--color-bg` (the
// token is `--color-bg-primary`) and 8 of `--border` (`--color-border`).
//
// A var() WITH a fallback is not this bug — it renders the fallback — so those are counted
// and ratcheted rather than failed, the same shape as check-style-debt.mjs.
//
//   node scripts/check-css-vars.mjs            # check (CI)
//   node scripts/check-css-vars.mjs --update   # rewrite the fallback baseline
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'css-vars-baseline.json');
/** Where a token may be DECLARED for the whole app. */
const TOKEN_FILES = ['src/styles/variables.css', 'src/styles/global.css'];

const DECL = /(--[\w-]+)\s*:/g;
/** Captures the token and whether a comma (a fallback) follows it. */
const USE = /var\(\s*(--[\w-]+)\s*([,)])/g;

// Blank out block comments, keeping every newline so reported line numbers stay true.
// A token named in PROSE is not a declaration — without this the guard reads its own
// explanation and reports it, which is exactly what happened the first time it ran.
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(css|tsx)$/.test(p)) yield p;
  }
}

const global = new Set();
for (const f of TOKEN_FILES)
  for (const [, name] of stripComments(readFileSync(join(ROOT, f), 'utf8')).matchAll(DECL))
    global.add(name);

const missing = [];
const withFallback = {};
for (const p of walk(SRC)) {
  const rel = relative(ROOT, p);
  const text = stripComments(readFileSync(p, 'utf8'));
  // A file may define its own custom properties (a scoped theme, a component-local knob).
  const local = new Set([...text.matchAll(DECL)].map((m) => m[1]));
  text.split('\n').forEach((line, i) => {
    for (const [, name, tail] of line.matchAll(USE)) {
      if (global.has(name) || local.has(name)) continue;
      if (tail === ',') withFallback[rel] = (withFallback[rel] ?? 0) + 1;
      else missing.push({ rel, line: i + 1, name, src: line.trim().slice(0, 90) });
    }
  });
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(withFallback, null, 2) + '\n');
  console.log(`css-vars baseline updated (${Object.keys(withFallback).length} files).`);
  process.exit(0);
}

let failed = false;
if (missing.length) {
  failed = true;
  console.error(`✖ css-vars: ${missing.length} var() reference(s) to a token that does not`);
  console.error(`  exist, with NO fallback — each one silently deletes its declaration.\n`);
  for (const m of missing) console.error(`  ${m.rel}:${m.line}  ${m.name}\n      ${m.src}`);
  console.error(`\nDefine the token in src/styles/variables.css, or use the real name.`);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error('No css-vars baseline — run: node scripts/check-css-vars.mjs --update');
  process.exit(1);
}
const worse = Object.entries(withFallback).filter(([f, n]) => n > (baseline[f] ?? 0));
if (worse.length) {
  failed = true;
  console.error(`\n✖ css-vars: new var() uses of an UNDEFINED token with a fallback:`);
  for (const [f, n] of worse) console.error(`  ${f}: ${baseline[f] ?? 0} -> ${n}`);
  console.error(`  These render the fallback, so they are debt rather than a bug — but the`);
  console.error(`  fallback is a raw value living outside the token file. Use a real token.`);
}
if (failed) process.exit(1);

const total = Object.values(withFallback).reduce((a, b) => a + b, 0);
const before = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(`✓ css-vars: every var() resolves; ${total} fallback-guarded use(s) remain.`);
if (total < before) console.log(`  reduced ${before} -> ${total} — ratchet: --update`);
