import { db } from '../db/quranDb';
import {
  Surah,
  Verse,
  ReadingState,
  UserBookmark,
  OfflineContentStatus,
  OfflineDownloadResult,
  ContentMetadata,
  KhatmPlan,
} from '../types';
import { ALL_SURAHS } from '../data/surahs';
import { searchQuranOffline, SearchOptions, SearchResponse } from './searchEngine';

const CORE_PACK_URL = '/data/quran-core-v1.json';

// کش مرزهای واقعی مصحف (p3-t5 / P3-T9): صفحات شروع هر جزء و هر ربع حزب
let mushafStartsCache: { juzStartPages: number[]; quarterStartPages: number[] } | null = null;

interface BundledCorePack {
  id: string;
  version: string;
  schemaVersion: number;
  sourceName: string;
  sourceUrl: string;
  datasetVersion: string;
  licenseStatus: 'pending_review';
  generatedAt: string;
  integrity?: {
    algorithm: string;
    value: string;
  };
  verses: Verse[];
}

export const QuranService = {
  /**
   * بارگذاری و نصب بسته داده ۶۲۳۶ آیه‌ای با بررسی نگارش و شناسه صحت
   */
  async ensureBundledCorePackage(): Promise<boolean> {
    try {
      const existingMeta = await this.getContentMetadata();
      const currentStatus = await this.getOfflineContentStatus();

      // اگر نسخه ۲ با ۶۲۳۶ آیه موجود باشد نیازی به دانلود مجدد نیست
      if (currentStatus.isComplete && existingMeta?.schemaVersion === 2) {
        return true;
      }

      const response = await fetch(CORE_PACK_URL);
      if (!response.ok) return false;
      const contentPack = (await response.json()) as BundledCorePack;
      if (contentPack.id !== 'quran-core' || contentPack.verses?.length !== 6236) {
        return false;
      }

      await db.transaction('rw', db.verses, db.contentMetadata, async () => {
        await db.verses.bulkPut(contentPack.verses);
        await db.contentMetadata.put({
          id: 'quran-core',
          sourceName: `${contentPack.sourceName} (بستهٔ جامع داخلی)`,
          sourceUrl: contentPack.sourceUrl,
          datasetVersion: contentPack.version,
          schemaVersion: contentPack.schemaVersion || 2,
          integrityHash: contentPack.integrity?.value,
          licenseStatus: contentPack.licenseStatus,
          lastSyncedAt: new Date(contentPack.generatedAt).getTime() || Date.now(),
        });
      });
      return true;
    } catch (error) {
      console.warn('Could not install bundled Quran content package:', error);
      return false;
    }
  },

  async getContentMetadata(): Promise<ContentMetadata | undefined> {
    try {
      return await db.contentMetadata.get('quran-core');
    } catch {
      return undefined;
    }
  },

  async getOfflineContentStatus(): Promise<OfflineContentStatus> {
    try {
      const versesCount = await db.verses.count();
      if (versesCount >= 6236) {
        return {
          downloadedSurahIds: ALL_SURAHS.map((s) => s.id),
          downloadedVerses: versesCount,
          totalVerses: 6236,
          isComplete: true,
        };
      }

      const verses = await db.verses.toArray();
      const countsBySurah = new Map<number, number>();
      verses.forEach((verse) =>
        countsBySurah.set(verse.surahId, (countsBySurah.get(verse.surahId) || 0) + 1)
      );

      const downloadedSurahIds = ALL_SURAHS.filter(
        (surah) => (countsBySurah.get(surah.id) || 0) >= surah.versesCount
      ).map((surah) => surah.id);

      return {
        downloadedSurahIds,
        downloadedVerses: verses.length,
        totalVerses: 6236,
        isComplete: downloadedSurahIds.length === ALL_SURAHS.length && verses.length >= 6236,
      };
    } catch {
      return { downloadedSurahIds: [], downloadedVerses: 0, totalVerses: 6236, isComplete: false };
    }
  },

  async downloadSurahs(
    surahIds: number[],
    onProgress?: (current: number, total: number, surah: Surah) => void,
    isCancelled?: () => boolean
  ): Promise<OfflineDownloadResult> {
    const downloadedSurahIds: number[] = [];
    const failedSurahIds: number[] = [];

    // ابتدا مطمئن می‌شویم بستهٔ داده نصب شده باشد
    await this.ensureBundledCorePackage();

    for (let index = 0; index < surahIds.length; index += 1) {
      if (isCancelled?.()) {
        return { downloadedSurahIds, failedSurahIds, cancelled: true };
      }

      const surahId = surahIds[index];
      const surah = ALL_SURAHS.find((item) => item.id === surahId);
      if (!surah) continue;
      onProgress?.(index + 1, surahIds.length, surah);

      const verses = await this.getVersesBySurah(surahId);
      if (verses.length >= surah.versesCount) {
        downloadedSurahIds.push(surahId);
      } else {
        failedSurahIds.push(surahId);
      }
    }

    return { downloadedSurahIds, failedSurahIds, cancelled: false };
  },

  async clearOfflineContent(): Promise<void> {
    await db.verses.clear();
  },

  async getAllSurahs(): Promise<Surah[]> {
    try {
      const list = await db.surahs.toArray();
      if (list.length > 0) return list;
    } catch {
      // Fallback
    }
    return ALL_SURAHS;
  },

  async getSurahById(id: number): Promise<Surah | undefined> {
    try {
      const s = await db.surahs.get(id);
      if (s) return s;
    } catch {
      // Ignore
    }
    return ALL_SURAHS.find((item) => item.id === id);
  },

  async getVersesBySurah(surahId: number): Promise<Verse[]> {
    const surahMeta = ALL_SURAHS.find((s) => s.id === surahId);
    const expectedCount = surahMeta?.versesCount || 0;

    try {
      const verses = await db.verses.where('surahId').equals(surahId).sortBy('verseNumber');
      if (verses.length > 0 && verses.length >= expectedCount) {
        return verses;
      }
    } catch {
      // ادامه
    }

    // اگر سوره در دیتابیس نبود، بسته اصلی را نصب می‌کنیم
    const installed = await this.ensureBundledCorePackage();
    if (installed) {
      try {
        const verses = await db.verses.where('surahId').equals(surahId).sortBy('verseNumber');
        if (verses.length > 0) return verses;
      } catch {}
    }

    return [];
  },

  async getSurahVerses(surahId: number): Promise<Verse[]> {
    return this.getVersesBySurah(surahId);
  },

  /**
   * خواندن آیات یک صفحهٔ مصحف به‌صورت کاملاً آفلاین از دیتابیس محلی (P3-T2)
   */
  async getVersesByPage(pageNumber: number): Promise<Verse[]> {
    if (!pageNumber || pageNumber < 1 || pageNumber > 604) return [];
    try {
      const result = await db.verses.where('pageNumber').equals(pageNumber).sortBy('id');
      if (result.length > 0) return result;
    } catch {
      // ادامه
    }
    const installed = await this.ensureBundledCorePackage();
    if (installed) {
      try {
        return await db.verses.where('pageNumber').equals(pageNumber).sortBy('id');
      } catch {
        return [];
      }
    }
    return [];
  },

  async getVerseBySurahAndNumber(surahId: number, verseNumber: number): Promise<Verse | undefined> {
    try {
      const v = await db.verses.where({ surahId, verseNumber }).first();
      if (v) return v;
    } catch {
      // Ignore
    }

    await this.ensureBundledCorePackage();
    try {
      return await db.verses.where({ surahId, verseNumber }).first();
    } catch {
      return undefined;
    }
  },

  /**
   * شماره صفحهٔ شروع جزء (۱ تا ۳۰) — آفلاین از ایندکس juzNumber (P3-T5)
   */
  async getJuzStartPage(juzNumber: number): Promise<number | null> {
    if (!juzNumber || juzNumber < 1 || juzNumber > 30) return null;
    try {
      const firstVerse = await db.verses.where('juzNumber').equals(juzNumber).first();
      if (firstVerse) return firstVerse.pageNumber;
    } catch {
      // ادامه
    }
    const installed = await this.ensureBundledCorePackage();
    if (installed) {
      try {
        const v = await db.verses.where('juzNumber').equals(juzNumber).first();
        return v?.pageNumber ?? null;
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * شماره صفحهٔ شروع ربع حزب (۱ تا ۶۰) — آفلاین از ایندکس hizbQuarter (P3-T5)
   */
  async getHizbStartPage(hizbQuarter: number): Promise<number | null> {
    if (!hizbQuarter || hizbQuarter < 1 || hizbQuarter > 240) return null;
    try {
      const firstVerse = await db.verses.where('hizbQuarter').equals(hizbQuarter).first();
      if (firstVerse) return firstVerse.pageNumber;
    } catch {
      // ادامه
    }
    const installed = await this.ensureBundledCorePackage();
    if (installed) {
      try {
        const v = await db.verses.where('hizbQuarter').equals(hizbQuarter).first();
        return v?.pageNumber ?? null;
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * مرزهای واقعی مصحف: صفحات شروع ۳۰ جزء و ۲۴۰ ربع حزب از دادهٔ بسته (P3-T5 / P3-T9)
   * نتیجه کش می‌شود تا هزینهٔ کوئری یک‌بار پرداخت شود.
   */
  async getMushafStarts(): Promise<{ juzStartPages: number[]; quarterStartPages: number[] }> {
    if (mushafStartsCache) return mushafStartsCache;

    const install = async (): Promise<boolean> => {
      const s1 = await db.verses.count();
      if (s1 >= 6236) return true;
      return this.ensureBundledCorePackage();
    };

    try {
      await install();
      const juzStartPages: number[] = [];
      for (let j = 1; j <= 30; j++) {
        const v = await db.verses.where('juzNumber').equals(j).first();
        juzStartPages.push(v?.pageNumber ?? 1);
      }
      const quarterStartPages: number[] = [];
      for (let q = 1; q <= 240; q++) {
        const v = await db.verses.where('hizbQuarter').equals(q).first();
        quarterStartPages.push(v?.pageNumber ?? 1);
      }
      mushafStartsCache = { juzStartPages, quarterStartPages };
      return mushafStartsCache;
    } catch {
      // در صورت خطا، fallback ایمن: بازه‌های همتراز با صفحهٔ ۱ و ۶۰۴
      const juzStartPages = Array.from({ length: 30 }, (_, i) => Math.floor((i * 604) / 30) + 1);
      juzStartPages[29] = 604;
      const quarterStartPages = Array.from({ length: 240 }, (_, i) => Math.floor((i * 604) / 240) + 1);
      quarterStartPages[239] = 604;
      return { juzStartPages, quarterStartPages };
    }
  },

  async getKhatmPlan(): Promise<KhatmPlan | null> {
    try {
      const plans = await db.khatmPlans.toArray();
      return plans.find((p) => p.isActive) || plans[0] || null;
    } catch {
      return null;
    }
  },

  async saveKhatmPlan(plan: KhatmPlan): Promise<void> {
    await db.khatmPlans.put({
      ...plan,
      isActive: plan.isActive === undefined ? true : plan.isActive,
    });
  },

  /**
   * مهاجرت برنامهٔ ختم از localStorage قدیمی (`quran_khatm_plan`) به Dexie (P3-T9)
   */
  async importLegacyKhatmPlanIfEmpty(): Promise<void> {
    try {
      const count = await db.khatmPlans.count();
      if (count > 0) return;
      const raw = localStorage.getItem('quran_khatm_plan');
      if (!raw) return;
      const legacy = JSON.parse(raw) as KhatmPlan;
      if (!legacy || !legacy.id || !legacy.startDate) return;
      await this.saveKhatmPlan({ ...legacy, isActive: true });
      localStorage.removeItem('quran_khatm_plan');
    } catch {
      // بی‌صدا: ادامه با حالت پیش‌فرض
    }
  },

  async getBookmarks(): Promise<UserBookmark[]> {
    try {
      return await db.bookmarks.reverse().sortBy('createdAt');
    } catch {
      return [];
    }
  },

  async toggleBookmark(surahId: number, verseNumber: number): Promise<boolean> {
    try {
      const existing = await db.bookmarks.where({ surahId, verseNumber }).first();
      if (existing && existing.id) {
        await db.bookmarks.delete(existing.id);
        return false;
      } else {
        await db.bookmarks.add({
          surahId,
          verseNumber,
          createdAt: Date.now(),
        });
        return true;
      }
    } catch {
      return false;
    }
  },

  async saveBookmarkNote(surahId: number, verseNumber: number, note: string): Promise<void> {
    try {
      const existing = await db.bookmarks.where({ surahId, verseNumber }).first();
      if (existing && existing.id) {
        await db.bookmarks.update(existing.id, { note });
      } else {
        await db.bookmarks.add({
          surahId,
          verseNumber,
          note,
          createdAt: Date.now(),
        });
      }
    } catch (e) {
      console.error('Failed to save bookmark note', e);
    }
  },

  async isBookmarked(surahId: number, verseNumber: number): Promise<boolean> {
    try {
      const existing = await db.bookmarks.where({ surahId, verseNumber }).first();
      return !!existing;
    } catch {
      return false;
    }
  },

  async saveLastRead(surahId: number, verseNumber: number, pageNumber: number): Promise<void> {
    try {
      await db.readingState.put({
        id: 'last_read',
        surahId,
        verseNumber,
        pageNumber,
        updatedAt: Date.now(),
      });
    } catch {
      localStorage.setItem('quran_last_read', JSON.stringify({ surahId, verseNumber, pageNumber }));
    }
  },

  async getLastRead(): Promise<ReadingState | null> {
    try {
      const state = await db.readingState.get('last_read');
      if (state) return state;
    } catch {
      // Ignore
    }
    const raw = localStorage.getItem('quran_last_read');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * جستجوی سریع و کاملاً آفلاین در تمام آیات قرآن کریم
   */
  async searchOffline(
    query: string,
    scope: 'all' | 'arabic' | 'translation' = 'all',
    surahId?: number,
    juzNumber?: number
  ): Promise<SearchResponse> {
    await this.ensureBundledCorePackage();
    return searchQuranOffline({
      query,
      scope,
      surahId,
      juzNumber,
    });
  },
};
