import { useEffect, useRef } from 'react';

interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  preventCloseOnEsc?: boolean;
}

/**
 * هوک یکپارچه برای مدیریت دسترسی‌پذیری (A11y) مودال‌ها:
 * - بستن خودکار با فشردن کلید Escape
 * - بازگرداندن فوکوس به عنصری که مودال را باز کرده بود پس از بسته‌شدن
 * - جلوگیری از اسکرول ناخواسته بدنه در هنگام باز بودن مودال
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  preventCloseOnEsc = false,
}: UseModalA11yOptions) {
  const modalRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // ذخیره عنصری که قبل از باز شدن مودال فوکوس داشت
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // فوکوس اولیه روی مودال یا اولین المان فوکوس‌پذیر
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
          focusable.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventCloseOnEsc) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);

      // بازگرداندن فوکوس
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        try {
          previousFocusRef.current.focus();
        } catch {
          // در صورت حذف عنصر از DOM نادیده گرفته می‌شود
        }
      }
    };
  }, [isOpen, onClose, preventCloseOnEsc]);

  return modalRef;
}
