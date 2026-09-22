export type ScrollBehaviorOption = ScrollBehavior;

/**
 * آیا کاربر حرکت‌های کمتر را در سیستم فعال کرده است؟ (P3-T6)
 * برای احترام به prefers-reduced-motion در اسکرول و انیمیشن‌ها.
 */
let cachedReduced: boolean | null = null;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (cachedReduced === null) {
    cachedReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return cachedReduced;
}

/**
 * رفتار اسکرول مناسب: در حالت reduced-motion همیشه auto
 */
export function scrollBehavior(): ScrollBehaviorOption {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}