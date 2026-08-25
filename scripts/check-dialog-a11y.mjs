#!/usr/bin/env node
// [DSA-45-2] GUARD — a hand-rolled modal must still behave like a dialog.
//
// `components/Modal/Modal.tsx` is correct, and twelve pages bypassed it with their own
// `modalOverlay` div. None of the twelve had an Escape handler or `role="dialog"`, and
// none moved focus, so there was no trap either — verified live on the customer page's
// *Issue Credits*: the dialog opened, focus stayed on the trigger, Escape did nothing.
//
// The dialogs affected were not incidental. *Issue Credits*, *Erase customer data*,
// *Override Stage*, *Set Temporary Password*, *Escalate to finance* — the most
// consequential actions in the product, each in a container a screen reader announces as
// an ordinary div.
//
// Converting all of them to `<Modal>` would mean rewriting their layouts and CSS, so the
// behaviour was extracted as `useDialog` and `<Modal>` uses it too: exactly one
// implementation of the trap, reachable in two lines.
//
// The rule enforced here is therefore the same as its twin in check-row-activation.mjs —
// not "have the attributes" but "use the ONE helper". A hand-sprayed `role="dialog"`
// would satisfy a screen reader's first question and still leave focus outside.
//
//   node scripts/check-dialog-a11y.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
// The canonical component IS the implementation; it is allowed to say role="dialog".
const EXEMPT = new Set(['src/components/Modal/Modal.tsx', 'src/components/Modal/useDialog.ts']);

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
  if (EXEMPT.has(rel)) continue;
  const raw = readFileSync(file, 'utf8');
  // Strip comments before matching. The first version of this guard failed on
  // UserDetailPage, whose comment EXPLAINS that these dialogs had no role="dialog" —
  // a guard that reads prose reports the description of a bug as the bug.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const overlays = [...src.matchAll(/className=\{\w+\.modalOverlay\}/g)];
  if (overlays.length === 0) continue;

  const wired = [...src.matchAll(/\.dialogProps\}/g)].length;
  if (wired < overlays.length) {
    problems.push(
      `${rel}: ${overlays.length} hand-rolled overlay(s) but only ${wired} carry ` +
        `useDialog's dialogProps. Each dialog element needs {...someDialog.dialogProps}.`,
    );
  }

  // A hand-written role="dialog" is the tell that someone reached for the attribute
  // rather than the behaviour — it announces a dialog that focus never enters.
  if (/role=["']dialog["']/.test(src)) {
    problems.push(
      `${rel}: hand-written role="dialog". useDialog supplies it along with the focus ` +
        `trap; the attribute on its own announces a dialog nobody can Tab inside.`,
    );
  }
}

if (problems.length) {
  console.error('[DSA-45-2] dialog accessibility guard FAILED:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error(
    '\nFix: const d = useDialog(open, () => close(), \'Label\');\n' +
      '     <div className={s.modal} {...d.dialogProps}>…\n' +
      '     Declare the hook ABOVE any early return — see src/components/Modal/useDialog.ts.\n',
  );
  process.exit(1);
}
console.log('[DSA-45-2] every hand-rolled modal goes through useDialog(). OK');
