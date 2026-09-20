import { db } from '../db/quranDb';
import { Surah, Verse, ReadingState, UserBookmark } from '../types';
import { ALL_SURAHS } from '../data/surahs';
import { INITIAL_VERSES } from '../data/initialVerses';

export const QuranService = {
  async getAllSurahs(): Promise<Surah[]> {
    try {
      const list = await db.surahs.toArray();
      if (list.length > 0) return list;
    } catch {
      // Fallback to static in memory
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
    return ALL_SURAHS.find(item => item.id === id);
  },

  async getVersesBySurah(surahId: number): Promise<Verse[]> {
    const surahMeta = ALL_SURAHS.find(s => s.id === surahId);
    const expectedCount = surahMeta?.versesCount || 0;

    try {
      const verses = await db.verses.where('surahId').equals(surahId).sortBy('verseNumber');
      // اگر همه آیات سوره در دیتابیس محلی ذخیره شده باشند، بدون درنگ از حافظه محلی برمی‌گردانیم
      if (verses.length > 0 && verses.length >= expectedCount) {
        return verses;
      }
    } catch {
      // ادامه جهت واکشی
    }

    // بررسی آیات اولیه آفلاین در صورتی که تمام آیات را داشته باشد
    const initialForSurah = INITIAL_VERSES.filter(v => v.surahId === surahId);
    if (initialForSurah.length > 0 && initialForSurah.length >= expectedCount) {
      try {
        await db.verses.bulkPut(initialForSurah);
      } catch {
        // نادیده گرفتن خطا
      }
      return initialForSurah;
    }

    // واکشی کامل از سرور اختصاصی برنامه
    try {
      const res = await fetch(`/api/quran/surah/${surahId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.verses && Array.isArray(data.verses) && data.verses.length > 0) {
          // ذخیره ماندگار در دیتابیس مرورگر جهت استفاده آفلاین همیشگی
          try {
            await db.verses.bulkPut(data.verses);
          } catch (dbErr) {
            console.warn('Could not save verses to IndexedDB:', dbErr);
          }
          return data.verses;
        }
      }
    } catch (networkErr) {
      console.warn('Network error fetching from local API, trying fallback:', networkErr);
    }

    // فال‌بک دوم: ارتباط مستقیم به API ابری قرآن در صورت بروز اختلال در سرور واسط
    try {
      const fallbackRes = await fetch(
        `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,fa.makarem,fa.fooladvand,fa.ansarian`
      );
      if (fallbackRes.ok) {
        const fallbackJson = await fallbackRes.json();
        if (fallbackJson.data && fallbackJson.data.length >= 4) {
          const [uEd, mEd, fEd, aEd] = fallbackJson.data;
          const fallbackVerses: Verse[] = uEd.ayahs.map((uA: any, idx: number) => {
            let text = uA.text || '';
            if (surahId > 1 && uA.numberInSurah === 1 && surahId !== 9) {
              text = text.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?ٱلرَّحِيمِ\s*/u, '').trim();
              text = text.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?الرَّحِيمِ\s*/u, '').trim();
            }
            return {
              id: uA.number,
              surahId,
              verseNumber: uA.numberInSurah,
              juzNumber: uA.juz,
              pageNumber: uA.page,
              textArabic: text,
              translationMakarem: mEd.ayahs[idx]?.text || '',
              translationFooladvand: fEd.ayahs[idx]?.text || '',
              translationAnsarian: aEd.ayahs[idx]?.text || '',
              tafsirNemoneh: 'نکات تفسیری: جهت مشاهده تدبر عمیق در این آیه روی دکمه تدبر هوشمند کلیک نمایید.',
              tafsirMizan: 'نکات المیزان: تبیین معارف توحیدی و حقایق قرآنی.',
              rootWords: []
            };
          });

          try {
            await db.verses.bulkPut(fallbackVerses);
          } catch {}
          return fallbackVerses;
        }
      }
    } catch (err) {
      console.error('Failed to fetch from fallback cloud API:', err);
    }

    // در بدترین حالت، آیات موجود در حافظه آفلاین تحویل داده می‌شود
    return initialForSurah.length > 0 ? initialForSurah : [];
  },

  async getVerseBySurahAndNumber(surahId: number, verseNumber: number): Promise<Verse | undefined> {
    try {
      const v = await db.verses.where({ surahId, verseNumber }).first();
      if (v) return v;
    } catch {
      // Ignore
    }
    return INITIAL_VERSES.find(item => item.surahId === surahId && item.verseNumber === verseNumber);
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
          createdAt: Date.now()
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
          createdAt: Date.now()
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
        updatedAt: Date.now()
      });
    } catch {
      // Fallback to localStorage
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
   * جستجوی سریع و کاملاً آفلاین در دیتابیس محلی (IndexedDB و داده‌های ذخیره‌شده)
   */
  async searchOffline(
    query: string,
    scope: 'all' | 'arabic' | 'translation' = 'all',
    surahId?: number
  ): Promise<{ results: any[]; source: 'offline_database' }> {
    const normalizeArabic = (str: string): string => {
      if (!str) return '';
      return str
        // حذف تمام اعراب و تنوین‌ها و تشدید و علامت‌های وقفی
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
        // یکسان‌سازی همزه‌ها
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .toLowerCase()
        .trim();
    };

    const normalizePersian = (str: string): string => {
      if (!str) return '';
      return str
        .replace(/[ي]/g, 'ی')
        .replace(/[ك]/g, 'ک')
        .replace(/[\u200C\u200B]/g, ' ') // نیم‌فاصله‌ها
        .toLowerCase()
        .trim();
    };

    const cleanQuery = query.trim();
    const normArabicQuery = normalizeArabic(cleanQuery);
    const normPersianQuery = normalizePersian(cleanQuery);

    if (normArabicQuery.length < 2 && normPersianQuery.length < 2) {
      return { results: [], source: 'offline_database' };
    }

    try {
      // جمع‌آوری آیات از دیتابیس محلی IndexedDB
      let allLocalVerses: Verse[] = [];
      try {
        if (surahId && surahId > 0) {
          allLocalVerses = await db.verses.where('surahId').equals(surahId).toArray();
        } else {
          allLocalVerses = await db.verses.toArray();
        }
      } catch {
        allLocalVerses = [];
      }

      // ترکیب با آیات اولیه درون‌برنامه برای تضمین وجود داده حتی اگر هنوز هیچ سوره‌ای لود نشده باشد
      const mapById = new Map<number, Verse>();
      INITIAL_VERSES.forEach((v) => {
        if (!surahId || surahId === 0 || v.surahId === surahId) {
          mapById.set(v.id, v);
        }
      });
      allLocalVerses.forEach((v) => {
        mapById.set(v.id, v);
      });

      const combinedVerses = Array.from(mapById.values());
      const results: any[] = [];

      for (const verse of combinedVerses) {
        let matched = false;
        let matchedIn: 'arabic' | 'translation' = 'arabic';
        let matchScore = 0;

        const surahMeta = ALL_SURAHS.find((s) => s.id === verse.surahId);

        // جستجو در متن عربی
        if (scope === 'all' || scope === 'arabic') {
          const normArabicText = normalizeArabic(verse.textArabic);
          if (normArabicText.includes(normArabicQuery)) {
            matched = true;
            matchedIn = 'arabic';
            matchScore += 10;
          }
        }

        // جستجو در ترجمه‌ها
        if (!matched && (scope === 'all' || scope === 'translation')) {
          const mText = normalizePersian(verse.translationMakarem || '');
          const fText = normalizePersian(verse.translationFooladvand || '');
          const aText = normalizePersian(verse.translationAnsarian || '');

          if (
            mText.includes(normPersianQuery) ||
            fText.includes(normPersianQuery) ||
            aText.includes(normPersianQuery)
          ) {
            matched = true;
            matchedIn = 'translation';
            matchScore += 5;
          }
        }

        if (matched && surahMeta) {
          results.push({
            id: verse.id,
            surahId: verse.surahId,
            surahNameArabic: surahMeta.nameArabic,
            surahNamePersian: surahMeta.namePersian,
            verseNumber: verse.verseNumber,
            pageNumber: verse.pageNumber || surahMeta.startPage || 1,
            juzNumber: verse.juzNumber || surahMeta.juzNumber || 1,
            textArabic: verse.textArabic,
            translation: verse.translationMakarem || verse.translationFooladvand || '',
            matchedIn,
            isOfflineResult: true,
          });
        }

        if (results.length >= 100) break;
      }

      return { results, source: 'offline_database' };
    } catch (err) {
      console.error('Offline search error:', err);
      return { results: [], source: 'offline_database' };
    }
  },
};
