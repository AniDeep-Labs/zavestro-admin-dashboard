/**
 * [SHL-4-8] The arithmetic behind the role landing block, separated so it can be exercised.
 *
 * Values only — no components — so `react-refresh/only-export-components` stays quiet and the
 * block can be hot-replaced. See [CM-22-8] for what skipping that split costs.
 *
 * Nothing here derives a fact the server already decides. `is_low` especially is READ, never
 * recomputed: three surfaces used to derive it independently and disagreed about a fabric
 * sitting exactly at its reorder point ([CM-19-4]).
 */
import type { FabricStockRow, RestockRequest, SampleJob } from '../../api/adminApi';

export const num = (v: string | number | null | undefined): number => (v == null ? 0 : Number(v));

export interface SupplySummary {
  low: number;
  inTransitMeters: number;
  restocksOwed: number;
}

export function supplySummary(
  stock: FabricStockRow[],
  restocks: RestockRequest[],
): SupplySummary {
  return {
    low: stock.filter((r) => r.is_low).length,
    inTransitMeters: stock.reduce((t, r) => t + num(r.in_transit_meters), 0),
    // Still owed cloth: open, and not yet fully received. `outstanding` is server-computed
    // ([PRC-16-8]); the fallback covers a row loaded before that column existed. A settled or
    // cancelled request owes nothing however its numbers read.
    restocksOwed: restocks.filter(
      (r) =>
        (r.status === 'requested' || r.status === 'shipped') &&
        num(r.outstanding ?? num(r.qty) - num(r.qty_fulfilled)) > 0,
    ).length,
  };
}

export interface SamplingSummary {
  awaitingVerdict: number;
  inFlight: number;
}

export function samplingSummary(jobs: SampleJob[]): SamplingSummary {
  const awaitingVerdict = jobs.filter((j) => j.status === 'design_review').length;
  return { awaitingVerdict, inFlight: jobs.length - awaitingVerdict };
}
