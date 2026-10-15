import { LocalNotifications } from '@capacitor/local-notifications';
import { AlarmScheduler, AlarmItem, AlarmType, PermissionStatusResult } from './types';
import { MUEZZINS_LIST, playActualAzan } from '../azanService';

let isListenersAttached = false;

export class NativeAlarmScheduler implements AlarmScheduler {
  private async ensureChannelsCreated(): Promise<void> {
    try {
      // کانال اختصاصی برای هر مؤذن با صدای ویژه در پوشه raw اندروید
      for (const m of MUEZZINS_LIST) {
        await LocalNotifications.createChannel({
          id: `azan_${m.id}`,
          name: `اذان - ${m.name}`,
          description: `پخش اذان شرعی با نوای ${m.name}`,
          importance: 5, // High importance (heads-up notification)
          visibility: 1, // Public on lockscreen
          vibration: true,
          sound: `azan_${m.id}.mp3`,
        });
      }

      // کانال پیش‌هشدار اذان
      await LocalNotifications.createChannel({
        id: 'azan_pre_alerts',
        name: 'هشدارهای پیش از اذان',
        description: 'اعلان چند دقیقه قبل از ورود وقت نماز برای آمادگی',
        importance: 4,
        visibility: 1,
        vibration: true,
      });

      // کانال یادآور ختم قرآن
      await LocalNotifications.createChannel({
        id: 'khatm_reminders',
        name: 'یادآور برنامه ختم قرآن',
        description: 'اعلان سهمیه صفحات باقی‌مانده روزانه ختم',
        importance: 4,
        visibility: 1,
        vibration: true,
      });

      // کانال ورد روزانه
      await LocalNotifications.createChannel({
        id: 'daily_wird',
        name: 'ورد و تعقیبات روزانه',
        description: 'یادآور اذکار و آیات منتخب روزانه',
        importance: 3,
        visibility: 1,
        vibration: false,
      });
    } catch (e) {
      console.warn('[NativeScheduler] createChannel error:', e);
    }
  }

  public initListeners(): void {
    if (isListenersAttached) return;
    isListenersAttached = true;

    try {
      // رویداد لمس اعلان توسط کاربر
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const extra = action.notification.extra;
        if (extra && extra.prayerName) {
          playActualAzan({
            prayerName: extra.prayerName,
            muezzinId: extra.muezzinId,
          });

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('mobin-azan-alert', {
                detail: {
                  prayerName: extra.prayerName,
                  muezzinName: extra.muezzinName || 'قرآن مبین',
                  timestamp: new Date().toISOString(),
                },
              })
            );
          }
        }
      });

      // رویداد دریافت اعلان در پیش‌زمینه (Foreground)
      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        const extra = notification.extra;
        if (extra && extra.prayerName && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('mobin-azan-alert', {
              detail: {
                prayerName: extra.prayerName,
                muezzinName: extra.muezzinName || 'قرآن مبین',
                timestamp: new Date().toISOString(),
              },
            })
          );
        }
      });
    } catch (e) {
      console.warn('[NativeScheduler] Failed to attach listeners:', e);
    }
  }

  async checkPermissions(): Promise<PermissionStatusResult> {
    let notifications = false;
    let exactAlarm = true;

    try {
      const perm = await LocalNotifications.checkPermissions();
      notifications = perm.display === 'granted';
    } catch {}

    try {
      const exact = await LocalNotifications.checkExactNotificationSetting();
      exactAlarm = exact.exact_alarm === 'granted';
    } catch {}

    return { notifications, exactAlarm };
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch {
      return false;
    }
  }

  async openExactAlarmSettings(): Promise<void> {
    try {
      await LocalNotifications.changeExactNotificationSetting();
    } catch (e) {
      console.warn('[NativeScheduler] Failed to open exact alarm settings:', e);
    }
  }

  async cancelAllAlarms(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
    } catch (e) {
      console.warn('[NativeScheduler] cancelAllAlarms error:', e);
    }
  }

  async scheduleAlarms(alarms: AlarmItem[]): Promise<void> {
    if (!alarms || alarms.length === 0) return;

    await this.ensureChannelsCreated();
    this.initListeners();

    // ابتدا آلارم‌های قبلی را لغو می‌کنیم تا باززمان‌بندی تداخل نداشته باشد
    await this.cancelAllAlarms();

    const notificationsToSchedule = alarms
      .filter((a) => a.scheduleAt.getTime() > Date.now())
      .map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        schedule: {
          at: a.scheduleAt,
          allowWhileIdle: true,
        },
        channelId: a.channelId,
        sound: a.sound,
        extra: a.extra,
      }));

    if (notificationsToSchedule.length === 0) return;

    try {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
    } catch (e) {
      console.error('[NativeScheduler] scheduleAlarms failed:', e);
    }
  }

  async getPendingAlarms(): Promise<AlarmItem[]> {
    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications.map((n) => {
        const ext = n as typeof n & { channelId?: string; sound?: string };
        const rawType: AlarmType = (n.extra?.type as AlarmType) || 'azan';
        return {
          id: n.id,
          title: n.title || '',
          body: n.body || '',
          scheduleAt: n.schedule?.at ? new Date(n.schedule.at) : new Date(),
          channelId: ext.channelId,
          sound: ext.sound,
          type: rawType,
          extra: n.extra,
        };
      });
    } catch {
      return [];
    }
  }
}

export const nativeScheduler = new NativeAlarmScheduler();
