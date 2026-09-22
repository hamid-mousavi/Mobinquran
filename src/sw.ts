/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { RangeRequestsPlugin } from 'workbox-range-requests';

declare let self: ServiceWorkerGlobalScope & typeof globalThis;

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
 * Hostهای مجاز برای کش: everyayah.com (ACAO *) و آینهٔ Maqra روی Hugging Face.
 */
const audioHostPattern =
  /^(https:\/\/everyayah\.com\/data\/|https:\/\/huggingface\.co\/datasets\/maqra-project\/)/i;
registerRoute(
  ({ url }) => audioHostPattern.test(url.href) && url.pathname.endsWith('.mp3'),
  new CacheFirst({
    cacheName: 'quran-audio-v1',
    plugins: [new RangeRequestsPlugin()],
  })
);

export {};