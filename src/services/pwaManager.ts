import { registerSW } from 'virtual:pwa-register';

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

let updateSWFunction: ((reloadPage?: boolean) => Promise<void>) | null = null;
const refreshListeners: Set<RefreshCallback> = new Set();
const offlineReadyListeners: Set<OfflineReadyCallback> = new Set();
let isUpdateAvailable = false;

/**
 * مدیریت چرخه عمر Service Worker بدون رفرش ناخواسته یا وقفه در قرائت و صوت
 */
export function initServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    updateSWFunction = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New version available, waiting for user confirmation.');
        isUpdateAvailable = true;
        refreshListeners.forEach((listener) => {
          try {
            listener();
          } catch (e) {
            console.error('[PWA] Error in refresh listener:', e);
          }
        });
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
      onRegisterError(error) {
        console.warn('[PWA] ServiceWorker registration error:', error);
      },
    });
  } catch (err) {
    console.warn('[PWA] registerSW initialization failed:', err);
  }
}

/**
 * اعمال نسخه جدید بعد از تأیید کاربر (یا خلوت بودن صوت/چت)
 */
export async function applyAppUpdate(): Promise<void> {
  if (updateSWFunction) {
    await updateSWFunction(true);
  } else {
    window.location.reload();
  }
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
