import { Capacitor } from '@capacitor/core';

/**
 * دریافت آدرس پایه برای فراخوانی APIها.
 * در محیط وب مسیرهای نسبی (/api/...) به کار می‌روند.
 * در محیط Native (اندروید) از VITE_API_BASE_URL یا آدرس دامنهٔ سرور استفاده می‌شود.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (Capacitor.isNativePlatform()) {
    // آدرس پیش‌فرض سرویس‌دهنده برای اپلیکیشن اندروید
    return 'https://app.vercel.mobinquran.twa';
  }

  return '';
}

/**
 * تبدیل مسیر نسبی به آدرس کامل قابل فراخوانی در وب و اپ نیتیو
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${cleanPath}`;
}

/**
 * تابع واحد فراخوانی APIهای سرور
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  return fetch(url, init);
}
