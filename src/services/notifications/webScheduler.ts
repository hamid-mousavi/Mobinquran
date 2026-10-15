import { AlarmScheduler, AlarmItem, PermissionStatusResult } from './types';
import {
  requestAzanNotificationPermission,
  getNotificationPermissionStatus,
  syncPrayerAlarmsWithServiceWorker,
} from '../azanService';

export class WebAlarmScheduler implements AlarmScheduler {
  private inMemoryAlarms: AlarmItem[] = [];

  async checkPermissions(): Promise<PermissionStatusResult> {
    const status = getNotificationPermissionStatus();
    return {
      notifications: status === 'granted',
      exactAlarm: true, // وب آلارم سخت‌افزاری اختصاصی اندروید ندارد
    };
  }

  async requestPermissions(): Promise<boolean> {
    return requestAzanNotificationPermission();
  }

  async openExactAlarmSettings(): Promise<void> {
    // در وب تنظیمات exact alarm وجود ندارد
  }

  async cancelAllAlarms(): Promise<void> {
    this.inMemoryAlarms = [];
  }

  async scheduleAlarms(alarms: AlarmItem[]): Promise<void> {
    this.inMemoryAlarms = alarms;
    // همگام‌سازی با سرویس‌ورکر وب در صورت دسترسی
    await syncPrayerAlarmsWithServiceWorker().catch(() => {});
  }

  async getPendingAlarms(): Promise<AlarmItem[]> {
    const now = Date.now();
    return this.inMemoryAlarms.filter((a) => a.scheduleAt.getTime() > now);
  }
}

export const webScheduler = new WebAlarmScheduler();
