import { db } from '../db/quranDb';
import { ReciterId, getAudioSourceUrl } from './audioSources';
import { AudioDownloadRecord } from '../types';

/**
 * P5-T2 — کش آفلاین صوت هر سوره.
 *
 * معماری (ADR-8): باینری mp3 در Cache Storage نگهداری می‌شود (نه IndexedDB).
 * فقط ابردادهٔ «کدام سوره‌ها دانلود شده‌اند و با کدام قاری» در Dexie ثبت می‌شود
 * تا UI وضعیت را سریع نشان دهد و حذف/مدیریت حجم ممکن شود.
 */

export const AUDIO_CACHE_NAME = 'quran-audio-v1';

/** حداکثر اشغال مجاز کش صوتی (سقف فضا). به‌صورت HTF قابی تنظیم شده — از تنظیمات کاربر تکمیل می‌شود. */
export const AUDIO_CACHE_SOFT_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB سقف نرم

export type { AudioDownloadRecord };

export interface AudioCacheStatus {
  records: AudioDownloadRecord[];
  totalBytes: number;
  totalVerses: number;
  softLimitBytes: number;
}

export const audioDownloadKey = (reciterId: ReciterId, surahId: number): string =>
  `${reciterId}::${surahId}`;

export function estimateSurahVerses(surahId: number): number {
  const counts: Record<number, number> = {
    1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
    11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98,
    20: 135, 21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88,
    29: 69, 30: 60, 31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182,
    38: 88, 39: 75, 40: 85, 41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35,
    47: 38, 48: 29, 49: 18, 50: 45, 51: 60, 52: 49, 53: 62, 54: 55, 55: 78,
    56: 96, 57: 29, 58: 22, 59: 24, 60: 13, 61: 14, 62: 11, 63: 11, 64: 18,
    65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44, 71: 28, 72: 28, 73: 20,
    74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42, 81: 29, 82: 19,
    83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20, 91: 15,
    92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11, 101: 11,
    102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
    111: 5, 112: 4, 113: 5, 114: 6,
  };
  return counts[surahId] ?? 0;
}

export const getAudioCacheServerAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof caches !== 'undefined' && 'caches' in window;
};

async function getAudioCache(): Promise<Cache | null> {
  if (!getAudioCacheServerAvailable()) return null;
  return caches.open(AUDIO_CACHE_NAME);
}

/**
 * دانلود صوت کل سوره برای قاری مشخص به کش (Cache Storage).
 * @returns تعداد آیات دانلودشده و منابع استفاده‌شده.
 */
export async function downloadSurahAudio(
  reciterId: ReciterId,
  surahId: number,
  onProgress?: (current: number, total: number, verseNumber: number) => void,
  shouldCancel?: () => boolean
): Promise<{ downloadedVerses: number; failedVerses: number[]; sourcesUsed: string[] }> {
  const total = estimateSurahVerses(surahId);
  if (total === 0) throw new Error(`سوره ${surahId} یافت نشد`);
  const cache = await getAudioCache();
  if (!cache) throw new Error('Cache Storage در دسترس نیست');

  let downloaded = 0;
  let failed: number[] = [];
  const sourcesUsed: string[] = [];
  const existing = await loadRecord(reciterId, surahId);

  for (let v = 1; v <= total; v++) {
    if (shouldCancel && shouldCancel()) break;

    const url = getAudioSourceUrl(reciterId, surahId, v, 0);
    const fallbackUrl = url === null ? getAudioSourceUrl(reciterId, surahId, v, 1) : null;
    const chosenUrl = url ?? fallbackUrl ?? null;
    if (chosenUrl === null) {
      failed.push(v);
      continue;
    }

    try {
      const existingRes = await cache.match(chosenUrl);
      if (existingRes) {
        sourcesUsed.push(chosenUrl.includes('everyayah.com') ? 'everyayah' : 'other');
        downloaded++;
        onProgress?.(downloaded, total, v);
        continue;
      }

      const res = await fetch(chosenUrl, { mode: 'cors' });
      if (!res.ok && res.status !== 0) {
        failed.push(v);
        continue;
      }
      // buffer کامل ذخیره می‌شود تا SW بتواند Range را از کل فایل سرو کند (ADR-8)
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0) {
        failed.push(v);
        continue;
      }
      const response = new Response(buffer, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(buffer.byteLength),
          'Accept-Ranges': 'bytes',
        },
      });
      await cache.put(chosenUrl, response);
      sourcesUsed.push(chosenUrl.includes('everyayah.com') ? 'everyayah' : 'other');
      downloaded++;
      onProgress?.(downloaded, total, v);
    } catch (err) {
      failed.push(v);
    }
  }

  // ابرداده در Dexie به‌روزرسانی می‌شود (باینری در Cache Storage باقی می‌ماند — ADR-8)
  await upsertRecord(reciterId, surahId, total, downloaded, sourcesUsed);
  return { downloadedVerses: downloaded, failedVerses: failed, sourcesUsed };
}

/**
 * حذف صوت یک سوره از کش و ابردادهٔ آن.
 */
export async function deleteSurahAudio(reciterId: ReciterId, surahId: number): Promise<void> {
  const cache = await getAudioCache();
  const record = await loadRecord(reciterId, surahId);
  if (cache && record) {
    const total = estimateSurahVerses(surahId);
    for (let v = 1; v <= total; v++) {
      const url = getAudioSourceUrl(reciterId, surahId, v, 0);
      const fallbackUrl = url === null ? getAudioSourceUrl(reciterId, surahId, v, 1) : null;
      const chosenUrl = url ?? fallbackUrl ?? null;
      if (chosenUrl) {
        await cache.delete(chosenUrl).catch(() => undefined);
      }
    }
  }
  await db.audioDownloads.delete(audioDownloadKey(reciterId, surahId));
}

/**
 * حذف همهٔ صوت‌های دانلودشده برای یک قاری.
 */
export async function deleteAllAudioForReciter(reciterId: ReciterId): Promise<void> {
  const records = await db.audioDownloads.where('reciterId').equals(reciterId).toArray();
  for (const r of records) {
    await deleteSurahAudio(reciterId, r.surahId);
  }
}

async function loadRecord(reciterId: ReciterId, surahId: number): Promise<AudioDownloadRecord | undefined> {
  return db.audioDownloads.get(audioDownloadKey(reciterId, surahId));
}

async function upsertRecord(
  reciterId: ReciterId,
  surahId: number,
  totalVerses: number,
  downloadedVerses: number,
  sourcesUsed: string[]
): Promise<void> {
  await db.audioDownloads.put({
    key: audioDownloadKey(reciterId, surahId),
    reciterId,
    surahId,
    totalVerses,
    downloadedVerses,
    bytes: 0, // حجم واقعی زمان اجرا از Cache Storage خوانده می‌شود
    downloadedAt: Date.now(),
    sourcesUsed,
  });
}

/**
 * وضعیت کش صوتی: ابرداده + کل حجم واقعی از Cache Storage.
 */
export async function getAudioCacheStatus(): Promise<AudioCacheStatus> {
  const records = await db.audioDownloads.toArray();
  let totalBytes = 0;
  let totalVerses = 0;

  if (getAudioCacheServerAvailable()) {
    try {
      const cache = await getAudioCache();
      if (cache) {
        const keys = await cache.keys();
        for (const key of keys) {
          const res = await cache.match(key);
          if (!res) continue;
          const len = Number(res.headers.get('Content-Length') ?? 0);
          totalBytes += len;
          // شمارش آیات بدون volume: حجم واقعی از Content-Length
        }
      }
    } catch {
      // حجم واقعی در دسترس نیست؛ از ابرداده استفاده می‌شود
    }
  }

  totalVerses = records.reduce((sum, r) => sum + (r.downloadedVerses ?? 0), 0);

  return {
    records,
    totalBytes,
    totalVerses,
    softLimitBytes: AUDIO_CACHE_SOFT_LIMIT_BYTES,
  };
}

export async function isSurahAudioCached(reciterId: ReciterId, surahId: number): Promise<boolean> {
  const record = await loadRecord(reciterId, surahId);
  return !!record && record.downloadedVerses === estimateSurahVerses(surahId);
}

export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '۰';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} مگابایت`;
};

export function estimateSurahAudioBytes(reciterId: ReciterId, surahId: number): number {
  // برآورد میانه: ~50KB در هر آیه (مشاهده‌شده از 38-101KB در Alafasy_64kbps)
  return estimateSurahVerses(surahId) * 55 * 1024;
}