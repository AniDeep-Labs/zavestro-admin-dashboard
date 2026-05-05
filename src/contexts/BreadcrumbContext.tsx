import React from 'react';

/**
 * Allows detail pages to set a human-readable title for the last breadcrumb
 * segment (which would otherwise display as a raw UUID).
 */

interface BreadcrumbContextValue {
  /** The human-readable title to show instead of the UUID segment. */
  title: string;
  /** Call from detail pages once the entity name is loaded. */
  setTitle: (title: string) => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({
  title: '',
  setTitle: () => {},
});

export const BreadcrumbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [title, setTitle] = React.useState('');
  const value = React.useMemo(() => ({ title, setTitle }), [title]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
};

/** Call setTitle('Entity Name') from detail pages to fix the breadcrumb. */
export function useBreadcrumbTitle(name: string | undefined | null) {
  const { setTitle } = React.useContext(BreadcrumbContext);
  React.useEffect(() => {
    setTitle(name ?? '');
    return () => setTitle('');
  }, [name, setTitle]);
}

/** Read the current breadcrumb title (used by AdminLayout). */
export function useBreadcrumb() {
  return React.useContext(BreadcrumbContext);
}
