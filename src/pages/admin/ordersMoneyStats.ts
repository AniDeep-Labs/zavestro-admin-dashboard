/**
 * [SHL-5-5] The two judgements behind the Orders & Money overview, separated so they can be
 * exercised. Values only — no components — so react-refresh stays quiet ([CM-22-8]).
 */
import type { AdminOrder } from '../../api/adminApi';

/** Orders that are no longer moving through the floor. Age past these is not an exception. */
export const SETTLED_STAGES = ['delivered', 'cancelled'];

export const AGED_DAYS = 7;

/**
 * Hours the order has been in its CURRENT stage.
 *
 * `stuck_hours` when the server sent it — that is the same figure the orders list and the nav
 * badge use, so this page cannot disagree with them about what "stuck" means. Failing that,
 * `entered_stage_at`, which a DB trigger advances on every stage change ([SUP-27-5]).
 *
 * Deliberately NOT `updated_at`: any write bumps it — a note, a claim, an unrelated webhook —
 * so an order that has sat in one stage for a fortnight can look minutes old.
 */
export function ageHours(o: AdminOrder, now: number = Date.now()): number {
  if (o.stuck_hours != null) return o.stuck_hours;
  const t = o.entered_stage_at ?? o.created;
  return t ? Math.floor((now - new Date(t).getTime()) / 3_600_000) : 0;
}

/** Still on the floor, and older than the threshold. */
export function agedOrders(
  orders: AdminOrder[],
  days: number = AGED_DAYS,
  now: number = Date.now(),
): AdminOrder[] {
  return orders.filter(
    (o) => !SETTLED_STAGES.includes(o.stage) && ageHours(o, now) >= days * 24,
  );
}
