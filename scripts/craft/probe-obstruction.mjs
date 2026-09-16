// Craft probe: is this control actually CLICKABLE, or only visible?
//
// [DSG-11-17] Rendered craft debt is invisible to tsc, to the guards and to a screenshot.
// A control can be painted, sized and styled correctly and still be unusable because
// something transparent sits on top of it. This asks the browser the only question that
// matters: at the centre of this control, what would the click actually hit?
//
//   node scripts/craft/probe-obstruction.mjs [viewportWidth]      # the real answer
//   SABOTAGE=1 node scripts/craft/probe-obstruction.mjs [width]   # prove the probe works
//
// Needs `npm run dev` on :5173. No backend: the API is stubbed below.
//
// Playwright is deliberately NOT a dependency of this repo — this is a hand-run craft tool,
// not a CI guard, and it is not worth a browser download in every install. Run:
//   npm i --no-save playwright && npx playwright install chromium-headless-shell
//
// ⚠️ FOUR false passes were built into this before it told the truth. Each one printed a
// tidy all-clear:
//   1. elementFromPoint returns NULL for a point outside the viewport, and "not covered"
//      was read as "clickable". Out-of-view is now UNKNOWN and counts as a PROBLEM.
//   2. Requiring the WHOLE element in view flagged perfectly probeable buttons; only the
//      CENTRE needs to be, since that is the point sampled.
//   3. Scrolling inside one loop shifted layout between injecting the test overlay and
//      measuring, so obstructions were missed. Each control is now scrolled, settled and
//      measured in its own round-trip.
//   4. Two of the three "Fill standard" buttons live inside a COLLAPSED <details>, so they
//      could never be reached. Every disclosure is opened first.
//
// ALWAYS run SABOTAGE=1 first. If it does not report every target COVERED, the clean run
// proves nothing.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'playwright is not installed (it is deliberately not a dependency of this repo).\n' +
    '  npm i --no-save playwright && npx playwright install chromium-headless-shell',
  );
  process.exit(2);
}
const CAPS = ["catalog:write","cms:write","customers:read","customers:write","designs:write","distribution:write","finance:read","finance:write","fit:read","orders:read","orders:write","pricing:write","qc:write","refunds:approve","reports:read","restock:write","reviews:moderate","samples:write","staff:manage","system:manage"];

const tpl = {
  id:'gc1', name:'Trouser', slug:'trouser', body_region:'lower', drafting_block:'lower',
  capture_set:['waist','hip','inseam'],
  pain_point_menu:{}, body_shape_menu:{ seat:{ waist:1 } },
  tolerances:{ waist:0.5, hip:0.5, inseam:0.5 },
  cutting_spec:null, qc_reality:{ has_template:false, check_count:0 },
  available_fit_presets:['slim','regular'], garment_types:['trouser'],
  fit_presets:[{ fit_preset:'slim', params:{ waist:1 } }],
  length_bands:[], version:3, version_saved_at:new Date().toISOString(),
  // ChartRow NESTS its numbers under `measurements` — a flat row makes hydrate() throw
  // "Cannot convert undefined or null to object" and the page never renders.
  chart:[{ fit_preset:'slim', size_label:'30', measurements:{ waist:30, hip:38, inseam:30 }, unit:'in', measurement_basis:'body' },
         { fit_preset:'slim', size_label:'32', measurements:{ waist:32, hip:40, inseam:30 }, unit:'in', measurement_basis:'body' }],
  used_by_designs:0, used_by_fit_profiles:0, used_by_storefront_categories:0, used_by_orders:0,
};

const b = await chromium.launch();
const W = Number(process.argv[2] || 1440);
const ctx = await b.newContext({ viewport:{ width:W, height:1000 } });
await ctx.addInitScript(([caps]) => {
  localStorage.setItem('zavestro_admin_token','stub.jwt.token');
  localStorage.setItem('zavestro_admin_caps', JSON.stringify(caps));
  localStorage.setItem('zavestro_admin_user', JSON.stringify({ id:'stub', email:'a@b.c', name:'RH', role:'admin', is_active:true }));
}, [CAPS]);
const page = await ctx.newPage();
const json=(o,status=200)=>({status,contentType:'application/json',body:JSON.stringify(o)});
await page.route((url)=>/\/api\/(admin|auth)\//.test(url.pathname), async (route)=>{
  const path=new URL(route.request().url()).pathname;
  if (/\/garment-categories\/[^/]+\/template$/.test(path)) return route.fulfill(json({success:true,data:tpl}));
  if (path.endsWith('/designs/garment-categories')) return route.fulfill(json({success:true,data:[tpl]}));
  if (path.endsWith('/designs/test-bodies')) return route.fulfill(json({success:true,data:{bodies:[]}}));
  if (path.endsWith('/hubs')) return route.fulfill(json({success:true,data:{hubs:[],total:0}}));
  if (path.includes('/notifications')) return route.fulfill(json({success:true,data:{notifications:[],items:[],unread:0,total:0}}));
  if (path.includes('/auth/me')) return route.fulfill(json({success:true,data:{id:'stub',email:'a@b.c',name:'RH',role:'admin',capabilities:CAPS,is_active:true}}));
  if (path.includes('/nav-counts')) return route.fulfill(json({success:true,data:{}}));
  return route.fulfill(json({success:true,data:[]}));
});
const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await page.goto('http://localhost:5173/admin/design/templates/gc1',{waitUntil:'networkidle'});
await page.waitForTimeout(1200);

// Probe ONE button per round-trip: scroll, let layout settle, THEN measure. Doing the
// scroll inside a single loop shifts the page between appending an overlay and calling
// elementFromPoint, so an obstruction can be missed — proven by sabotage.
// Two of the three "Fill standard" buttons live inside a COLLAPSED <details class="advanced">.
// Probing without opening it reports "could not scroll into view" forever — and, with the old
// reporting, reported them clickable. Open every disclosure first.
const opened = await page.evaluate(() => {
  const ds = [...document.querySelectorAll('details')];
  ds.forEach((d) => { d.open = true; });
  return ds.length;
});
console.log(`  opened ${opened} <details> disclosure(s) before probing`);
await page.waitForTimeout(350);

const targets = await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .map((x, i) => ({ i, t: (x.textContent || '').replace(/\s+/g, ' ').trim() }))
    .filter((o) => /fill standard|add tweak|add size|add band/i.test(o.t)),
);

const report = [];
for (const tgt of targets) {
  await page.evaluate((i) => document.querySelectorAll('button')[i].scrollIntoView({ block: 'center' }), tgt.i);
  await page.waitForTimeout(220);
  const r = await page.evaluate(([i, SAB]) => {
    const x = document.querySelectorAll('button')[i];
    const b = x.getBoundingClientRect();
    if (SAB) {
      const o = document.createElement('div');
      o.className = 'injectedOverlay';
      o.style.cssText = `position:fixed;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;z-index:99999;background:transparent`;
      document.body.appendChild(o);
    }
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const top = b.width && b.height ? document.elementFromPoint(cx, cy) : null;
    const d = (e) => !e ? 'null' : e.tagName.toLowerCase() + '.' + String(e.className || '').split(' ').filter(Boolean).slice(0, 2).join('.');
    // Only the CENTRE needs to be in view — that is the point elementFromPoint samples.
    // Requiring the whole element reported "unknown" for buttons that were perfectly probeable.
    const cxv = b.left + b.width / 2, cyv = b.top + b.height / 2;
    const inView = cxv >= 0 && cxv <= innerWidth && cyv >= 0 && cyv <= innerHeight;
    return { w: Math.round(b.width), h: Math.round(b.height), inView,
             covered: top ? !(x === top || x.contains(top)) : null, top: d(top), disabled: x.disabled };
  }, [tgt.i, process.env.SABOTAGE === '1']);
  report.push({ t: tgt.t.slice(0, 32), ...r });
  if (process.env.SABOTAGE === '1')
    await page.evaluate(() => document.querySelectorAll('.injectedOverlay').forEach((o) => o.remove()));
}

console.log(`\n── viewport ${W}px${process.env.SABOTAGE === '1' ? ' · SABOTAGE' : ''} ──`);
let bad = 0;
for (const r of report) {
  if (!r.w || !r.h) { bad++; console.log(`  ✗ ZERO-SIZE  "${r.t}" (${r.w}x${r.h})`); }
  else if (!r.inView || r.covered === null) { bad++; console.log(`  ? UNKNOWN    "${r.t}" — could not be scrolled into view; elementFromPoint says nothing. NOT a pass.`); }
  else if (r.covered) { bad++; console.log(`  ✗ COVERED    "${r.t}" (${r.w}x${r.h}) → topmost: ${r.top}`); }
  else console.log(`  ✓ clickable  "${r.t}" (${r.w}x${r.h})${r.disabled ? ' [disabled]' : ''}`);
}
console.log(`${bad} problem(s) of ${report.length} probed.`);
if (errs.length) console.log('pageerror:', errs[0]);
await page.screenshot({ path:'/tmp/dsg1117.png', fullPage:true });
await b.close();
