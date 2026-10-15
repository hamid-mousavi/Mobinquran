import { AzanSettings } from '../azanService';

export type AlarmType = 'azan' | 'pre_alert' | 'khatm' | 'daily_wird' | 'test';

export interface AlarmItem {
  id: number;
  title: string;
  body: string;
  scheduleAt: Date;
  channelId?: string;
  sound?: string;
  type: AlarmType;
  extra?: Record<string, any>;
}

export interface KhatmReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface DailyWirdSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  text: string;
}

export interface UnifiedNotificationSettings {
  azan: AzanSettings;
  khatmReminder: KhatmReminderSettings;
  dailyWird: DailyWirdSettings;
  version: number;
}

export interface PermissionStatusResult {
  notifications: boolean;
  exactAlarm: boolean;
}

export interface AlarmScheduler {
  scheduleAlarms(alarms: AlarmItem[]): Promise<void>;
  cancelAllAlarms(): Promise<void>;
  getPendingAlarms(): Promise<AlarmItem[]>;
  checkPermissions(): Promise<PermissionStatusResult>;
  requestPermissions(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
}
