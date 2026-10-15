import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AlarmScheduler, AlarmItem, PermissionStatusResult } from './types';
import { nativeScheduler } from './nativeScheduler';
import { webScheduler } from './webScheduler';
import {
  generate7DayPrayerAlarms,
  generateKhatmReminderAlarm,
  generateDailyWirdAlarm,
} from './pureAlarmGenerator';
import { getUnifiedSettings } from './settingsStore';
import { getSavedCity, getSavedCustomCoords } from '../prayerTimesService';
import { db } from '../../db/quranDb';

export * from './types';
export * from './pureAlarmGenerator';
export * from './settingsStore';
export { nativeScheduler } from './nativeScheduler';
export { webScheduler } from './webScheduler';

let isAppWatcherInitialized = false;

/**
 * دریافت زمان‌بند مناسب بر مبنای پلتفرم (Native Capacitor یا Web/PWA)
 */
export function getAlarmScheduler(): AlarmScheduler {
  return Capacitor.isNativePlatform() ? nativeScheduler : webScheduler;
}

/**
 * باززمان‌بندی کامل همه آلارم‌ها (اذان ۷ روزه، یادآور ختم و ورد روزانه)
 * هماهنگ‌شده با تغییرات شهر، تنظیمات، پیشرفت ختم و بیدار شدن سیستم
 */
export async function rescheduleAllAlarms(): Promise<void> {
  const scheduler = getAlarmScheduler();
  const settings = await getUnifiedSettings();

  const city = getSavedCity();
  const customCoords = getSavedCustomCoords();
  const coords = customCoords || {
    latitude: city.latitude,
    longitude: city.longitude,
    elevation: city.elevation,
    timezone: city.timezone,
  };

  const now = new Date();
  const allAlarms: AlarmItem[] = [];

  // ۱. تولید آلارم‌های ۷ روز آینده اذان
  const prayerAlarms = generate7DayPrayerAlarms(
    coords,
    settings.azan,
    now
  );
  allAlarms.push(...prayerAlarms);

  // ۲. استخراج برنامه فعال ختم و تولید آلارم یادآور
  try {
    const activeKhatm = await db.khatmPlans.filter((p) => p.isActive).first();
    const khatmAlarm = generateKhatmReminderAlarm(
      activeKhatm,
      settings.khatmReminder,
      [],
      [],
      now
    );
    if (khatmAlarm) {
      allAlarms.push(khatmAlarm);
    }
  } catch (e) {
    console.warn('[Notifications] Error fetching khatm plans:', e);
  }

  // ۳. تولید آلارم ورد روزانه
  const wirdAlarm = generateDailyWirdAlarm(settings.dailyWird, now);
  if (wirdAlarm) {
    allAlarms.push(wirdAlarm);
  }

  // ۴. ارسال به زمان‌بند پلتفرم
  await scheduler.scheduleAlarms(allAlarms);
}

/**
 * دکمهٔ آزمایش آلارم واقعی سیستم عامل دقیقاً برای ۱ دقیقه بعد (ویژه تست Native)
 */
export async function testNativeAlarmIn1Minute(): Promise<Date> {
  const scheduler = getAlarmScheduler();
  const settings = await getUnifiedSettings();
  const triggerTime = new Date(Date.now() + 60 * 1000);

  const testAlarm: AlarmItem = {
    id: 999,
    title: 'تست آلارم دقیق سیستمی - قرآن مبین',
    body: `نوای اذان با صدای ${settings.azan.selectedMuezzinId} - زمان‌بندی موفق در اندروید`,
    scheduleAt: triggerTime,
    channelId: `azan_${settings.azan.selectedMuezzinId}`,
    sound: `azan_${settings.azan.selectedMuezzinId}.mp3`,
    type: 'test',
    extra: {
      prayerName: 'تست سیستمی اذان',
      muezzinId: settings.azan.selectedMuezzinId,
    },
  };

  await scheduler.scheduleAlarms([testAlarm]);
  return triggerTime;
}

/**
 * راه‌اندازی شنونده‌های تغییرات سراسری برای باززمان‌بندی خودکار
 */
export function initNotificationWatchers(): void {
  if (isAppWatcherInitialized || typeof window === 'undefined') return;
  isAppWatcherInitialized = true;

  // ۱. باززمان‌بندی هنگام تغییر تنظیمات اذان یا ختم
  window.addEventListener('mobin-azan-settings-changed', () => {
    rescheduleAllAlarms().catch(() => {});
  });
  window.addEventListener('mobin-khatm-updated', () => {
    rescheduleAllAlarms().catch(() => {});
  });
  window.addEventListener('mobin-city-changed', () => {
    rescheduleAllAlarms().catch(() => {});
  });

  // ۲. باززمان‌بندی هنگام بازگشت اپلیکیشن به فوکوس در اندروید
  if (Capacitor.isNativePlatform()) {
    try {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          rescheduleAllAlarms().catch(() => {});
        }
      });
    } catch {}
  } else {
    window.addEventListener('focus', () => {
      rescheduleAllAlarms().catch(() => {});
    });
  }

  // اجرای اولیه در بارگذاری
  rescheduleAllAlarms().catch(() => {});
}
