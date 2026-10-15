import { AzanSettings, MUEZZINS_LIST } from '../azanService';
import { calculatePrayerTimes } from '../prayerTimesService';
import { AlarmItem, KhatmReminderSettings, DailyWirdSettings } from './types';
import { KhatmPlan } from '../../types';
import { buildKhatmSegments } from '../../utils/khatmMath';
import { currentKhatmDay } from '../../utils/date';
import { toPersianDigits } from '../../utils/textNormalization';

export interface PrayerCoords {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: number;
}

/**
 * محاسبه تعداد صفحات باقی‌مانده از سهمیه امروز برنامه ختم قرآن
 */
export function calculateKhatmRemainingPagesToday(
  khatmPlan: KhatmPlan,
  juzStarts: number[] = [],
  quarterStarts: number[] = [],
  now: Date = new Date()
): { dayNumber: number; remainingPages: number; totalToday: number; isCompleted: boolean } {
  const targetDays = khatmPlan.targetDays || 30;
  const day = currentKhatmDay(khatmPlan.startDate, targetDays, now);
  const { segments } = buildKhatmSegments(khatmPlan.type, targetDays, juzStarts, quarterStarts);
  const segment = segments[day - 1] || segments[0];
  if (!segment) {
    return { dayNumber: day, remainingPages: 0, totalToday: 0, isCompleted: true };
  }

  const completedSet = new Set(khatmPlan.completedPages || []);
  let unreadCount = 0;
  const totalToday = segment.endPage - segment.startPage + 1;
  for (let p = segment.startPage; p <= segment.endPage; p++) {
    if (!completedSet.has(p)) {
      unreadCount++;
    }
  }

  return {
    dayNumber: day,
    remainingPages: unreadCount,
    totalToday,
    isCompleted: unreadCount === 0,
  };
}

/**
 * تولید لیست خالص آلارم‌های اذان برای ۷ روز آینده
 * با شناسه‌های عددی کاملاً قطعی و بدون تداخل:
 * روز (0 تا 6) * 10 + شناسه وقت (1: صبح، 2: ظهر، 3: مغرب)
 * و برای هشدار پیش از اذان: 100 + همان فرمول
 */
export function generate7DayPrayerAlarms(
  coords: PrayerCoords,
  settings: AzanSettings,
  startDate: Date = new Date(),
  muezzinName?: string
): AlarmItem[] {
  const alarms: AlarmItem[] = [];
  const startMs = startDate.getTime();

  const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];
  const resolvedMuezzinName = muezzinName || muezzin.name;

  const prayers: Array<{ key: 'fajr' | 'dhuhr' | 'maghrib'; name: string; index: number; enabled: boolean }> = [
    { key: 'fajr', name: 'اذان صبح', index: 1, enabled: settings.fajrAlert },
    { key: 'dhuhr', name: 'اذان ظهر', index: 2, enabled: settings.dhuhrAlert },
    { key: 'maghrib', name: 'اذان مغرب', index: 3, enabled: settings.maghribAlert },
  ];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayDate = new Date(startMs + dayIndex * 24 * 3600 * 1000);
    const times = calculatePrayerTimes(
      coords,
      dayDate,
      coords.timezone,
      settings.calculationMethod,
      settings.safetyMarginMinutes
    );

    for (const p of prayers) {
      if (!p.enabled) continue;
      const rawDate = times.rawTimes[p.key];
      if (!rawDate) continue;

      const prayerMs = rawDate.getTime();

      // ۱. هشدار قبل از اذان
      if (settings.preAlertMinutes > 0) {
        const preAlertMs = prayerMs - settings.preAlertMinutes * 60 * 1000;
        if (preAlertMs > startMs) {
          alarms.push({
            id: 100 + dayIndex * 10 + p.index,
            title: `نزدیک به ${p.name} (${toPersianDigits(settings.preAlertMinutes)} دقیقه مانده)`,
            body: 'آمادگی برای اقامه نماز - قرآن مبین',
            scheduleAt: new Date(preAlertMs),
            channelId: 'azan_pre_alerts',
            type: 'pre_alert',
            extra: {
              prayerKey: p.key,
              prayerName: p.name,
              preAlertMinutes: settings.preAlertMinutes,
            },
          });
        }
      }

      // ۲. اذان اصلی
      if (prayerMs > startMs) {
        alarms.push({
          id: dayIndex * 10 + p.index,
          title: `هنگام ${p.name} - قرآن مبین`,
          body: `نوای ملکوتی اذان با صدای ${resolvedMuezzinName} - حیّ علی الصلاة`,
          scheduleAt: new Date(prayerMs),
          channelId: `azan_${settings.selectedMuezzinId}`,
          sound: `azan_${settings.selectedMuezzinId}.mp3`,
          type: 'azan',
          extra: {
            prayerKey: p.key,
            prayerName: p.name,
            muezzinId: settings.selectedMuezzinId,
            muezzinName: resolvedMuezzinName,
          },
        });
      }
    }
  }

  alarms.sort((a, b) => a.scheduleAt.getTime() - b.scheduleAt.getTime());
  return alarms;
}

/**
 * تولید آلارم یادآور برنامه ختم قرآن
 */
export function generateKhatmReminderAlarm(
  khatmPlan: KhatmPlan | null | undefined,
  settings: KhatmReminderSettings,
  juzStarts: number[] = [],
  quarterStarts: number[] = [],
  now: Date = new Date()
): AlarmItem | null {
  if (!settings.enabled || !khatmPlan || !khatmPlan.isActive) {
    return null;
  }

  const { dayNumber, remainingPages, isCompleted } = calculateKhatmRemainingPagesToday(
    khatmPlan,
    juzStarts,
    quarterStarts,
    now
  );

  // اگر سهمیه امروز کامل شده باشد، یادآور امروز لغو می‌شود
  if (isCompleted || remainingPages <= 0) {
    return null;
  }

  const scheduleDate = new Date(now);
  scheduleDate.setHours(settings.hour, settings.minute, 0, 0);

  // اگر ساعت یادآور امروز گذشته باشد، یادآور لغو یا برای فردا زمان‌بندی نمی‌شود تا به کاربر فشار نیاید
  if (scheduleDate.getTime() <= now.getTime()) {
    return null;
  }

  return {
    id: 900,
    title: 'یادآور ختم قرآن مبین',
    body: `${toPersianDigits(remainingPages)} صفحه تا تکمیل هدف امروز (روز ${toPersianDigits(dayNumber)}) باقی‌مانده است.`,
    scheduleAt: scheduleDate,
    channelId: 'khatm_reminders',
    type: 'khatm',
    extra: {
      planId: khatmPlan.id,
      dayNumber,
      remainingPages,
    },
  };
}

/**
 * تولید آلارم ورد روزانه
 */
export function generateDailyWirdAlarm(
  settings: DailyWirdSettings,
  now: Date = new Date()
): AlarmItem | null {
  if (!settings.enabled) {
    return null;
  }

  const scheduleDate = new Date(now);
  scheduleDate.setHours(settings.hour, settings.minute, 0, 0);

  // اگر زمان امروز گذشته باشد، برای فردا تنظیم می‌شود
  if (scheduleDate.getTime() <= now.getTime()) {
    scheduleDate.setDate(scheduleDate.getDate() + 1);
  }

  return {
    id: 950,
    title: 'ورد و تعقیبات روزانه',
    body: settings.text || 'فرصتی برای تلاوت آیات نورانی و ذکر روز - قرآن مبین',
    scheduleAt: scheduleDate,
    channelId: 'daily_wird',
    type: 'daily_wird',
    extra: {
      wirdText: settings.text,
    },
  };
}
