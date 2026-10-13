/// <reference lib="webworker" />

const CACHE_NAME = 'quran-mobin-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/quran-logo.png',
  '/quran-logo-clean.png',
  '/quran-logo-cropped.png'
];

// حافظه هشدارهای زمان‌بندی‌شده اذان در ورکر
let scheduledPrayerAlarms = [];
let alarmTimeouts = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// مدیریت کلیک روی اعلان اذان (باز کردن مستقیم برنامه و پخش اذان)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const prayerKey = data.prayerKey || 'prayer';
  const targetUrl = data.url || `/?action=azan&prayer=${prayerKey}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'PLAY_AZAN_FROM_NOTIFICATION',
            prayerKey: prayerKey,
            prayerName: data.prayerName,
            muezzinName: data.muezzinName
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

// گوش فرادادن به پیام‌های برنامه اصلی (زمان‌بندی هشدارهای اذان)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_PRAYER_ALARMS') {
    const { alarms, muezzinName } = event.data.payload || {};
    if (Array.isArray(alarms)) {
      scheduledPrayerAlarms = alarms;
      setupAlarmsInServiceWorker(alarms, muezzinName);
    }
  } else if (event.data?.type === 'CHECK_AZAN_NOW') {
    checkAndTriggerDuePrayers();
  }
});

function setupAlarmsInServiceWorker(alarms, muezzinName) {
  // پاکسازی تایمرهای قبلی در صورت وجود
  alarmTimeouts.forEach((t) => clearTimeout(t));
  alarmTimeouts = [];

  const now = Date.now();

  alarms.forEach((alarm) => {
    const fireTime = alarm.timestamp;
    const diff = fireTime - now;

    // ۱. اگر مرورگر از Notification Triggers پشتیبانی کند، مستقیم به سیستم‌عامل محول می‌شود
    if (typeof Notification !== 'undefined' && 'showTrigger' in Notification.prototype && typeof self.TimestampTrigger !== 'undefined') {
      if (diff > 0) {
        try {
          self.registration.showNotification(`هنگام ${alarm.prayerName} - قرآن مبین`, {
            body: `نوای ملکوتی اذان شیعه با صدای ${muezzinName || 'مؤذن منتخب'} - برای پخش کامل اذان لمس کنید`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [600, 250, 600, 250, 1200, 300, 1200],
            tag: `mobin-azan-${alarm.prayerKey}`,
            renotify: true,
            requireInteraction: true,
            silent: false,
            showTrigger: new self.TimestampTrigger(fireTime),
            data: {
              prayerKey: alarm.prayerKey,
              prayerName: alarm.prayerName,
              muezzinName: muezzinName,
              url: `/?action=azan&prayer=${alarm.prayerKey}`
            }
          }).catch(() => {});
        } catch {}
      }
    }

    // ۲. در سرویس‌ورکر زنده، تایمر دقیق برای اوقات تا ۲۴ ساعت آینده تنظیم می‌کنیم
    if (diff > 0 && diff < 24 * 3600 * 1000) {
      const tid = setTimeout(() => {
        triggerPrayerNotification(alarm, muezzinName);
      }, diff);
      alarmTimeouts.push(tid);
    }
  });
}

function triggerPrayerNotification(alarm, muezzinName) {
  self.registration.showNotification(`هنگام ${alarm.prayerName} - قرآن مبین`, {
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
      url: `/?action=azan&prayer=${alarm.prayerKey}`
    }
  }).catch(() => {});
}

// رویدادهای پس‌زمینه برای دوره‌های چک منظم (Periodic Background Sync)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'azan-check') {
    event.waitUntil(checkAndTriggerDuePrayers());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'azan-sync') {
    event.waitUntil(checkAndTriggerDuePrayers());
  }
});

function checkAndTriggerDuePrayers() {
  const now = Date.now();
  scheduledPrayerAlarms.forEach((alarm) => {
    const diff = now - alarm.timestamp;
    // اگر در بازه زمانی وقت قرار داریم (تا ۱۰ دقیقه بعد از وقت) و هنوز اجرا نشده
    if (diff >= 0 && diff < 10 * 60 * 1000 && !alarm.fired) {
      alarm.fired = true;
      triggerPrayerNotification(alarm, alarm.muezzinName);
    }
  });
  return Promise.resolve();
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // رد درخواست‌های غیر GET و درخواست‌های API از کش مستقیم
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // استراتژی Stale-While-Revalidate برای استاتیک و بازگشت به ایندکس برای ناوبری
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // تازه‌سازی در پس‌زمینه
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
