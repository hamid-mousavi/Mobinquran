/**
 * ابزار مدیریت لاگ‌های برنامه قرآن مبین
 * در محیط توسعه لاگ‌ها را با برچسب مشخص چاپ می‌کند و در محیط تولید از شلوغی کنسول جلوگیری می‌نماید.
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug('[MobinQuran:Debug]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info('[MobinQuran:Info]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn('[MobinQuran:Warn]', ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error('[MobinQuran:Error]', ...args);
    }
  },
};
