/**
 * مدیریت یکپارچه نصب PWA، پرامپت‌های نصب و راهنمای تفکیک‌شده برای
 * اندروید، آیفون (iOS)، دسکتاپ و تشخیص مرورگرهای داخلی پیام‌رسان‌ها (تلگرام/ایتا/واتساپ)
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type InstallListener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isAppInstalled = false;
const listeners = new Set<InstallListener>();

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return (
    ua.includes('telegram') ||
    ua.includes('eitaa') ||
    ua.includes('bale') ||
    ua.includes('rubika') ||
    ua.includes('instagram') ||
    ua.includes('fbav') ||
    ua.includes('fban') ||
    ua.includes('whatsapp') ||
    (ua.includes('wv') && !ua.includes('chrome/'))
  );
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function initPWAInstallTracker() {
  if (typeof window === 'undefined') return;

  isAppInstalled = isRunningStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    isAppInstalled = true;
    deferredPrompt = null;
    listeners.forEach((cb) => cb());
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function getIsInstalled(): boolean {
  return isAppInstalled || isRunningStandalone();
}

export function subscribeToInstallStatus(callback: InstallListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  try {
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      isAppInstalled = true;
      deferredPrompt = null;
      listeners.forEach((cb) => cb());
    }
    return result.outcome;
  } catch (err) {
    console.error('Error triggering PWA prompt:', err);
    return 'unavailable';
  }
}
