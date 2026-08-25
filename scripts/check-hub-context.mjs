#!/usr/bin/env node
// [SHL-3-8] GUARD — the header hub switcher must actually reach the pages.
//
// The switcher persisted a hub and NOTHING read it: `AdminLayout` was the only importer of
// `getAdminHubContext`, and only to seed the control's own value. Its comment meanwhile promised
// "pages read the selection as their default hub filter". A control that changes nothing is bad;
// a control that changes nothing while documented as working is how an operator comes to trust a
// filtered view that was never filtered.
//
// So: any page keeping a `hubFilter` must source it from `useHubContextFilter()`. Declaring it as
// a bare `useState('')` is the exact disconnection this finding was, and it is invisible in
// review because the page looks complete on its own.
//
//   node scripts/check-hub-context.mjs
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

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8');
  if (!/\bhubFilter\b/.test(src)) continue;
  const declaresOwn = /const\s*\[\s*hubFilter\s*,\s*setHubFilter\s*\]\s*=\s*(React\.)?useState/.test(src);
  if (declaresOwn) {
    problems.push(
      `${rel}: declares hubFilter with useState — use useHubContextFilter() so the header ` +
        `switcher reaches this page.`,
    );
  }
}

if (problems.length) {
  console.error('[SHL-3-8] hub-context guard FAILED:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error(
    "\nFix: const [hubFilter, setHubFilter] = useHubContextFilter();\n" +
      '     (src/utils/useHubContextFilter.ts — defaults to the header selection and follows it.)\n',
  );
  process.exit(1);
}
console.log('[SHL-3-8] every hub filter reads the header hub context. OK');
