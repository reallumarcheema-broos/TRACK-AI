import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * A bottom sheet (a centred dialog on wide screens). Focus moves in and stays in, Escape and the
 * backdrop close it, and the page behind stays put.
 */
export function Sheet({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    // Hiding the page's scrollbar would widen it, so pad by the scrollbar's width meanwhile.
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCloseRef.current();
      if (e.key !== 'Tab' || !sheet) return;
      const items = sheet.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      const inside = sheet.contains(document.activeElement);
      if (e.shiftKey ? !inside || document.activeElement === first : !inside || document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/**
 * Open/close state for a sheet. The open sheet owns a history entry, so the phone's back gesture
 * closes it instead of leaving the page, and focus goes back to whatever opened it.
 */
export function useSheet<T>() {
  const [value, setValue] = useState<T | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (value === null) return;
    const onPop = () => {
      if (history.state?.sheet) return;
      setValue(null);
      opener.current?.focus();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [value]);

  const open = useCallback((next: T, from?: HTMLElement | null) => {
    opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!history.state?.sheet) history.pushState({ ...history.state, sheet: true }, '');
    setValue(next);
  }, []);

  const close = useCallback(() => {
    if (history.state?.sheet) return history.back(); // the popstate listener above closes it
    setValue(null);
    opener.current?.focus();
  }, []);

  return { value, open, close };
}
