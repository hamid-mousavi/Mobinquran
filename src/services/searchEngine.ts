import { db } from '../db/quranDb';
import {
  Verse,
  SearchResultItem,
  Translator,
} from '../types';
import { ALL_SURAHS } from '../data/surahs';
import {
  normalizeArabicForSearch,
  normalizePersianForSearch,
  calculateMatchScore,
} from '../utils/textNormalization';

export interface SearchOptions {
  query: string;
  scope?: 'all' | 'arabic' | 'translation';
  surahId?: number;
  juzNumber?: number;
  activeTranslator?: Translator;
  maxResults?: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  totalMatches: number;
  searchDurationMs: number;
  source: 'offline_database';
}

/**
 * دریافت متن ترجمه متناظر با مترجم انتخابی کاربر
 */
function getTranslationByTranslator(verse: Verse, translator: Translator = 'makarem'): string {
  switch (translator) {
    case 'fooladvand':
      return verse.translationFooladvand || verse.translationMakarem || '';
    case 'ansarian':
      return verse.translationAnsarian || verse.translationMakarem || '';
    case 'makarem':
    default:
      return verse.translationMakarem || verse.translationFooladvand || '';
  }
}

/**
 * موتور جستجوی آفلاین فوق‌سریع و هوشمند قرآن مبین
 */
export async function searchQuranOffline(options: SearchOptions): Promise<SearchResponse> {
  const startTime = performance.now();
  const {
    query,
    scope = 'all',
    surahId,
    juzNumber,
    activeTranslator = 'makarem',
    maxResults = 200,
  } = options;

  const cleanQuery = (query || '').trim();
  if (cleanQuery.length < 2) {
    return {
      results: [],
      totalMatches: 0,
      searchDurationMs: 0,
      source: 'offline_database',
    };
  }

  const normArabicQuery = normalizeArabicForSearch(cleanQuery);
  const normPersianQuery = normalizePersianForSearch(cleanQuery);

  // واکشی آیات بر اساس فیلتر سوره یا جزء از ایندکس محلی Dexie
  let candidateVerses: Verse[] = [];
  try {
    if (surahId && surahId > 0) {
      candidateVerses = await db.verses.where('surahId').equals(surahId).toArray();
    } else if (juzNumber && juzNumber > 0) {
      candidateVerses = await db.verses.where('juzNumber').equals(juzNumber).toArray();
    } else {
      candidateVerses = await db.verses.toArray();
    }
  } catch (err) {
    console.error('Failed to read verses from IndexedDB for search:', err);
    candidateVerses = [];
  }

  // آماده‌سازی نگاشت مشخصات سوره‌ها برای واکشی O(1)
  const surahMap = new Map<number, typeof ALL_SURAHS[0]>();
  ALL_SURAHS.forEach((s) => surahMap.set(s.id, s));

  interface ScoredResult {
    item: SearchResultItem;
    score: number;
  }

  const scoredResults: ScoredResult[] = [];

  for (const verse of candidateVerses) {
    let matchedInArabic = false;
    let matchedInTranslation = false;
    let maxVerseScore = 0;

    // ۱. جستجو در متن عربی (رسم‌الخط عثمانی + رسم‌الخط ساده املایی textSimple)
    if (scope === 'all' || scope === 'arabic') {
      const normUthmani = normalizeArabicForSearch(verse.textArabic);
      const normSimple = verse.textSimple ? normalizeArabicForSearch(verse.textSimple) : '';

      const scoreUthmani = calculateMatchScore(normUthmani, normArabicQuery);
      const scoreSimple = normSimple ? calculateMatchScore(normSimple, normArabicQuery) : 0;
      const bestArabicScore = Math.max(scoreUthmani, scoreSimple);

      if (bestArabicScore > 0) {
        matchedInArabic = true;
        // ضریب ۳ برای تطابق در متن قرآن (اولویت بالاتر)
        maxVerseScore = Math.max(maxVerseScore, bestArabicScore * 3);
      }
    }

    // ۲. جستجو در ترجمه‌ها
    if (scope === 'all' || scope === 'translation') {
      const activeTransText = getTranslationByTranslator(verse, activeTranslator);
      const normActiveTrans = normalizePersianForSearch(activeTransText);
      const activeScore = calculateMatchScore(normActiveTrans, normPersianQuery);

      if (activeScore > 0) {
        matchedInTranslation = true;
        maxVerseScore = Math.max(maxVerseScore, activeScore * 2);
      } else if (scope === 'all') {
        // جستجو در دو ترجمه دیگر در صورت عدم تطابق ترجمه فعال
        const mText = normalizePersianForSearch(verse.translationMakarem || '');
        const fText = normalizePersianForSearch(verse.translationFooladvand || '');
        const aText = normalizePersianForSearch(verse.translationAnsarian || '');

        const otherScore = Math.max(
          calculateMatchScore(mText, normPersianQuery),
          calculateMatchScore(fText, normPersianQuery),
          calculateMatchScore(aText, normPersianQuery)
        );

        if (otherScore > 0) {
          matchedInTranslation = true;
          maxVerseScore = Math.max(maxVerseScore, otherScore);
        }
      }
    }

    if (matchedInArabic || matchedInTranslation) {
      const surahMeta = surahMap.get(verse.surahId);
      const translationDisplay = getTranslationByTranslator(verse, activeTranslator);

      scoredResults.push({
        score: maxVerseScore,
        item: {
          id: verse.id,
          surahId: verse.surahId,
          surahNameArabic: surahMeta ? surahMeta.nameArabic : `سورة ${verse.surahId}`,
          surahNamePersian: surahMeta ? surahMeta.namePersian : `سوره ${verse.surahId}`,
          verseNumber: verse.verseNumber,
          pageNumber: verse.pageNumber,
          juzNumber: verse.juzNumber,
          textArabic: verse.textArabic,
          translation: translationDisplay,
          matchedIn: matchedInArabic ? 'arabic' : 'translation',
        },
      });
    }
  }

  // رتبه‌بندی نتایج: امتیاز بالاتر اول، سپس ترتیب تقدم در مصحف
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.item.id - b.item.id;
  });

  const totalMatches = scoredResults.length;
  const trimmedResults = scoredResults.slice(0, maxResults).map((s) => s.item);
  const searchDurationMs = Math.round(performance.now() - startTime);

  return {
    results: trimmedResults,
    totalMatches,
    searchDurationMs,
    source: 'offline_database',
  };
}
