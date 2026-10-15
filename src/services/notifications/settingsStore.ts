import { db } from '../../db/quranDb';
import { getAzanSettings, saveAzanSettings, AzanSettings } from '../azanService';
import { logger } from '../../utils/logger';
import {
  UnifiedNotificationSettings,
  KhatmReminderSettings,
  DailyWirdSettings,
} from './types';

const SETTINGS_KEY = 'unified_notification_settings';
const KHATM_REMINDER_KEY = 'mobin_khatm_reminder_settings';
const DAILY_WIRD_KEY = 'mobin_daily_wird_settings';

export const DEFAULT_KHATM_REMINDER: KhatmReminderSettings = {
  enabled: true,
  hour: 19,
  minute: 30,
};

export const DEFAULT_DAILY_WIRD: DailyWirdSettings = {
  enabled: false,
  hour: 7,
  minute: 0,
  text: 'اللهم صل علی محمد و آل محمد و عجل فرجهم',
};

/**
 * دریافت تنظیمات یادآور ختم از حافظه
 */
export function getKhatmReminderSettings(): KhatmReminderSettings {
  if (typeof window === 'undefined') return DEFAULT_KHATM_REMINDER;
  try {
    const raw = localStorage.getItem(KHATM_REMINDER_KEY);
    if (!raw) return DEFAULT_KHATM_REMINDER;
    return { ...DEFAULT_KHATM_REMINDER, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_KHATM_REMINDER;
  }
}

/**
 * ذخیره تنظیمات یادآور ختم
 */
export function saveKhatmReminderSettings(settings: KhatmReminderSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KHATM_REMINDER_KEY, JSON.stringify(settings));
    // همگام‌سازی ناهمگام با Dexie
    syncToDexie().catch(() => {});
  } catch {}
}

/**
 * دریافت تنظیمات ورد روزانه
 */
export function getDailyWirdSettings(): DailyWirdSettings {
  if (typeof window === 'undefined') return DEFAULT_DAILY_WIRD;
  try {
    const raw = localStorage.getItem(DAILY_WIRD_KEY);
    if (!raw) return DEFAULT_DAILY_WIRD;
    return { ...DEFAULT_DAILY_WIRD, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DAILY_WIRD;
  }
}

/**
 * ذخیره تنظیمات ورد روزانه
 */
export function saveDailyWirdSettings(settings: DailyWirdSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_WIRD_KEY, JSON.stringify(settings));
    // همگام‌سازی ناهمگام با Dexie
    syncToDexie().catch(() => {});
  } catch {}
}

/**
 * دریافت یکپارچه کل تنظیمات (اذان، ختم و ورد)
 */
export async function getUnifiedSettings(): Promise<UnifiedNotificationSettings> {
  try {
    const record = await db.appSettings.get(SETTINGS_KEY);
    if (record && record.data) {
      return record.data as UnifiedNotificationSettings;
    }
  } catch (err) {
    // خطای خواندن دیتابیس لوکال، استفاده از فال‌بک localStorage
    logger.warn('Failed to read appSettings from Dexie, using fallback:', err);
  }

  // فال‌بک و مهاجرت شفاف از localStorage بدون ریسک از دست رفتن اطلاعات
  const azan = getAzanSettings();
  const khatmReminder = getKhatmReminderSettings();
  const dailyWird = getDailyWirdSettings();

  const unified: UnifiedNotificationSettings = {
    azan,
    khatmReminder,
    dailyWird,
    version: 1,
  };

  try {
    await db.appSettings.put({
      key: SETTINGS_KEY,
      version: 1,
      data: unified,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Failed to initialize appSettings in Dexie:', err);
  }

  return unified;
}

/**
 * ذخیره یکپارچه کل تنظیمات در دیتابیس Dexie و آینه‌سازی در localStorage
 */
export async function saveUnifiedSettings(settings: Partial<UnifiedNotificationSettings>): Promise<void> {
  const current = await getUnifiedSettings();
  const next: UnifiedNotificationSettings = {
    ...current,
    ...settings,
    version: (current.version || 1) + 1,
  };

  if (settings.azan) {
    saveAzanSettings(settings.azan);
  }
  if (settings.khatmReminder) {
    saveKhatmReminderSettings(settings.khatmReminder);
  }
  if (settings.dailyWird) {
    saveDailyWirdSettings(settings.dailyWird);
  }

  try {
    await db.appSettings.put({
      key: SETTINGS_KEY,
      version: next.version,
      data: next,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Failed to save unified appSettings to Dexie:', err);
  }
}

async function syncToDexie(): Promise<void> {
  const azan = getAzanSettings();
  const khatmReminder = getKhatmReminderSettings();
  const dailyWird = getDailyWirdSettings();

  const unified: UnifiedNotificationSettings = {
    azan,
    khatmReminder,
    dailyWird,
    version: 1,
  };

  await db.appSettings.put({
    key: SETTINGS_KEY,
    version: 1,
    data: unified,
    updatedAt: new Date().toISOString(),
  });
}
