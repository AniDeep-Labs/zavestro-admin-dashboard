import type { KeyboardEvent } from "react";

/**
 * [DSA-45-1] The console-wide list row, made operable from a keyboard — once.
 *
 * Every list in this admin opens its detail by clicking the row, and the row was a bare
 * `<tr onClick=…>`: no tabindex, no role, no key handler. On orders, customers, returns,
 * alterations, tickets and invoices, the main path into a record was mouse-only, and a
 * screen reader announced a row of cells with nothing actionable in it.
 *
 * A first pass gave the rows `tabIndex`, `role="button"` and an Enter handler. This
 * finishes it, and puts the pattern in ONE place so the next list copies a helper
 * instead of copying three attributes and getting two of them right:
 *
 *   - **Space activates.** `role="button"` is a promise that the element behaves like a
 *     button, and a real button fires on Enter AND Space. A row that announces itself as
 *     a button and ignores Space is a worse lie than a row that never claimed to be one.
 *   - **Space does not scroll.** Without `preventDefault`, pressing Space on a focused
 *     row pages the list down instead of opening the record — so the one key a
 *     button-user reaches for did the most disorienting possible thing.
 *   - **A key press inside the row does not open it.** Rows carry buttons, links and
 *     copy-id widgets; typing Space on those must not also fire the row. The guard is
 *     `e.target === e.currentTarget`, which is the distinction the hand-rolled handlers
 *     did not make.
 *
 * Usage — spread it, so the three attributes can never drift apart again:
 *
 *   <tr className={styles.row} {...rowActivation(() => navigate(`/admin/orders/${o.id}`))}>
 */
export function rowActivation(onActivate: () => void | Promise<void>) {
  return {
    tabIndex: 0,
    role: "button" as const,
    onClick: () => void onActivate(),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      // A control INSIDE the row owns its own keys.
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault(); // Space would otherwise scroll the page
        void onActivate();
      }
    },
  };
}
