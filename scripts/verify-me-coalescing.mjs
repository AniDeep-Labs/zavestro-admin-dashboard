#!/usr/bin/env node
/**
 * [SHL-2-14] Behavioural check for the `/auth/me` request coalescing in src/api/adminApi.ts.
 *
 * This dashboard has no test runner (package.json has lint + guards, no jest/vitest), so this
 * is a standalone harness rather than a unit test. It is deliberately NOT wired into
 * `npm run guards`: it needs an esbuild bundle step and esbuild is not a local dependency,
 * so running it in CI would download a toolchain on every guards run. Run it by hand when
 * touching `adminAuthExtApi.me`:
 *
 *     node scripts/verify-me-coalescing.mjs
 *
 * What it pins, and why each one matters:
 *
 *   1. Concurrent callers share ONE request. That is the actual fix — AdminLayout,
 *      AdminProfilePage, AdminLoginPage, RestockQueuePage and ListingRequestsPage all ask
 *      independently and mount together.
 *
 *   2. A call made AFTER the previous one settled hits the network again. This is the
 *      important one. Coalescing must not become caching: [SHL-2-11] exists because a stale
 *      identity had already shipped a bug (a demoted super_admin still read as super_admin).
 *      The first version of this fix released the promise with `.finally()` hung off the
 *      promise handed to callers, which clears one or two microtasks LATE — a caller
 *      re-asking straight after its own `await` got the settled answer back. That is a cache,
 *      and this assertion is what caught it.
 *
 *   3. A failure is shared by concurrent callers, and does not pin the rejected promise:
 *      the next call is a real retry, not a replay of one bad response.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'me-coalesce-')), 'adminApi.mjs');
execFileSync(
  'npx',
  ['--yes', 'esbuild', 'src/api/adminApi.ts', '--bundle', '--format=esm', '--platform=neutral',
   `--outfile=${out}`, '--define:import.meta.env={"VITE_API_URL":"http://localhost:8080"}',
   '--log-level=error'],
  { stdio: 'inherit' },
);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { location: { pathname: '/admin', href: '' } };

let calls = 0;
let mode = 'ok';
globalThis.fetch = async () => {
  calls++;
  await new Promise((r) => setTimeout(r, 30)); // a real in-flight window
  if (mode === 'fail') throw new Error('network down');
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ id: 'a1', role: 'super_admin', capabilities: ['x'] }),
    text: async () => '{}',
  };
};

const { adminAuthExtApi } = await import(out);
const results = [];
const check = (label, got, want) => {
  const pass = got === want;
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: got ${got}, want ${want}`);
};

calls = 0;
const three = await Promise.all([adminAuthExtApi.me(), adminAuthExtApi.me(), adminAuthExtApi.me()]);
check('3 concurrent callers -> network calls', calls, 1);
check('all three got the same identity', three.map((m) => m.role).join(','), 'super_admin,super_admin,super_admin');

calls = 0;
await adminAuthExtApi.me();
await adminAuthExtApi.me();
check('2 sequential calls after settle -> network calls (must NOT be cached)', calls, 2);

mode = 'fail';
calls = 0;
const settled = await Promise.allSettled([adminAuthExtApi.me(), adminAuthExtApi.me()]);
check('2 concurrent callers during failure -> network calls', calls, 1);
check('both callers saw the rejection', settled.map((s) => s.status).join(','), 'rejected,rejected');

mode = 'ok';
calls = 0;
const after = await adminAuthExtApi.me();
check('retry after failure -> network calls', calls, 1);
check('retry succeeded', after.role, 'super_admin');

const ok = results.every(Boolean);
console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
process.exit(ok ? 0 : 1);
