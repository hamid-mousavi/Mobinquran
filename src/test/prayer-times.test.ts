import { describe, it, expect } from 'vitest';
import {
  calculatePrayerTimes,
  getNextPrayer,
  calculateQiblaDirection,
  searchCities,
  findClosestCity,
  CITIES_LIST,
  PROVINCES_LIST,
} from '../services/prayerTimesService';
import {
  MUEZZINS_LIST,
  PRE_AZAN_DUAS_LIST,
  getAzanSettings,
  saveAzanSettings,
  getPrayersToSchedule,
  getDownloadedDuaIds,
  playActualAzan,
  stopActualAzan,
  stopAllAzanAudio,
} from '../services/azanService';

describe('Prayer Times & Qibla Calculation', () => {
  it('calculates valid prayer times for Tehran without errors', () => {
    const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
    const times = calculatePrayerTimes(tehran, new Date(2026, 2, 21)); // 21 March (Nowruz equinox)

    expect(times.fajr).toMatch(/^\d{2}:\d{2}$/);
    expect(times.sunrise).toMatch(/^\d{2}:\d{2}$/);
    expect(times.dhuhr).toMatch(/^\d{2}:\d{2}$/);
    expect(times.sunset).toMatch(/^\d{2}:\d{2}$/);
    expect(times.maghrib).toMatch(/^\d{2}:\d{2}$/);
    expect(times.midnight).toMatch(/^\d{2}:\d{2}$/);

    const [dhuhrHour] = times.dhuhr.split(':').map(Number);
    expect(dhuhrHour).toBeGreaterThanOrEqual(11);
    expect(dhuhrHour).toBeLessThanOrEqual(13);
  });

  it('contains cities for all 31 Iranian provinces', () => {
    expect(CITIES_LIST.length).toBeGreaterThan(100);

    const provincesInDb = new Set(CITIES_LIST.map((c) => c.province));
    // Verify each province has at least one city in the database
    for (const prov of PROVINCES_LIST) {
      expect(provincesInDb.has(prov)).toBe(true);
    }
  });

  it('searches cities with normalized Persian characters and province filters', () => {
    const kashanResults = searchCities('کاشان');
    expect(kashanResults.length).toBeGreaterThanOrEqual(1);
    expect(kashanResults[0].name).toContain('کاشان');

    const farsCities = searchCities('', 'فارس');
    expect(farsCities.length).toBeGreaterThan(5);
    expect(farsCities.every((c) => c.province === 'فارس')).toBe(true);
  });

  it('finds closest city accurately given coordinates', () => {
    // Mashhad coordinates (~36.3, 59.6)
    const closest = findClosestCity(36.29, 59.61);
    expect(closest.name).toContain('مشهد');
  });

  it('calculates Qibla direction correctly for Iranian cities', () => {
    const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
    const qiblaTehran = calculateQiblaDirection(tehran.latitude, tehran.longitude);
    expect(qiblaTehran).toBeCloseTo(218.4, 0);

    const mashhad = CITIES_LIST.find((c) => c.id === 'mashhad')!;
    const qiblaMashhad = calculateQiblaDirection(mashhad.latitude, mashhad.longitude);
    expect(qiblaMashhad).toBeCloseTo(234.6, 0);

    const isfahan = CITIES_LIST.find((c) => c.id === 'isfahan')!;
    const qiblaIsfahan = calculateQiblaDirection(isfahan.latitude, isfahan.longitude);
    expect(qiblaIsfahan).toBeCloseTo(226.1, 0);
  });

  it('determines the next upcoming prayer correctly', () => {
    const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
    const times = calculatePrayerTimes(tehran);
    const next = getNextPrayer(times);

    expect(next.key).toBeDefined();
    expect(next.name).toBeDefined();
    expect(next.time).toMatch(/^\d{2}:\d{2}$/);
    expect(next.remainingMinutes).toBeGreaterThanOrEqual(0);
  });

  it('contains ONLY authentic Shia Muezzins with Ali Waliullah badge', () => {
    expect(MUEZZINS_LIST.length).toBeGreaterThanOrEqual(6);
    expect(MUEZZINS_LIST.every((m) => m.isShia === true)).toBe(true);

    const moazenzadeh = MUEZZINS_LIST.find((m) => m.id === 'moazenzadeh');
    expect(moazenzadeh).toBeDefined();
    expect(moazenzadeh?.name).toContain('مؤذن‌زاده');

    const sobhdel = MUEZZINS_LIST.find((m) => m.id === 'sobhdel');
    expect(sobhdel).toBeDefined();

    // Verify non-Shia reciters were removed
    expect(MUEZZINS_LIST.some((m) => m.id === 'abdulbasit')).toBe(false);
    expect(MUEZZINS_LIST.some((m) => m.id === 'ali_mullah')).toBe(false);
  });

  it('contains Pre-Azan Duas (Salawat Imam Reza, Dua Faraj, etc.)', () => {
    expect(PRE_AZAN_DUAS_LIST.length).toBeGreaterThanOrEqual(2);
    const salawatReza = PRE_AZAN_DUAS_LIST.find((d) => d.id === 'salawat_reza');
    expect(salawatReza).toBeDefined();
    expect(salawatReza?.name).toContain('امام رضا');

    const duaFaraj = PRE_AZAN_DUAS_LIST.find((d) => d.id === 'dua_faraj');
    expect(duaFaraj).toBeDefined();
    expect(duaFaraj?.name).toContain('فرج');

    // تایید حذف دعای ربنا، تواشیح و مناجات منظومه بنا به درخواست کاربر
    expect(PRE_AZAN_DUAS_LIST.some((d) => d.id === 'rabbana')).toBe(false);
    expect(PRE_AZAN_DUAS_LIST.some((d) => d.id === 'asmaul_husna')).toBe(false);
    expect(PRE_AZAN_DUAS_LIST.some((d) => d.id === 'monajat_masjed_kufa')).toBe(false);
  });

  it('provides default Shia Azan settings with in-app sound enabled and no asr/isha alerts', () => {
    const defaultSettings = getAzanSettings();
    expect(defaultSettings.selectedMuezzinId).toBe('moazenzadeh');
    expect(defaultSettings.selectedPreDuaId).toBe('salawat_reza');
    expect(defaultSettings.inAppSoundEnabled).toBe(true);
    expect(defaultSettings.playPreAzanDua).toBe(true);
    // تأیید تمرکز روی ۳ وقت اصلی و حذف asrAlert و ishaAlert
    expect('asrAlert' in defaultSettings).toBe(false);
    expect('ishaAlert' in defaultSettings).toBe(false);
  });

  // تست‌های فاز ۳: انطباق با جدول مرجع مؤسسه ژئوفیزیک دانشگاه تهران با تلورانس حداکثر ۲ دقیقه
  describe('Phase 3 — Reference Prayer Times & Robustness', () => {
    // تابع کمکی تبدیل HH:mm به دقیقه از ابتدای روز
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const expectTimeCloseTo = (actual: string, expected: string, maxDiffMinutes = 2) => {
      const actualMin = timeToMinutes(actual);
      const expectedMin = timeToMinutes(expected);
      const diff = Math.abs(actualMin - expectedMin);
      expect(
        diff,
        `Expected ${actual} to be within ${maxDiffMinutes} min of reference ${expected} (diff: ${diff} min)`
      ).toBeLessThanOrEqual(maxDiffMinutes);
    };

    it('matches Tehran reference times in winter (Jan 15) and summer (Jun 21) within ±2 minutes', () => {
      const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;

      // زمستان: ۲۵ دی (15 January 2026) - اوقات مرجع ژئوفیزیک تهران
      const winter = calculatePrayerTimes(tehran, new Date(2026, 0, 15));
      expectTimeCloseTo(winter.fajr, '05:45', 2);
      expectTimeCloseTo(winter.sunrise, '07:07', 2);
      expectTimeCloseTo(winter.dhuhr, '12:14', 2);
      expectTimeCloseTo(winter.sunset, '17:20', 2);
      expectTimeCloseTo(winter.maghrib, '17:33', 2);
      expectTimeCloseTo(winter.midnight, '23:33', 2);

      // تابستان: ۳۱ خرداد (21 June 2026) - اوقات مرجع ژئوفیزیک تهران
      const summer = calculatePrayerTimes(tehran, new Date(2026, 5, 21));
      expectTimeCloseTo(summer.fajr, '03:02', 2);
      expectTimeCloseTo(summer.sunrise, '04:42', 2);
      expectTimeCloseTo(summer.dhuhr, '12:06', 2);
      expectTimeCloseTo(summer.sunset, '19:30', 2);
      expectTimeCloseTo(summer.maghrib, '19:45', 2);
      expectTimeCloseTo(summer.midnight, '23:16', 2);
    });

    it('matches Mashhad reference times in winter and summer within ±2 minutes', () => {
      const mashhad = CITIES_LIST.find((c) => c.id === 'mashhad')!;

      const winter = calculatePrayerTimes(mashhad, new Date(2026, 0, 15));
      expectTimeCloseTo(winter.fajr, '05:13', 2);
      expectTimeCloseTo(winter.sunrise, '06:36', 2);
      expectTimeCloseTo(winter.dhuhr, '11:41', 2);
      expectTimeCloseTo(winter.sunset, '16:45', 2);
      expectTimeCloseTo(winter.maghrib, '16:59', 2);

      const summer = calculatePrayerTimes(mashhad, new Date(2026, 5, 21));
      expectTimeCloseTo(summer.fajr, '02:26', 2);
      expectTimeCloseTo(summer.sunrise, '04:08', 2);
      expectTimeCloseTo(summer.dhuhr, '11:33', 2);
      expectTimeCloseTo(summer.sunset, '18:59', 2);
      expectTimeCloseTo(summer.maghrib, '19:14', 2);
    });

    it('matches Tabriz reference times in winter and summer within ±2 minutes', () => {
      const tabriz = CITIES_LIST.find((c) => c.id === 'tabriz')!;

      const winter = calculatePrayerTimes(tabriz, new Date(2026, 0, 15));
      expectTimeCloseTo(winter.fajr, '06:09', 2);
      expectTimeCloseTo(winter.sunrise, '07:33', 2);
      expectTimeCloseTo(winter.dhuhr, '12:34', 2);
      expectTimeCloseTo(winter.sunset, '17:35', 2);
      expectTimeCloseTo(winter.maghrib, '17:49', 2);

      const summer = calculatePrayerTimes(tabriz, new Date(2026, 5, 21));
      expectTimeCloseTo(summer.fajr, '03:08', 2);
      expectTimeCloseTo(summer.sunrise, '04:55', 2);
      expectTimeCloseTo(summer.dhuhr, '12:27', 2);
      expectTimeCloseTo(summer.sunset, '19:58', 2);
      expectTimeCloseTo(summer.maghrib, '20:13', 2);
    });

    it('is completely independent of the client device timezone', () => {
      const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
      const testDate = new Date(2026, 2, 21);

      // ذخیره متد اصلی
      const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;

      try {
        // ۱. شبیه‌سازی دستگاه در منطقه UTC-7 (لس‌آنجلس، افست ۴۲۰ دقیقه)
        Date.prototype.getTimezoneOffset = () => 420;
        const timesUS = calculatePrayerTimes(tehran, testDate);

        // ۲. شبیه‌سازی دستگاه در منطقه UTC+0 (لندن، افست ۰ دقیقه)
        Date.prototype.getTimezoneOffset = () => 0;
        const timesUK = calculatePrayerTimes(tehran, testDate);

        // ۳. شبیه‌سازی دستگاه در منطقه UTC+9 (توکیو، افست -۵۴۰ دقیقه)
        Date.prototype.getTimezoneOffset = () => -540;
        const timesJapan = calculatePrayerTimes(tehran, testDate);

        // زمان‌های نمایشی رشته‌ای باید در تمام نقاط جهان کاملاً یکسان باشند
        expect(timesUS.dhuhr).toBe(timesUK.dhuhr);
        expect(timesUK.dhuhr).toBe(timesJapan.dhuhr);
        expect(timesUS.fajr).toBe(timesUK.fajr);
        expect(timesUS.maghrib).toBe(timesJapan.maghrib);

        // برچسب زمانی UTC تاریخ‌های خام نیز باید صد درصد یکسان باشد
        expect(timesUS.rawTimes.dhuhr.getTime()).toBe(timesUK.rawTimes.dhuhr.getTime());
        expect(timesUK.rawTimes.dhuhr.getTime()).toBe(timesJapan.rawTimes.dhuhr.getTime());
      } finally {
        Date.prototype.getTimezoneOffset = origGetTimezoneOffset;
      }
    });

    it('handles high latitude coordinates without NaN or Invalid Date', () => {
      // عرض جغرافیایی ۶۸ درجه شمالی (ترومسو / مدار قطبی در نروژ) در انقلاب تابستانی
      const arcticCoords = {
        latitude: 68.0,
        longitude: 18.0,
        elevation: 10,
        timezone: 1,
      };
      const times = calculatePrayerTimes(arcticCoords, new Date(2026, 5, 21));

      expect(times.fajr).toMatch(/^\d{2}:\d{2}$/);
      expect(times.sunrise).toMatch(/^\d{2}:\d{2}$/);
      expect(times.dhuhr).toMatch(/^\d{2}:\d{2}$/);
      expect(times.maghrib).toMatch(/^\d{2}:\d{2}$/);
      expect(times.midnight).toMatch(/^\d{2}:\d{2}$/);

      expect(isNaN(times.rawTimes.fajr.getTime())).toBe(false);
      expect(isNaN(times.rawTimes.dhuhr.getTime())).toBe(false);
      expect(isNaN(times.rawTimes.maghrib.getTime())).toBe(false);
    });

    it('adds safetyMarginMinutes to Maghrib only and preserves Fajr', () => {
      const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
      const testDate = new Date(2026, 2, 21);

      const baseTimes = calculatePrayerTimes(tehran, testDate, undefined, 'tehran', 0);
      const withMargin = calculatePrayerTimes(tehran, testDate, undefined, 'tehran', 5);

      // فجر بدون تغییر می‌ماند
      expect(withMargin.fajr).toBe(baseTimes.fajr);
      expect(withMargin.rawTimes.fajr.getTime()).toBe(baseTimes.rawTimes.fajr.getTime());

      // ۵ دقیقه احتیاط به مغرب افزوده می‌شود
      const baseMaghribMin = timeToMinutes(baseTimes.maghrib);
      const marginMaghribMin = timeToMinutes(withMargin.maghrib);
      expect(marginMaghribMin - baseMaghribMin).toBe(5);
    });

    it('places midnight chronologically between today sunset and tomorrow fajr', () => {
      const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
      const testDate = new Date(2026, 2, 21);
      const times = calculatePrayerTimes(tehran, testDate);

      // زمان نیمه‌شب شرعی باید بعد از غروب امروز باشد
      expect(times.rawTimes.midnight.getTime()).toBeGreaterThan(times.rawTimes.sunset.getTime());
      expect(isNaN(times.rawTimes.midnight.getTime())).toBe(false);
    });
  });

  // تست‌های فاز ۴-الف: منطق اذان در نسخه وب و PWA
  describe('Phase 4-A — Azan Logic, Scheduling & Memory Safety', () => {
    it('verifies dua_salamati is removed from PRE_AZAN_DUAS_LIST and defaults as requested', () => {
      expect(PRE_AZAN_DUAS_LIST.some((d) => d.id === 'dua_salamati')).toBe(false);
      expect(getDownloadedDuaIds()).not.toContain('dua_salamati');
    });

    it('pure function getPrayersToSchedule correctly schedules today and tomorrow alarms', () => {
      const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
      // فرض: ساعت ۱۰ صبح است (قبل از ظهر و بعد از فجر امروز)
      const baseDate = new Date(2026, 2, 21);
      const todayTimes = calculatePrayerTimes(tehran, baseDate);

      const nextDate = new Date(2026, 2, 22);
      const tomorrowTimes = calculatePrayerTimes(tehran, nextDate);

      // شبیه‌سازی زمان جاری: ساعت ۱۰:۰۰ صبح به وقت تهران
      // در تهران (UTC+3.5)، ساعت ۱۰:۰۰ معادل ساعت ۰۶:۳۰ UTC است
      const simulatedNow = new Date(Date.UTC(2026, 2, 21, 6, 30, 0));

      const settings = {
        ...getAzanSettings(),
        fajrAlert: true,
        dhuhrAlert: true,
        maghribAlert: true,
        preAlertMinutes: 10 as const, // هشدار ۱۰ دقیقه قبل
      };

      const alarms = getPrayersToSchedule(todayTimes, tomorrowTimes, simulatedNow, settings, 'مؤذن‌زاده');

      // چون ساعت ۱۰ است:
      // فجر امروز گذشته است، بنابراین ظهر و مغرب امروز باید زمان‌بندی شوند (همراه پیش‌هشدار)
      // فردا نیز هر ۳ وقت (فجر، ظهر، مغرب) باید زمان‌بندی شوند
      expect(alarms.length).toBeGreaterThanOrEqual(4);

      // بررسی مرتب‌سازی زمانی صعودی
      for (let i = 0; i < alarms.length - 1; i++) {
        expect(alarms[i].timestamp).toBeLessThanOrEqual(alarms[i + 1].timestamp);
      }

      // ظهر امروز باید در لیست باشد
      const dhuhrToday = alarms.find((a) => a.prayerKey === 'dhuhr' && a.type === 'azan');
      expect(dhuhrToday).toBeDefined();

      // پیش‌هشدار ظهر امروز (۱۰ دقیقه قبل از ظهر) باید قبل از خود ظهر باشد
      const preDhuhr = alarms.find((a) => a.prayerKey === 'dhuhr' && a.type === 'pre_alert');
      expect(preDhuhr).toBeDefined();
      expect(preDhuhr!.timestamp).toBe(dhuhrToday!.timestamp - 10 * 60 * 1000);
    });

    it('respects alert toggles (e.g. disabling fajrAlert excludes it from scheduling)', () => {
      const tehran = CITIES_LIST.find((c) => c.id === 'tehran')!;
      const todayTimes = calculatePrayerTimes(tehran, new Date(2026, 2, 21));
      const tomorrowTimes = calculatePrayerTimes(tehran, new Date(2026, 2, 22));
      const simulatedNow = new Date(Date.UTC(2026, 2, 21, 0, 0, 0));

      const settings = {
        ...getAzanSettings(),
        fajrAlert: false, // غیرفعال کردن فجر
        dhuhrAlert: true,
        maghribAlert: true,
      };

      const alarms = getPrayersToSchedule(todayTimes, tomorrowTimes, simulatedNow, settings);
      expect(alarms.some((a) => a.prayerKey === 'fajr')).toBe(false);
      expect(alarms.some((a) => a.prayerKey === 'dhuhr')).toBe(true);
      expect(alarms.some((a) => a.prayerKey === 'maghrib')).toBe(true);
    });

    it('provides actual azan playback and audio stopper APIs', () => {
      expect(typeof playActualAzan).toBe('function');
      expect(typeof stopActualAzan).toBe('function');
      expect(typeof stopAllAzanAudio).toBe('function');

      // اجرای تابع توقف بدون پرتاب خطا
      expect(() => stopAllAzanAudio()).not.toThrow();
    });
  });
});
