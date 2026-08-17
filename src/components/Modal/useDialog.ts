import React from 'react';

/**
 * [DSA-45-2] The dialog behaviour every modal needs, usable without adopting the
 * `<Modal>` markup.
 *
 * `components/Modal/Modal.tsx` is correct. Twelve pages bypass it with their own
 * `modalOverlay` div, and none of the twelve had an Escape handler or
 * `role="dialog"` — verified live on the customer page's *Issue Credits*: the
 * dialog opened, focus stayed on the trigger button (so there was no trap either),
 * and Escape did nothing. The dialogs affected are not incidental — *Issue
 * Credits*, *Deactivate Account*, *Erase customer data*, *Override Stage*,
 * *Create Ticket* — the most consequential and most destructive actions in the
 * product, each in a container a screen reader announces as an ordinary div.
 *
 * Converting all twelve to `<Modal>` means rewriting twelve layouts and their CSS.
 * This is the same behaviour as a hook, so a hand-rolled overlay becomes correct
 * by adding two lines and spreading the returned props — and `<Modal>` itself uses
 * it, so there is exactly one implementation of the trap.
 *
 *   const dialog = useDialog(open, () => setOpen(false));
 *   <div className={s.modalOverlay} onClick={close}>
 *     <div className={s.modal} onClick={stop} {...dialog.dialogProps}>…</div>
 *   </div>
 */
export interface DialogA11y {
  /** Attach to the DIALOG element — never to the backdrop. */
  dialogProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    role: 'dialog';
    'aria-modal': true;
    'aria-label'?: string;
    tabIndex: -1;
  };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialog(open: boolean, onClose: () => void, label?: string): DialogA11y {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus IN. Without this the dialog is announced and then abandoned:
    // the next Tab continues through the page behind it.
    (focusables()[0] ?? ref.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = ref.current?.contains(active) ?? false;
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      // Back to whatever opened it, not to the top of the document.
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return {
    dialogProps: {
      ref,
      role: 'dialog',
      'aria-modal': true,
      'aria-label': label,
      tabIndex: -1,
    },
  };
}
