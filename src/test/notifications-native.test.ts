import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generate7DayPrayerAlarms,
  generateKhatmReminderAlarm,
  generateDailyWirdAlarm,
  calculateKhatmRemainingPagesToday,
} from '../services/notifications/pureAlarmGenerator';
import { DEFAULT_SETTINGS, AzanSettings } from '../services/azanService';
import { KhatmPlan } from '../types';
import { NativeAlarmScheduler } from '../services/notifications/nativeScheduler';
import { LocalNotifications } from '@capacitor/local-notifications';

// Mock Capacitor LocalNotifications
vi.mock('@capacitor/local-notifications', () => {
  return {
    LocalNotifications: {
      createChannel: vi.fn().mockResolvedValue(undefined),
      checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
      requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
      checkExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
      changeExactNotificationSetting: vi.fn().mockResolvedValue(undefined),
      getPending: vi.fn().mockResolvedValue({ notifications: [] }),
      cancel: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
    },
  };
});

describe('Phase 4-B — Android Native Alarm & Notification Scheduling', () => {
  const tehranCoords = {
    latitude: 35.6892,
    longitude: 51.389,
    timezone: 3.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pure Prayer Alarm Generator (7 Days Ahead)', () => {
    it('generates deterministic alarms for 7 days for enabled Shia prayers', () => {
      const now = new Date(Date.UTC(2026, 0, 15, 0, 0, 0)); // 00:00 UTC on Jan 15, 2026 (before Fajr)
      const settings: AzanSettings = {
        ...DEFAULT_SETTINGS,
        fajrAlert: true,
        dhuhrAlert: true,
        maghribAlert: true,
        preAlertMinutes: 0,
        selectedMuezzinId: 'moazenzadeh',
      };

      const alarms = generate7DayPrayerAlarms(tehranCoords, settings, now);

      // 7 days * 3 prayers = 21 alarms
      expect(alarms.length).toBe(21);

      // First day fajr id: 0 * 10 + 1 = 1
      const firstFajr = alarms.find((a) => a.id === 1);
      expect(firstFajr).toBeDefined();
      expect(firstFajr?.title).toContain('اذان صبح');
      expect(firstFajr?.channelId).toBe('azan_moazenzadeh');
      expect(firstFajr?.sound).toBe('azan_moazenzadeh.mp3');

      // Day 6 maghrib id: 6 * 10 + 3 = 63
      const lastMaghrib = alarms.find((a) => a.id === 63);
      expect(lastMaghrib).toBeDefined();
      expect(lastMaghrib?.title).toContain('اذان مغرب');
    });

    it('excludes disabled prayers from scheduling', () => {
      const now = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
      const settings: AzanSettings = {
        ...DEFAULT_SETTINGS,
        fajrAlert: true,
        dhuhrAlert: false, // Disabled
        maghribAlert: true,
        preAlertMinutes: 0,
      };

      const alarms = generate7DayPrayerAlarms(tehranCoords, settings, now);

      // Only fajr and maghrib = 2 * 7 = 14
      expect(alarms.length).toBe(14);
      expect(alarms.some((a) => a.title.includes('اذان ظهر'))).toBe(false);
    });

    it('generates pre-alert alarms with IDs offset by 100 when preAlertMinutes is configured', () => {
      const now = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
      const settings: AzanSettings = {
        ...DEFAULT_SETTINGS,
        fajrAlert: true,
        dhuhrAlert: true,
        maghribAlert: true,
        preAlertMinutes: 10,
      };

      const alarms = generate7DayPrayerAlarms(tehranCoords, settings, now);

      // 21 azan + 21 pre-alerts = 42
      expect(alarms.length).toBe(42);

      const preFajrDay0 = alarms.find((a) => a.id === 101);
      expect(preFajrDay0).toBeDefined();
      expect(preFajrDay0?.type).toBe('pre_alert');
      expect(preFajrDay0?.channelId).toBe('azan_pre_alerts');
      expect(preFajrDay0?.title).toContain('۱۰ دقیقه مانده');
    });
  });

  describe('Khatm Reminder Alarm Logic', () => {
    it('calculates unread pages and builds reminder alarm when quota remains', () => {
      const now = new Date(2026, 8, 15, 12, 0, 0); // Noon
      const mockPlan: KhatmPlan = {
        id: 'plan_1',
        title: 'ختم رمضان',
        type: 'ramadan_30',
        startDate: '2026-09-10T00:00:00.000Z',
        targetDays: 30,
        totalPages: 604,
        completedPages: [1, 2, 3], // Only 3 pages completed
        currentDay: 6,
        isActive: true,
      };

      const status = calculateKhatmRemainingPagesToday(mockPlan, [], [], now);
      expect(status.isCompleted).toBe(false);
      expect(status.remainingPages).toBeGreaterThan(0);

      const alarm = generateKhatmReminderAlarm(
        mockPlan,
        { enabled: true, hour: 18, minute: 30 },
        [],
        [],
        now
      );

      expect(alarm).not.toBeNull();
      expect(alarm?.id).toBe(900);
      expect(alarm?.channelId).toBe('khatm_reminders');
      expect(alarm?.body).toContain('صفحه تا تکمیل هدف امروز');
    });

    it('cancels reminder for today when today quota is already completed', () => {
      const now = new Date(2026, 8, 15, 12, 0, 0);
      // Simulate completed all pages 1 to 604
      const allPages = Array.from({ length: 604 }, (_, i) => i + 1);
      const mockPlan: KhatmPlan = {
        id: 'plan_1',
        title: 'ختم رمضان',
        type: 'ramadan_30',
        startDate: '2026-09-10T00:00:00.000Z',
        targetDays: 30,
        totalPages: 604,
        completedPages: allPages,
        currentDay: 6,
        isActive: true,
      };

      const status = calculateKhatmRemainingPagesToday(mockPlan, [], [], now);
      expect(status.isCompleted).toBe(true);
      expect(status.remainingPages).toBe(0);

      const alarm = generateKhatmReminderAlarm(
        mockPlan,
        { enabled: true, hour: 18, minute: 30 },
        [],
        [],
        now
      );

      // Reminder should be cancelled (null)
      expect(alarm).toBeNull();
    });
  });

  describe('Daily Wird Reminder Logic', () => {
    it('schedules daily wird when enabled', () => {
      const now = new Date(2026, 0, 15, 6, 0, 0); // 6:00 AM
      const alarm = generateDailyWirdAlarm(
        { enabled: true, hour: 8, minute: 0, text: 'یا ارحم الراحمین' },
        now
      );

      expect(alarm).not.toBeNull();
      expect(alarm?.id).toBe(950);
      expect(alarm?.body).toBe('یا ارحم الراحمین');
      expect(alarm?.scheduleAt.getHours()).toBe(8);
    });

    it('returns null when daily wird is disabled', () => {
      const now = new Date(2026, 0, 15, 6, 0, 0);
      const alarm = generateDailyWirdAlarm(
        { enabled: false, hour: 8, minute: 0, text: '' },
        now
      );

      expect(alarm).toBeNull();
    });
  });

  describe('NativeAlarmScheduler', () => {
    it('creates notification channels, cancels old alarms, and schedules with allowWhileIdle', async () => {
      const scheduler = new NativeAlarmScheduler();
      const future = new Date(Date.now() + 100000);

      await scheduler.scheduleAlarms([
        {
          id: 1,
          title: 'اذان صبح',
          body: 'وقت نماز',
          scheduleAt: future,
          channelId: 'azan_moazenzadeh',
          sound: 'azan_moazenzadeh.mp3',
          type: 'azan',
        },
      ]);

      expect(LocalNotifications.createChannel).toHaveBeenCalled();
      expect(LocalNotifications.getPending).toHaveBeenCalled();
      expect(LocalNotifications.schedule).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              schedule: {
                at: future,
                allowWhileIdle: true,
              },
            }),
          ]),
        })
      );
    });
  });
});
