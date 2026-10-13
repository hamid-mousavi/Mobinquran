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

  it('provides default Shia Azan settings with in-app sound enabled', () => {
    const defaultSettings = getAzanSettings();
    expect(defaultSettings.selectedMuezzinId).toBe('moazenzadeh');
    expect(defaultSettings.selectedPreDuaId).toBe('salawat_reza');
    expect(defaultSettings.inAppSoundEnabled).toBe(true);
    expect(defaultSettings.playPreAzanDua).toBe(true);
  });
});
