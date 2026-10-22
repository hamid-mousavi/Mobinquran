/**
 * لایهٔ واحد و امن برای کار با حافظهٔ محلی (localStorage).
 * - دارای پیشوند مشخص و کلیدهای استاندارد
 * - مدیریت خطاهای QuotaExceeded و محیط‌های بدون دسترسی به استوریج
 * - عدم کرش در مواجهه با JSON خراب یا غیرمعتبر
 */

export const STORAGE_KEYS = {
  SETTINGS: 'quran_settings',
  LAST_READ: 'quran_last_read',
  SELECTED_RECITER: 'mobin_selected_reciter',
  LEGACY_RECITER: 'quran_reciter',
  BOOKMARKED_STORIES: 'quran_bookmarked_stories',
  READ_STORIES: 'quran_read_stories',
  RECENT_SEARCHES: 'mobin_recent_searches',
  DEVICE_ID: 'mobin_device_id_v1',
  AI_HISTORY: 'mobin_ai_chat_history_v1',
  AI_REFLECTIONS: 'mobin_ayah_reflections_v1',
  AUDIO_RESUME: 'mobin_audio_last_position',
  AUDIO_SLEEP: 'mobin_audio_sleep_prefs',
  ACTIVITY: 'mobin_user_activities',
  STREAK: 'mobin_reading_streak',
  REVIEW_DECK: 'mobin_leitner_review_deck',
  MEMORIZED_VERSES: 'mobin_memorized_verses',
  MEMORIZATION_SESSIONS: 'mobin_memorization_sessions',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS] | string;

class SafeStorageService {
  private memoryFallback = new Map<string, string>();

  private isAvailable(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  public getItem<T = string>(key: StorageKey, defaultValue?: T): T | null {
    try {
      if (this.isAvailable()) {
        const item = window.localStorage.getItem(key);
        if (item === null) return defaultValue ?? null;
        try {
          return JSON.parse(item) as T;
        } catch {
          return item as unknown as T;
        }
      }
      const mem = this.memoryFallback.get(key);
      if (mem === undefined) return defaultValue ?? null;
      try {
        return JSON.parse(mem) as T;
      } catch {
        return mem as unknown as T;
      }
    } catch {
      return defaultValue ?? null;
    }
  }

  public setItem<T>(key: StorageKey, value: T): boolean {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      if (this.isAvailable()) {
        window.localStorage.setItem(key, serialized);
        return true;
      }
      this.memoryFallback.set(key, serialized);
      return true;
    } catch {
      this.memoryFallback.set(key, serialized);
      return false;
    }
  }

  public removeItem(key: StorageKey): void {
    try {
      if (this.isAvailable()) {
        window.localStorage.removeItem(key);
      }
      this.memoryFallback.delete(key);
    } catch {
      this.memoryFallback.delete(key);
    }
  }
}

export const appStorage = new SafeStorageService();
