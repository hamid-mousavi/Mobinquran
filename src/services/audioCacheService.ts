import { db } from '../db/quranDb';
import { ReciterId, getAudioSourceUrl, getSourcesForReciter } from './audioSources';
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
 * کمکی برای دریافت ایمن با تایم‌اوت
 */
async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * دانلود صوت کل سوره برای قاری مشخص به کش (Cache Storage).
 * با چرخش هوشمند بین منابع (everyayah -> Maqra -> Islamic Network) و تلاش مجدد خودکار.
 * @returns تعداد آیات دانلودشده، آیات ناموفق و منابع استفاده‌شده.
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
  const failed: number[] = [];
  const sourcesUsedSet = new Set<string>();
  const sources = getSourcesForReciter(reciterId);

  for (let v = 1; v <= total; v++) {
    if (shouldCancel && shouldCancel()) break;

    // ۱. بررسی اینکه آیا قبلاً این آیه از هر کدام از سورس‌های این قاری ذخیره شده است یا خیر
    let alreadyCached = false;
    for (const src of sources) {
      const u = src.buildUrl(surahId, v);
      if (!u) continue;
      const matched = await cache.match(u);
      if (matched) {
        alreadyCached = true;
        sourcesUsedSet.add(src.name);
        break;
      }
    }

    if (alreadyCached) {
      downloaded++;
      onProgress?.(downloaded, total, v);
      continue;
    }

    // ۲. چرخش بین سورس‌های قاری (اولویت ۰ -> اولویت ۱ -> اولویت ۲)
    let verseDownloaded = false;
    for (const src of sources) {
      if (shouldCancel && shouldCancel()) break;
      const url = src.buildUrl(surahId, v);
      if (!url) continue;

      try {
        const res = await fetchWithTimeout(url, 12000);
        if (!res.ok && res.status !== 0) {
          continue;
        }

        const buffer = await res.arrayBuffer();
        if (!buffer || buffer.byteLength === 0) {
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

        await cache.put(url, response);
        sourcesUsedSet.add(src.name);
        verseDownloaded = true;
        break;
      } catch {
        // ادامه به سورس بعدی
      }
    }

    // اگر با هیچ‌کدام دانلود نشد، یک تلاش مجدد با سورس اول پس از مکث کوتاه
    if (!verseDownloaded && !shouldCancel?.()) {
      await new Promise((r) => setTimeout(r, 300));
      for (const src of sources) {
        const url = src.buildUrl(surahId, v);
        if (!url) continue;
        try {
          const res = await fetchWithTimeout(url, 10000);
          if (res.ok || res.status === 200) {
            const buffer = await res.arrayBuffer();
            if (buffer && buffer.byteLength > 0) {
              const response = new Response(buffer, {
                status: 200,
                statusText: 'OK',
                headers: {
                  'Content-Type': 'audio/mpeg',
                  'Content-Length': String(buffer.byteLength),
                  'Accept-Ranges': 'bytes',
                },
              });
              await cache.put(url, response);
              sourcesUsedSet.add(src.name);
              verseDownloaded = true;
              break;
            }
          }
        } catch {
          // شکست نهایی این آیه
        }
      }
    }

    if (verseDownloaded) {
      downloaded++;
    } else {
      failed.push(v);
    }

    onProgress?.(downloaded, total, v);
  }

  const sourcesUsed = Array.from(sourcesUsedSet);
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

/**
 * بازیابی آدرس Blob فایل صوتی ذخیره‌شده در کش برای یک آیه و قاری خاص.
 * تمام سورس‌های قاری را بررسی می‌کند (به‌ویژه سورس ۰ که در دانلود آفلاین استفاده می‌شود).
 */
export async function getCachedAudioBlobUrl(
  reciterId: ReciterId,
  surahId: number,
  verseNumber: number
): Promise<{ blobUrl: string; sourceIndex: number; reciterId: ReciterId } | null> {
  if (!getAudioCacheServerAvailable()) return null;
  try {
    const cache = await getAudioCache();
    if (!cache) return null;

    // ۱. بررسی تمام سورس‌های این قاری به ترتیب اولویت (ابتدا سورس ۰)
    const sources = getSourcesForReciter(reciterId);
    for (let i = 0; i < sources.length; i++) {
      const url = sources[i].buildUrl(surahId, verseNumber);
      if (!url) continue;
      const match = await cache.match(url);
      if (match) {
        const blob = await match.blob();
        if (blob && blob.size > 0) {
          return { blobUrl: URL.createObjectURL(blob), sourceIndex: i, reciterId };
        }
      }
    }

    // ۲. تطبیق بر اساس کلیدهای کش با پوشه یا شناسه قاری
    const paddedKey = `${String(surahId).padStart(3, '0')}${String(verseNumber).padStart(3, '0')}.mp3`;
    const reciterFolderMap: Record<ReciterId, string[]> = {
      parhizgar: ['parhizgar', 'Parhizgar_48kbps'],
      abdulbasit: ['abdulbasit', 'Abdul_Basit_Murattal_64kbps', 'abdul-basit'],
      minshawi: ['minshawi', 'Menshawi_32kbps', 'al-minshawi'],
      afasy: ['alafasy', 'Alafasy_64kbps', 'mishari-alafasy'],
      husary: ['husary', 'Husary_64kbps'],
      ghamadi: ['ghamadi', 'Ghamadi_40kbps'],
      muaiqly: ['muaiqly', 'Maher_AlMuaiqly_64kbps'],
      shatri: ['shaatree', 'shatri', 'Abu_Bakr_Ash-Shaatree_64kbps'],
      hudhaify: ['hudhaify', 'Hudhaify_64kbps'],
      sudais: ['sudais', 'Abdurrahmaan_As-Sudais_64kbps'],
      shuraim: ['shuraym', 'shuraim', 'Saood_ash-Shuraym_64kbps'],
      mustafa_ismail: ['mustafaismail', 'mustafa_ismail', 'Mustafa_Ismail_48kbps'],
    };

    const searchMarkers = reciterFolderMap[reciterId] || [reciterId];
    const keys = await cache.keys();
    for (const req of keys) {
      const reqUrl = req.url.toLowerCase();
      const matchesReciter = searchMarkers.some((m) => reqUrl.includes(m.toLowerCase()));
      if (matchesReciter && reqUrl.endsWith(paddedKey.toLowerCase())) {
        const match = await cache.match(req);
        if (match) {
          const blob = await match.blob();
          if (blob && blob.size > 0) {
            return { blobUrl: URL.createObjectURL(blob), sourceIndex: 0, reciterId };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading from audio cache:', err);
  }
  return null;
}

/**
 * بازیابی آدرس صوتی آفلاین از هر قاری دیگری که این سوره و آیه را ذخیره کرده است.
 * در شرایطی که قاری فعال کاربر دانلود نشده، اما سوره با قاری دیگر دانلود شده به کار می‌رود.
 */
export async function getAnyCachedAudioBlobUrl(
  surahId: number,
  verseNumber: number
): Promise<{ blobUrl: string; sourceIndex: number; reciterId: ReciterId } | null> {
  if (!getAudioCacheServerAvailable()) return null;
  try {
    // ۱. بررسی اولویت‌دار رکوردهای دانلود در Dexie
    const records = await db.audioDownloads.where('surahId').equals(surahId).toArray();
    // مرتب‌سازی بر اساس سوره‌هایی که بیشترین آیات دانلودشده را دارند
    records.sort((a, b) => (b.downloadedVerses || 0) - (a.downloadedVerses || 0));

    for (const rec of records) {
      const result = await getCachedAudioBlobUrl(rec.reciterId as ReciterId, surahId, verseNumber);
      if (result) return result;
    }

    // ۲. بررسی عمومی در کلیدهای کش
    const cache = await getAudioCache();
    if (cache) {
      const paddedKey = `${String(surahId).padStart(3, '0')}${String(verseNumber).padStart(3, '0')}.mp3`;
      const keys = await cache.keys();
      for (const req of keys) {
        if (req.url.endsWith(paddedKey)) {
          const match = await cache.match(req);
          if (match) {
            const blob = await match.blob();
            if (blob && blob.size > 0) {
              // تشخیص قاری از آدرس
              const url = req.url.toLowerCase();
              let detectedReciter: ReciterId = 'parhizgar';
              if (url.includes('abdul')) detectedReciter = 'abdulbasit';
              else if (url.includes('minshawi') || url.includes('menshawi')) detectedReciter = 'minshawi';
              else if (url.includes('afasy')) detectedReciter = 'afasy';
              else if (url.includes('husary')) detectedReciter = 'husary';
              else if (url.includes('ghamadi')) detectedReciter = 'ghamadi';
              else if (url.includes('muaiqly')) detectedReciter = 'muaiqly';
              else if (url.includes('shaatree') || url.includes('shatri')) detectedReciter = 'shatri';
              else if (url.includes('hudhaify')) detectedReciter = 'hudhaify';
              else if (url.includes('sudais')) detectedReciter = 'sudais';
              else if (url.includes('shuraym') || url.includes('shuraim')) detectedReciter = 'shuraim';
              else if (url.includes('mustafa')) detectedReciter = 'mustafa_ismail';

              return { blobUrl: URL.createObjectURL(blob), sourceIndex: 0, reciterId: detectedReciter };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading any audio from cache:', err);
  }
  return null;
}

/**
 * بررسی اینکه آیا سوره جاری با قاری مشخصی یا هر قاری دیگری به‌صورت کامل دانلود شده است یا خیر.
 */
export async function getDownloadedReciterForSurah(surahId: number): Promise<ReciterId | null> {
  try {
    const records = await db.audioDownloads.where('surahId').equals(surahId).toArray();
    const expected = estimateSurahVerses(surahId);
    const complete = records.find((r) => r.downloadedVerses === expected);
    if (complete) return complete.reciterId as ReciterId;
    if (records.length > 0 && records[0].downloadedVerses > 0) return records[0].reciterId as ReciterId;
  } catch {
    // ignore
  }
  return null;
}