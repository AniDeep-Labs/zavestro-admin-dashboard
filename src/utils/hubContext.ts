// T3-1 (S-2): the header hub-context switcher's selection, for hub-agnostic roles
// (super/finance/procurement). Persisted so pages can read it as their default hub filter.
const KEY = 'zavestro_admin_hub';

export const getAdminHubContext = (): string => localStorage.getItem(KEY) || '';

// [SHL-3-8] Subscribers, so a page already on screen follows the switcher instead of only
// picking it up on the next mount. `storage` events fire in OTHER tabs, never the one that
// wrote — so same-tab listeners are kept here explicitly.
type Listener = (id: string) => void;
const listeners = new Set<Listener>();

export const setAdminHubContext = (id: string): void => {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn(id));
};

/** Subscribe to hub-context changes. Returns an unsubscribe for useEffect. */
export const subscribeAdminHubContext = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
