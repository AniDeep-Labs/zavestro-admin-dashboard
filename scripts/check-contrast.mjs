#!/usr/bin/env node
// Contrast guard — [DSA-45-3].
//
// The audit measured the rendered console in both themes and found the dark theme missing
// WCAG AA on text an agent reads aloud: the customer's phone number at 3.15:1, the active
// worklist tab at 2.91:1, every 12px table header at 3.28:1. All of them were token values,
// not per-page CSS, so all of them were fixed at the token layer — and all of them can
// regress the same way, by one person nudging one hex in variables.css.
//
// So this reads the token file and does the arithmetic, rather than trusting a comment.
// It is deliberately NOT a rendered check: a browser pass measures what is on screen today
// and cannot run in this repo's CI, while the token file is the thing that has to stay true.
// What it cannot see — a page that hardcodes its own colours instead of using the tokens —
// is check-style-debt.mjs's job, which is why the two guards run together.
//
//   node scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../src/styles/variables.css', import.meta.url));
const css = readFileSync(FILE, 'utf8');

/** WCAG AA for body text under 18.66px. Everything checked here is body text or smaller. */
const AA = 4.5;

// ---------------------------------------------------------------- colour maths

const srgb = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const luminance = ([r, g, b]) =>
  0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);

function contrast(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Flatten a translucent colour onto what is behind it — a chip's tint over a card. */
const composite = ([r, g, b, a], [br, bg_, bb]) =>
  a >= 1 ? [r, g, b] : [r * a + br * (1 - a), g * a + bg_ * (1 - a), b * a + bb * (1 - a)];

function parseColor(raw) {
  const v = raw.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return (m[1].match(/../g) ?? []).map((c) => parseInt(c, 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p));
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  return null; // var(), gradients, keywords — resolved by the caller or skipped
}

// ------------------------------------------------------------------- token map

/** Read one declaration block's custom properties. */
function block(selector) {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`variables.css has no ${selector} block`);
  const open = css.indexOf('{', at);
  // The blocks here are flat (no nested rules), so the first closing brace ends it.
  const body = css.slice(open + 1, css.indexOf('\n}', open));
  const out = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[name] = value.trim();
  return out;
}

const light = block(':root {');
const dark = { ...light, ...block('[data-theme="dark"] {') };

/** Resolve `var(--x)` chains, then parse. Returns null for anything not a flat colour. */
function resolve(tokens, name, depth = 0) {
  const raw = tokens[name];
  if (raw === undefined || depth > 8) return null;
  const ref = /^var\(\s*(--[\w-]+)/.exec(raw);
  if (ref) return resolve(tokens, ref[1], depth + 1);
  return parseColor(raw);
}

// ----------------------------------------------------------------- what to check

/** Every surface a page actually draws text on. A hovered table row is the worst of them. */
const SURFACES = [
  '--color-app-bg',
  '--color-bg-primary',
  '--color-bg-secondary',
  '--color-bg-tertiary',
  '--color-bg-hover',
];
const TEXT_TIERS = [
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-text-muted',
];
/** ink token -> the fill it is drawn on. */
const ON_PAIRS = {
  '--color-on-primary': '--color-primary',
  '--color-on-secondary': '--color-secondary',
  '--color-on-success': '--color-success',
  '--color-on-error': '--color-error',
  '--color-on-warning': '--color-warning',
  '--color-on-info': '--color-info',
};

const failures = [];
let checked = 0;

for (const [theme, tokens] of Object.entries({ light, dark })) {
  const card = resolve(tokens, '--color-bg-primary');

  for (const t of TEXT_TIERS) {
    const fg = resolve(tokens, t);
    if (!fg) {
      failures.push(`${theme}: ${t} is missing or not a flat colour`);
      continue;
    }
    for (const s of SURFACES) {
      const bg = resolve(tokens, s);
      if (!bg) continue;
      const r = contrast(fg, bg);
      checked++;
      if (r < AA) failures.push(`${theme}: ${t} on ${s} is ${r.toFixed(2)}:1 (needs ${AA})`);
    }
  }

  for (const [ink, fill] of Object.entries(ON_PAIRS)) {
    const fg = resolve(tokens, ink);
    const bg = resolve(tokens, fill);
    if (!fg || !bg) {
      failures.push(`${theme}: ${ink}/${fill} is missing or not a flat colour`);
      continue;
    }
    const r = contrast(fg, composite(bg, card ?? [255, 255, 255]));
    checked++;
    if (r < AA) failures.push(`${theme}: ${ink} on ${fill} is ${r.toFixed(2)}:1 (needs ${AA})`);
  }

  // StatusBadge tones: a tinted chip, so the foreground is measured against the tint
  // FLATTENED ONTO THE CARD. Measuring it against the raw rgba() would report a ratio
  // nobody can see, which is how a chip passes a checker and fails a person.
  const meanings = new Set([...css.matchAll(/--status-([a-z]+)-fg\s*:/g)].map((m) => m[1]));
  for (const meaning of meanings) {
    const fg = resolve(tokens, `--status-${meaning}-fg`);
    const tint = resolve(tokens, `--status-${meaning}-bg`);
    if (!fg || !tint || !card) continue;
    const r = contrast(fg, composite(tint, card));
    checked++;
    if (r < AA)
      failures.push(`${theme}: --status-${meaning}-fg on its own chip is ${r.toFixed(2)}:1`);
  }
}

if (failures.length) {
  console.error(`✖ contrast: ${failures.length} token pair(s) below WCAG AA (${AA}:1)\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(`\nThese are token values in src/styles/variables.css — fix them there, not`);
  console.error(`per page. Recompute with the ratios noted beside each scale in that file.`);
  process.exit(1);
}
console.log(`✓ contrast: ${checked} token pairs clear WCAG AA (${AA}:1) in both themes.`);
