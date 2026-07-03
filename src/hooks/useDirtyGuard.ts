import React from 'react';

/**
 * Warn before losing unsaved edits (FABLE-ADMIN-UIUX §1.2-7 / W-21).
 *
 * Guards the browser-level loss vectors (tab close, refresh, back to a non-app
 * page) via `beforeunload` whenever `dirty` is true. In-app route blocking would
 * need react-router's data-router `useBlocker`; this app uses <Routes>, so pages
 * pair this hook with a visible "unsaved changes" indicator instead.
 */
export function useDirtyGuard(dirty: boolean): void {
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
