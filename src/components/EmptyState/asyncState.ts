/**
 * RC-3 helpers — plain module, no components, so react-refresh stays happy
 * (the same rule that applies to StatusBadge/vocab.ts).
 *
 * The house rule these serve: a panel must distinguish **empty · loading · denied
 * · failed**, and no `catch(() => {})` may render a value. The audit found the
 * same defect on body data, CX context, money and a zero-capability dashboard —
 * a request fails, the catch swallows it, and the UI reports the absence as a
 * fact about the business.
 */

/** 403 (and 401) mean "you may not see this" — never "there is nothing here". */
export function isDenied(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

/** The server's own message, when it said something useful. */
export function errorMessage(error: unknown): string | undefined {
  const m = (error as { message?: string } | null)?.message;
  return m && m.trim() ? m : undefined;
}
