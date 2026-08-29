#!/usr/bin/env node
// [LGC-24-2] ROUTE CAPABILITY COVERAGE — every admin route is gated by something.
//
// AdminLayout decides what a role may open from two tables: NAV_CAP (derived from the
// sidebar) and NAV_LESS_CAP (prefix rules for pages with no nav ancestor). A route in
// neither is ungated: any authenticated admin gets the page shell, its buttons, and a
// row of "your admin role lacks permission" toasts as each fetch is refused. The API
// denies correctly — which is the point. The UI is the half that lies.
//
// This had shipped three times by the time it was written down: DSG-13-3 (a nav item
// whose `caps:` the guard ignored), CM-20-1 (a denied lookup) and LGC-24-2 (a nav-less
// route). Three instances of one shape is a guard, not three fixes.
//
//   node scripts/check-route-caps.mjs
import { readFileSync } from 'node:fs';

const layout = readFileSync('src/pages/admin/AdminLayout.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

// Routes declared under the admin shell, e.g. <Route path="catalog/products" …>.
//
// A route whose element is <Navigate> is skipped: it renders no page and issues no
// fetches, it just forwards to a route that IS gated. Gating the redirect as well would
// mean a role sees the refusal screen at a URL it was only ever passing through.
const routes = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g)]
  .filter((m) => m[2] !== 'Navigate')
  .map((m) => m[1])
  .filter((p) => p && p !== '*' && !p.startsWith('/'))
  .map((p) => '/admin/' + p.replace(/\/?:\w+.*$/, '').replace(/\/$/, ''))
  .filter((p) => p !== '/admin');

// Nav paths (a route under one of these inherits its NAV_CAP entry).
const navPaths = [...layout.matchAll(/path:\s*["']([^"']+)["']/g)].map((m) => m[1]);
// Explicit prefix rules.
const lessCapBlock = layout.slice(
  layout.indexOf('const NAV_LESS_CAP'),
  layout.indexOf('const NAV_LESS_CAP') + 2000,
);
const lessCap = [...lessCapBlock.matchAll(/prefix:\s*["']([^"']+)["']/g)].map((m) => m[1]);

// Routes every authenticated admin may open, by design. Each needs a reason.
const ALLOWED_UNGATED = [
  '/admin/profile', // your own profile — any admin may view it
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/admin/change-password',
  '/admin/register',
  '/admin/no-access', // the refusal screen itself
  '/admin/help', // help text — every admin may read how the console works
];

const covered = (r) =>
  ALLOWED_UNGATED.includes(r) ||
  navPaths.some((n) => r === n || r.startsWith(n + '/')) ||
  lessCap.some((pfx) => r.startsWith(pfx));

const uncovered = [...new Set(routes)].filter((r) => !covered(r)).sort();

if (uncovered.length) {
  console.error('\n✖ Admin routes with NO capability guard:\n');
  for (const r of uncovered) console.error(`  ${r}`);
  console.error(
    '\nA route in neither NAV_CAP (via a nav item) nor NAV_LESS_CAP renders its page',
    '\nshell to every role, and refuses each fetch with a toast instead of showing the',
    '\naccess-denied screen once. Add a NAV_LESS_CAP prefix in AdminLayout.tsx, or add',
    '\nthe route to ALLOWED_UNGATED here with a reason if every admin really may open it.\n',
  );
  process.exit(1);
}
console.log(`check-route-caps: ok — ${routes.length} admin routes, all capability-guarded.`);
