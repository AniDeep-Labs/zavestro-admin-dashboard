#!/usr/bin/env node
// [KA1-1] A rejected login must render, not reload.
//
// catalogApi's fetch wrapper treats every 401 as an expired session and does
// `window.location.href = '/admin/login'`. For the LOGIN request that is a navigation to
// the page the user is already on: the form remounts, so the error thrown by the wrapper
// is set on a component that no longer exists. Driven live, a wrong password showed no
// message, no toast and no [role=alert] at +400ms, +900ms, +1.6s, +3s or +6s, and cleared
// both fields — a pristine, empty form with no evidence the button was ever pressed.
//
// This guard fails if that ever comes back: the redirect must stay conditional, and the
// login call must opt out of it.
//
// Comments are stripped before matching. A guard that can be satisfied by a sentence
// describing the rule is not a guard.
import { readFileSync } from 'node:fs';

const FILE = 'src/api/catalogApi.ts';
const src = readFileSync(FILE, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const problems = [];

if (!/if\s*\(\s*res\.status\s*===\s*401\s*&&\s*on401\s*===\s*'redirect'\s*\)/.test(src)) {
  problems.push(
    `${FILE}: the 401 branch must be conditional — \`res.status === 401 && on401 === 'redirect'\`.\n` +
      `  An unconditional redirect turns a rejected login into a page reload that erases the error.`,
  );
}

// The login call must pass the opt-out. Find its request(...) argument list.
const login = src.match(/login:\s*\([\s\S]*?\)\s*=>\s*request<[\s\S]*?\)\.then/);
if (!login) {
  problems.push(`${FILE}: could not find catalogApi.login — this guard needs updating.`);
} else if (!/'throw'/.test(login[0])) {
  problems.push(
    `${FILE}: catalogApi.login must pass 'throw' as the on401 argument.\n` +
      `  A 401 there is the answer to the question asked, not an expired session.`,
  );
}

if (problems.length) {
  console.error('check-login-401: FAILED\n');
  for (const p of problems) console.error(`  • ${p}\n`);
  process.exit(1);
}
console.log('check-login-401: ok — a rejected login renders instead of reloading');
