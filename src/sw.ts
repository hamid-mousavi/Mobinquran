/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { RangeRequestsPlugin } from 'workbox-range-requests';

declare let self: ServiceWorkerGlobalScope & typeof globalThis;

// فعال‌سازی خودکار و بی‌درنگ نسخه جدید بدون نیاز به تایید دستی کاربر
self.skipWaiting();
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// منیفست precache (تزریق‌شده توسط vite-plugin-pwa / injectManifest)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ناوبری (SPA fallback) — معادل navigateFallback generateSW
const navigationRoute = new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api/],
});
registerRoute(navigationRoute);

// /api → NetworkOnly (سرور بک‌اند؛ هرگز کش نمی‌شود)
registerRoute(/^\/api\/.*/i, new NetworkOnly());

// فونت‌های خودمیزبان → CacheFirst 365 روز
registerRoute(
  /\/fonts\/.*\.woff2$/i,
  new CacheFirst({
    cacheName: 'quran-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// دادهٔ هستهٔ قرآن → CacheFirst (دائمی)
registerRoute(
  /\/data\/.*\.json$/i,
  new CacheFirst({
    cacheName: 'quran-core-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// تصاویر → CacheFirst
registerRoute(
  /\.(?:png|jpg|jpeg|svg|ico)$/i,
  new CacheFirst({
    cacheName: 'quran-images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

/**
 * صوت ترتیل (P5-T2) — معماری ADR-8:
 * باینری mp3 در Cache Storage نگهداری می‌شود و این Route نقش Range را برای Safari
 * با RangeRequestsPlugin مدیریت می‌کند (Safari بدون پاسخ 206 نمی‌تواند seek/پخش کند).
 * Hostهای مجاز برای کش: everyayah.com (ACAO *)، آینهٔ Maqra روی Hugging Face و CDN Islamic Network.
 */
const audioHostPattern =
  /^(https:\/\/everyayah\.com\/data\/|https:\/\/huggingface\.co\/datasets\/maqra-project\/|https:\/\/cdn\.islamic\.network\/quran\/audio\/)/i;
registerRoute(
  ({ url }) => audioHostPattern.test(url.href) && url.pathname.endsWith('.mp3'),
  new CacheFirst({
    cacheName: 'quran-audio-v1',
    plugins: [new RangeRequestsPlugin()],
  })
);

// حافظه هشدارهای زمان‌بندی‌شده اذان در ورکر
let scheduledPrayerAlarms: Array<{ prayerKey: string; prayerName: string; timestamp: number; fired?: boolean; muezzinName?: string }> = [];
let alarmTimeouts: any[] = [];

function triggerPrayerNotification(alarm: { prayerKey: string; prayerName: string }, muezzinName?: string) {
  const title = `هنگام ${alarm.prayerName} - قرآن مبین`;
  const options: any = {
    body: `نوای ملکوتی اذان شیعه با صدای ${muezzinName || 'مؤذن منتخب'} - برای پخش کامل اذان لمس کنید`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [600, 250, 600, 250, 1200, 300, 1200],
    tag: `mobin-azan-${alarm.prayerKey}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      prayerKey: alarm.prayerKey,
      prayerName: alarm.prayerName,
      muezzinName: muezzinName,
      url: `/?action=azan&prayer=${alarm.prayerKey}`,
    },
  };

  self.registration.showNotification(title, options).catch((err) => {
    console.warn('[SW] showNotification error:', err);
  });
}

function checkAndTriggerDuePrayers() {
  const now = Date.now();
  scheduledPrayerAlarms.forEach((alarm) => {
    const diff = now - alarm.timestamp;
    // بازه ۱۵ دقیقه‌ای پس از وقت
    if (diff >= 0 && diff < 15 * 60 * 1000 && !alarm.fired) {
      alarm.fired = true;
      triggerPrayerNotification(alarm, alarm.muezzinName);
    }
  });
  return Promise.resolve();
}

function setupAlarmsInServiceWorker(
  alarms: Array<{ prayerKey: string; prayerName: string; timestamp: number }>,
  muezzinName?: string
) {
  alarmTimeouts.forEach((t) => clearTimeout(t));
  alarmTimeouts = [];

  const now = Date.now();

  alarms.forEach((alarm) => {
    const fireTime = alarm.timestamp;
    const diff = fireTime - now;

    // ۱. سیستم TimestampTrigger در کروم اندروید برای بیدار کردن آفلاین سیستم در زمان دقیق
    if (
      typeof Notification !== 'undefined' &&
      'showTrigger' in (Notification as any).prototype &&
      typeof (self as any).TimestampTrigger !== 'undefined'
    ) {
      if (diff > 0) {
        try {
          self.registration
            .showNotification(`هنگام ${alarm.prayerName} - قرآن مبین`, {
              body: `نوای ملکوتی اذان شیعه با صدای ${muezzinName || 'مؤذن منتخب'} - برای پخش کامل اذان لمس کنید`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              vibrate: [600, 250, 600, 250, 1200, 300, 1200],
              tag: `mobin-azan-${alarm.prayerKey}`,
              renotify: true,
              requireInteraction: true,
              silent: false,
              showTrigger: new (self as any).TimestampTrigger(fireTime),
              data: {
                prayerKey: alarm.prayerKey,
                prayerName: alarm.prayerName,
                muezzinName: muezzinName,
                url: `/?action=azan&prayer=${alarm.prayerKey}`,
              },
            } as any)
            .catch(() => {});
        } catch {}
      }
    }

    // ۲. تایمر داخلی ورکر برای دستگاه‌های فعال
    if (diff > 0 && diff < 24 * 3600 * 1000) {
      const tid = setTimeout(() => {
        triggerPrayerNotification(alarm, muezzinName);
      }, diff);
      alarmTimeouts.push(tid);
    }
  });
}

// گوش فرادادن به پیام‌های برنامه اصلی (زمان‌بندی هشدارهای اذان)
self.addEventListener('message', (event: any) => {
  if (event.data?.type === 'SCHEDULE_PRAYER_ALARMS') {
    const { alarms, muezzinName } = event.data.payload || {};
    if (Array.isArray(alarms)) {
      scheduledPrayerAlarms = alarms.map((a: any) => ({ ...a, muezzinName }));
      setupAlarmsInServiceWorker(alarms, muezzinName);
    }
  } else if (event.data?.type === 'CHECK_AZAN_NOW') {
    checkAndTriggerDuePrayers();
  }
});

// رویدادهای پس‌زمینه برای همگام‌سازی و بیداری دوره‌ای
self.addEventListener('periodicsync' as any, (event: any) => {
  if (event.tag === 'azan-check') {
    event.waitUntil(checkAndTriggerDuePrayers());
  }
});

self.addEventListener('sync' as any, (event: any) => {
  if (event.tag === 'azan-sync') {
    event.waitUntil(checkAndTriggerDuePrayers());
  }
});

// مدیریت کلیک روی اعلان اذان و اوقات شرعی برای باز کردن و پخش مستقیم در برنامه
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const data = event.notification.data || {};
  const prayerKey = data.prayerKey || 'prayer';
  const targetUrl = data.url || `/?action=azan&prayer=${prayerKey}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: any) => {
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            client.postMessage({
              type: 'PLAY_AZAN_FROM_NOTIFICATION',
              prayerKey: data.prayerKey,
              prayerName: data.prayerName,
              muezzinName: data.muezzinName,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

export {};