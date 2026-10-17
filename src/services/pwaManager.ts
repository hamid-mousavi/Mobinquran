import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

export interface StorageStatus {
  isPersisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  usageMB: string;
  quotaMB: string;
  percentUsed: number;
}

type RefreshCallback = () => void;
type OfflineReadyCallback = () => void;

const refreshListeners: Set<RefreshCallback> = new Set();
const offlineReadyListeners: Set<OfflineReadyCallback> = new Set();
const watchedRegistrations = new WeakSet<ServiceWorkerRegistration>();
let isUpdateAvailable = false;
let swInitialized = false;

function supportsSW(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && !Capacitor.isNativePlatform();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notifyUpdateAvailable() {
  isUpdateAvailable = true;
  refreshListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('[PWA] Error in refresh listener:', e);
    }
  });
}

/** منتظر می‌ماند تا Worker در حال نصب به وضعیت installed برسد (یا مهلت تمام شود) */
function waitForInstalled(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (worker.state !== 'installing') {
      resolve();
      return;
    }
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      worker.removeEventListener('statechange', onChange);
      resolve();
    }
    function onChange() {
      if (worker.state !== 'installing') done();
    }
    worker.addEventListener('statechange', onChange);
  });
}

/** فقط یک بار برای هر registration شنونده می‌گذارد؛ منبع واحد تشخیص نسخه جدید */
function watchRegistration(reg: ServiceWorkerRegistration) {
  if (watchedRegistrations.has(reg)) return;
  watchedRegistrations.add(reg);

  if (reg.waiting && navigator.serviceWorker.controller) {
    notifyUpdateAvailable();
  }
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        notifyUpdateAvailable();
      }
    });
  });
}

/**
 * مدیریت چرخه عمر Service Worker بدون رفرش ناخواسته یا وقفه در قرائت و صوت
 */
export function initServiceWorker() {
  if (!supportsSW() || swInitialized) {
    return;
  }
  swInitialized = true;

  try {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New version detected.');
        notifyUpdateAvailable();
      },
      onOfflineReady() {
        console.log('[PWA] Content cached and ready for offline use.');
        offlineReadyListeners.forEach((listener) => {
          try {
            listener();
          } catch (e) {
            console.error('[PWA] Error in offlineReady listener:', e);
          }
        });
      },
      onRegisteredSW(_url, registration) {
        if (registration) watchRegistration(registration);
      },
      onRegisterError(error) {
        console.warn('[PWA] ServiceWorker registration error:', error);
      },
    });

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) watchRegistration(reg);
    }).catch(() => {});

    // بررسی دوره‌ای وجود نسخه جدید هر ۱۵ دقیقه
    setInterval(() => {
      void checkForUpdates();
    }, 15 * 60 * 1000);

    // بررسی نسخه جدید هنگام بازگشت کاربر به برنامه (در TWA/PWA برنامه معمولاً بسته نمی‌شود، فقط به پس‌زمینه می‌رود)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    });

    window.addEventListener('online', () => {
      void checkForUpdates();
    });

    // بررسی اولیه کمی بعد از شروع برنامه
    setTimeout(() => {
      void checkForUpdates();
    }, 5000);
  } catch (err) {
    console.warn('[PWA] registerSW initialization failed:', err);
  }
}

/**
 * بررسی دستی یا برنامه‌ریزی‌شده برای دریافت به‌روزرسانی جدید.
 * اگر نسخه جدید در حال نصب باشد، تا پایان نصب صبر می‌کند (قبلاً زود false برمی‌گشت).
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!supportsSW()) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return isUpdateAvailable;
    watchRegistration(registration);

    await registration.update();
    if (!registration.waiting && registration.installing) {
      await waitForInstalled(registration.installing, 20000);
    }
    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdateAvailable();
      return true;
    }
    // نسخه‌ی جدیدی در انتظار نیست؛ پرچم قدیمی نباید بنر بی‌اثر نشان بدهد
    isUpdateAvailable = false;
    return false;
  } catch (err) {
    console.warn('[PWA] Check for updates failed:', err);
    return isUpdateAvailable;
  }
}

/** حذف Service Worker و کش پوسته‌ی برنامه (کش صوت و داده‌ی قرآن حفظ می‌شود) */
async function purgeAppShell(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch (e) {
    console.warn('[PWA] unregister failed:', e);
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.includes('precache')).map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn('[PWA] cache purge failed:', e);
  }
}

/**
 * اعمال نسخه جدید بعد از تأیید کاربر.
 * - اگر Worker منتظر باشد: SKIP_WAITING و رفرش با controllerchange (با مهلت ۳ ثانیه‌ای اطمینان)
 * - اگر Worker منتظری نباشد (وضعیت کهنه): پوسته‌ی کش‌شده پاک می‌شود و صفحه از شبکه بارگذاری می‌شود
 * در هر حالت در نهایت صفحه رفرش می‌شود و دکمه برای همیشه در حالت «در حال نصب» نمی‌ماند.
 */
export async function applyAppUpdate(): Promise<void> {
  if (!supportsSW()) {
    window.location.reload();
    return;
  }

  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

      let waiting = reg.waiting;
      if (!waiting) {
        try {
          await reg.update();
        } catch {
          // شبکه در دسترس نیست؛ ادامه با حالت جایگزین
        }
        if (!reg.waiting && reg.installing) {
          await waitForInstalled(reg.installing, 15000);
        }
        waiting = reg.waiting;
      }

      if (waiting) {
        waiting.postMessage({ type: 'SKIP_WAITING' });
        await sleep(3000);
        reloadOnce();
        return;
      }
    }
  } catch (err) {
    console.warn('[PWA] applyAppUpdate failed, falling back to hard refresh:', err);
  }

  await purgeAppShell();
  reloadOnce();
}

export function onServiceWorkerUpdate(callback: RefreshCallback): () => void {
  refreshListeners.add(callback);
  if (isUpdateAvailable) {
    callback();
  }
  return () => {
    refreshListeners.delete(callback);
  };
}

export function onOfflineReady(callback: OfflineReadyCallback): () => void {
  offlineReadyListeners.add(callback);
  return () => {
    offlineReadyListeners.delete(callback);
  };
}

export function getIsUpdateAvailable(): boolean {
  return isUpdateAvailable;
}

/**
 * وضعیت و مدیریت ماندگاری حافظه مرورگر (Storage Persistence - P2-T5)
 */
export async function getStorageStatus(): Promise<StorageStatus> {
  const result: StorageStatus = {
    isPersisted: false,
    usageBytes: 0,
    quotaBytes: 0,
    usageMB: '0',
    quotaMB: '0',
    percentUsed: 0,
  };

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (navigator.storage.persisted) {
        result.isPersisted = await navigator.storage.persisted();
      }
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        result.usageBytes = estimate.usage || 0;
        result.quotaBytes = estimate.quota || 0;
        result.usageMB = (result.usageBytes / (1024 * 1024)).toFixed(1);
        result.quotaMB = (result.quotaBytes / (1024 * 1024)).toFixed(0);
        result.percentUsed = result.quotaBytes > 0
          ? Math.min(100, Math.round((result.usageBytes / result.quotaBytes) * 100))
          : 0;
      }
    } catch (e) {
      console.warn('[Storage] Estimate/persisted check failed:', e);
    }
  }

  return result;
}

/**
 * درخواست جلوگیری از حذف خودکار داده‌های محلی و IndexedDB توسط مرورگر در شرایط کمبود حافظه
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const persisted = await navigator.storage.persist();
      console.log('[Storage] Persistent storage granted:', persisted);
      return persisted;
    } catch (e) {
      console.warn('[Storage] Failed to request persistent storage:', e);
      return false;
    }
  }
  return false;
}
