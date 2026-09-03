import React from "react";

/**
 * [SUP-28-3] Keep a read-mostly detail screen honest about its own age.
 *
 * The order detail loaded once on mount and re-fetched only after its OWN actions. While
 * an agent is on a call the ops floor can advance the stage, QC can fail the garment, a
 * payment can settle — and the screen keeps showing the old story with nothing to say it
 * is old. The agent then states it as fact. (The admin's CLAUDE.md described this page as
 * having "SSE live updates"; there was no EventSource anywhere in the client.)
 *
 * Polling rather than the SSE stream the backend already serves, deliberately:
 * `EventSource` cannot send an Authorization header, so the customer stream takes the
 * token as `?token=`. Doing that with an ADMIN JWT would put a high-value credential into
 * URLs, access logs and proxy logs — a worse trade than a request every 15s on one page.
 * The audit's own fix line offers polling as the alternative. If the admin ever gains a
 * short-lived stream ticket, swapping this hook's body for a subscription is the whole
 * change.
 *
 * Only polls while the tab is actually visible: a console left open on a second monitor
 * overnight should not be a stream of requests, and an agent who is not looking cannot be
 * misled by what they are not reading.
 */
export function useLiveRefresh(
  refetch: () => Promise<void> | void,
  opts: { intervalMs?: number; enabled?: boolean } = {},
): {
  lastUpdatedAt: number;
  refreshing: boolean;
  lastError: unknown;
  refreshNow: () => void;
} {
  const { intervalMs = 15_000, enabled = true } = opts;
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState(() => Date.now());
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastError, setLastError] = React.useState<unknown>(null);

  // Held in a ref so a caller that rebuilds `refetch` every render does not restart the
  // timer on every render — which would mean it never actually fires.
  const refetchRef = React.useRef(refetch);
  refetchRef.current = refetch;

  const run = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchRef.current();
      setLastUpdatedAt(Date.now());
      setLastError(null);
    } catch (e) {
      // Kept, not discarded. No toast — a background refresh must not interrupt an agent
      // mid-call — but the caller has to be able to SAY it is failing. A timestamp that
      // just keeps ageing looks identical to "nothing has changed", which is the same
      // class of quiet lie this hook exists to remove.
      setLastError(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void run();
      }, intervalMs);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Coming back to the tab is exactly when the screen is most likely to be stale,
        // so refresh immediately rather than waiting out the interval.
        void run();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, run]);

  const refreshNow = React.useCallback(() => void run(), [run]);
  return { lastUpdatedAt, refreshing, lastError, refreshNow };
}

/** "just now" / "20s ago" / "3m ago" — how old the thing on screen is. */
export function freshnessLabel(lastUpdatedAt: number, now: number): string {
  const secs = Math.max(0, Math.round((now - lastUpdatedAt) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
}
