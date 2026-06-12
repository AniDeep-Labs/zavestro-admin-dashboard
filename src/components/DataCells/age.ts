// Age helpers (plain module — keeps react-refresh happy for DataCells.tsx).
export const HOUR_MS = 3_600_000;

export function ageLabel(iso: string | null | undefined, now: number): string {
  if (!iso) return '—';
  const ms = now - new Date(iso).getTime();
  if (ms < HOUR_MS) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (ms < 24 * HOUR_MS) return `${Math.floor(ms / HOUR_MS)}h`;
  return `${Math.floor(ms / (24 * HOUR_MS))}d`;
}
