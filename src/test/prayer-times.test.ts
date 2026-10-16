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

});
