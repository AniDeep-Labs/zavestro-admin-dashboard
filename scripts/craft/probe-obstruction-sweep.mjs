// Craft probe, widened: is EVERY control on the authoring surfaces clickable, or only visible?
//
// [DSG-11-17] `probe-obstruction.mjs` asks the right question but answers it for ONE page and
// four button labels, which is why that item stayed open — "only the one named instance was
// re-probed". This sweeps many routes and every interactive control on them.
//
//   node scripts/craft/probe-obstruction-sweep.mjs [width]      # the real answer
//   SABOTAGE=1 node scripts/craft/probe-obstruction-sweep.mjs   # prove the probe still works
//
// Runs against the REAL local backend (:8080) with a real login, not stubs. The stubbed
// sibling needs a hand-written fixture per page, which is exactly what stopped it covering
// more than one; a seeded database covers every route for free.
//
// Needs: backend on :8080, `npm run dev` on :5173, and an admin seeded by `npm run seed:admin`.
//   npm i --no-save playwright && npx playwright install chromium-headless-shell
//
// ⚠️ The four false passes documented in probe-obstruction.mjs all apply here and are carried
// over verbatim: out-of-view is UNKNOWN (never "clickable"); only the CENTRE need be in view;
// scroll/settle/measure is one round-trip per control; every <details> is opened first.
// ALWAYS run SABOTAGE=1 first — if it does not report every target COVERED, a clean run means
// nothing.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'playwright is not installed (deliberately not a dependency of this repo).\n' +
      '  npm i --no-save playwright && npx playwright install chromium-headless-shell',
  );
  process.exit(2);
}
import fs from 'fs';

const W = parseInt(process.argv[2] || '1440', 10);
const SAB = process.env.SABOTAGE === '1';
const DESIGN = fs.readFileSync('/tmp/craft-design.txt', 'utf8').trim();
const CAT = fs.readFileSync('/tmp/craft-cat.txt', 'utf8').trim();

// The authoring surfaces: where someone CREATES or CALIBRATES something. Craft debt on a
// read-only list is a nuisance; on these it blocks the job.
const ROUTES = [
  ['design library', '/admin/design/library'],
  ['design detail', `/admin/design/library/${DESIGN}`],
  ['garment types', '/admin/design/templates'],
  ['garment template editor', `/admin/design/templates/${CAT}`],
  ['engine tester', '/admin/design/engine-tester'],
  ['cut sheet', `/admin/design/library/${DESIGN}/cut-sheet`],
  ['listings', '/admin/catalog/listings'],
  ['collections', '/admin/catalog/collections'],
  ['fabrics', '/admin/procurement/fabrics'],
  ['sample requests', '/admin/design/samples'],
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));

// Real login — the seeded god-mode account, so no surface is skipped as AccessDenied.
// (super_admin is oversight-only and would silently hide half of these.)
await page.goto('http://localhost:5173/admin/login', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'dsa-all@zavestro.local');
await page.fill('input[type="password"]', 'Admin@1234');
await Promise.all([
  page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
if (page.url().includes('/login')) {
  console.error('✗ login failed — seed with `npm run seed:admin` in the backend');
  await b.close();
  process.exit(1);
}

let totalBad = 0;
let totalProbed = 0;
const findings = [];

for (const [name, route] of ROUTES) {
  await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const body = await page.locator('body').innerText();
  if (/Page not found|don’t have access|Something went wrong/i.test(body)) {
    console.log(`\n── ${name} (${route}) — SKIPPED: ${body.match(/Page not found|don’t have access|Something went wrong/i)[0]}`);
    continue;
  }
  const opened = await page.evaluate(() => {
    const ds = [...document.querySelectorAll('details')];
    ds.forEach((d) => (d.open = true));
    return ds.length;
  });
  await page.waitForTimeout(300);

  // Every control a person can press, not four known labels — minus two things that look
  // like debt and are not. Both were found by running this and reading the output:
  //
  //  1. SKIP LINKS are deliberately parked off-screen until focused. "Out of view" is the
  //     correct state for them, and flagging it on all nine pages was noise drowning the
  //     one real finding.
  //  2. When a MODAL is open its backdrop covers the page beneath, and that is the point.
  //     `/…/cut-sheet` auto-opens one, so every nav item behind it reported COVERED — 85
  //     "problems" that were the dialog working. Inside a dialog, probe only the dialog.
  const n = await page.evaluate(() => {
    const visuallyHidden = (e) => {
      const s = getComputedStyle(e);
      if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return true;
      const b = e.getBoundingClientRect();
      // Parked off-canvas (the usual skip-link trick) rather than laid out on the page.
      return b.bottom < -20 || b.right < -20 || b.left > innerWidth + 20;
    };
    const dialog = document.querySelector('[role="dialog"], dialog[open]');
    const root = dialog || document;
    window.__inDialog = !!dialog;
    window.__t = [...root.querySelectorAll('button, a[href], [role="button"], summary')].filter(
      (e) => {
        const s = getComputedStyle(e);
        return (
          s.display !== 'none' &&
          s.visibility !== 'hidden' &&
          e.offsetParent !== null &&
          !visuallyHidden(e)
        );
      },
    );
    return window.__t.length;
  });
  const inDialog = await page.evaluate(() => window.__inDialog);

  const rows = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => window.__t[k]?.scrollIntoView({ block: 'center' }), i);
    await page.waitForTimeout(60);
    const r = await page.evaluate(
      ([k, sab]) => {
        const x = window.__t[k];
        if (!x) return null;
        // FALSE PASS #5 (this probe's own, found at 820px): an inline element that WRAPS has
        // one client rect per line box, and `getBoundingClientRect()` returns their UNION —
        // a tall box whose centre lands in the gap BETWEEN the lines, where the parent is.
        // "Request restock →" wrapped across two lines and reported COVERED by its own
        // container while being perfectly clickable on both fragments. Sample the first
        // LINE BOX, which is a point actually on the element.
        const rects = x.getClientRects();
        const bb = rects.length > 1 ? rects[0] : x.getBoundingClientRect();
        const wrapped = rects.length > 1;
        if (sab) {
          const o = document.createElement('div');
          o.className = 'injectedOverlay';
          o.style.cssText = `position:fixed;left:${bb.left}px;top:${bb.top}px;width:${bb.width}px;height:${bb.height}px;background:transparent;z-index:2147483647`;
          document.body.appendChild(o);
        }
        const cx = bb.left + bb.width / 2;
        const cy = bb.top + bb.height / 2;
        const top = bb.width && bb.height ? document.elementFromPoint(cx, cy) : null;
        const d = (e) =>
          !e ? 'null' : e.tagName.toLowerCase() + '.' + String(e.className || '').split(' ')[0];
        const inView = cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight;
        return {
          label: (x.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) || `<${x.tagName.toLowerCase()}>`,
          w: Math.round(bb.width),
          h: Math.round(bb.height),
          inView,
          wrapped,
          covered: top ? !(x === top || x.contains(top)) : null,
          top: d(top),
          disabled: !!x.disabled,
        };
      },
      [i, SAB],
    );
    if (SAB) await page.evaluate(() => document.querySelectorAll('.injectedOverlay').forEach((o) => o.remove()));
    if (r) rows.push(r);
  }

  let bad = 0;
  for (const r of rows) {
    totalProbed++;
    if (!r.w || !r.h) { bad++; findings.push(`${name}: ZERO-SIZE "${r.label}" (${r.w}x${r.h})`); }
    else if (!r.inView) { bad++; findings.push(`${name}: OUT-OF-VIEW (unknown) "${r.label}"`); }
    else if (r.covered) { bad++; findings.push(`${name}: COVERED "${r.label}" by ${r.top}`); }
  }
  totalBad += bad;
  console.log(
    `── ${name.padEnd(24)} ${String(rows.length).padStart(3)} controls · ${opened} details` +
      `${inDialog ? ' · in-dialog' : ''} · ${bad ? `✗ ${bad} problem(s)` : '✓ clean'}`,
  );
}

console.log(`\n${SAB ? 'SABOTAGE' : 'CLEAN'} run @ ${W}px — ${totalProbed} controls probed, ${totalBad} problem(s)`);
if (findings.length) { console.log('\nFindings:'); findings.slice(0, 40).forEach((f) => console.log('  ' + f)); }
if (errs.length) console.log(`\npageerrors: ${errs.length} — ${errs[0]}`);
if (SAB && totalBad < totalProbed) {
  console.log(`\n⚠️  SABOTAGE did not flag every control (${totalBad}/${totalProbed}) — a clean run proves nothing.`);
  await b.close();
  process.exit(1);
}
await b.close();
process.exit(totalBad && !SAB ? 1 : 0);
