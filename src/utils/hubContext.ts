// T3-1 (S-2): the header hub-context switcher's selection, for hub-agnostic roles
// (super/finance/procurement). Persisted so pages can read it as their default hub filter.
const KEY = 'zavestro_admin_hub';

export const getAdminHubContext = (): string => localStorage.getItem(KEY) || '';

export const setAdminHubContext = (id: string): void => {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
};
