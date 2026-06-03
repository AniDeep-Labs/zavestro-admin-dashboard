import React from 'react';
import { hasCapability } from '../../api/adminApi';

/**
 * Capability gate for UI actions. Renders children only if the signed-in admin's
 * role grants the capability (super_admin holds all). Use to hide action buttons a
 * role can't perform — the backend also enforces these, so this is UX, not the
 * security boundary.
 *
 *   <Can cap="refunds:approve"><button>Issue refund</button></Can>
 *   <Can cap={['orders:write','refunds:approve']} mode="any">…</Can>
 */
export const Can: React.FC<{
  cap: string | string[];
  mode?: 'any' | 'all';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ cap, mode = 'any', children, fallback = null }) => {
  const caps = Array.isArray(cap) ? cap : [cap];
  const ok = mode === 'all' ? caps.every(hasCapability) : caps.some(hasCapability);
  return <>{ok ? children : fallback}</>;
};

/** Imperative form for non-JSX checks. */
export { hasCapability } from '../../api/adminApi';

export default Can;
