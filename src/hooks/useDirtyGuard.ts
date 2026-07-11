import React from 'react';

/**
 * Warn before losing unsaved edits (FABLE-ADMIN-UIUX §1.2-7 / W-21).
 *
 * Guards the browser-level loss vectors (tab close, refresh, back to a non-app
 * page) via `beforeunload` whenever `dirty` is true, AND (T3-1 / S-6) registers the
 * form in a global set so the shell can confirm before an in-app logout throws the
 * edits away. In-app route blocking would need react-router's data-router
 * `useBlocker`; this app uses <Routes>, so pages pair this hook with a visible
 * "unsaved changes" indicator instead.
 */
const dirtyForms = new Set<string>();

/** T3-1 (S-6): does any mounted form currently hold unsaved edits? */
export const hasUnsavedChanges = (): boolean => dirtyForms.size > 0;

export function useDirtyGuard(dirty: boolean): void {
  const id = React.useId();
  React.useEffect(() => {
    if (dirty) dirtyForms.add(id);
    else dirtyForms.delete(id);
    return () => {
      dirtyForms.delete(id);
    };
  }, [id, dirty]);

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // required for the native prompt in Chromium
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
