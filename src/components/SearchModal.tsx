import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, BookOpen, Loader2, ChevronLeft, Sparkles, Filter, Zap } from 'lucide-react';
import { Surah, SearchResultItem } from '../types';
import { QuranService } from '../services/quranService';
import { toPersianDigits, parseJuzQuery, parsePageQuery } from '../utils/textNormalization';
import { getJuzStartInfo } from '../data/surahs';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  surahs: Surah[];
  onSelectResult: (surahId: number, verseNumber: number) => void;
  onNavigateToPage?: (pageNumber: number, forcePageMode?: boolean) => void;
  onNavigateToJuz?: (juzNumber: number, forcePageMode?: boolean) => void;
  darkMode: boolean;
}

const POPULAR_SEARCH_KEYWORDS = [
  'صبر',
  'تقوا',
  'توکل',
  'انفاق',
  'احسان',
  'نماز',
  'روزه',
  'بهشت',
  'بخشش',
  'اخلاص',
  'رحمت',
  'هدایت',
  'موسی',
  'ابراهیم',
  'الصلاة',
  'القرآن',
];

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  surahs,
  onSelectResult,
  onNavigateToPage,
  onNavigateToJuz,
  darkMode,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'arabic' | 'translation'>('all');
  const [selectedSurahFilter, setSelectedSurahFilter] = useState<number | 0>(0);
  const [selectedJuzFilter, setSelectedJuzFilter] = useState<number | 0>(0);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchTimeMs, setSearchTimeMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setResults([]);
      setTotalCount(0);
      setSearchTimeMs(0);
      setHasSearched(false);
      setError(null);
    }
  }, [isOpen]);

  const executeSearch = async (targetQuery: string, currentScope = scope, currentSurah = selectedSurahFilter, currentJuz = selectedJuzFilter) => {
    const clean = targetQuery.trim();
    if (clean.length < 2) {
      setResults([]);
      setTotalCount(0);
      setSearchTimeMs(0);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await QuranService.searchOffline(
        clean,
        currentScope,
        currentSurah > 0 ? currentSurah : undefined,
        currentJuz > 0 ? currentJuz : undefined
      );

      setResults(response.results);
      setTotalCount(response.totalMatches);
      setSearchTimeMs(response.searchDurationMs);
    } catch (err: any) {
      console.error('Search error:', err);
      setError('خطا در انجام جستجو در پایگاه داده قرآن.');
    } finally {
      setIsLoading(false);
    }
  };

  // جستجوی لحظه‌ای با تایپ کاربر (Debounce ۱۸۰ میلی‌ثانیه)
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(val, scope, selectedSurahFilter, selectedJuzFilter);
      }, 180);
    } else {
      setResults([]);
      setTotalCount(0);
      setHasSearched(false);
    }
  };

  const handleScopeChange = (newScope: 'all' | 'arabic' | 'translation') => {
    setScope(newScope);
    if (query.trim().length >= 2) {
      executeSearch(query, newScope, selectedSurahFilter, selectedJuzFilter);
    }
  };

  const handleSurahFilterChange = (surahId: number) => {
    setSelectedSurahFilter(surahId);
    if (query.trim().length >= 2) {
      executeSearch(query, scope, surahId, selectedJuzFilter);
    }
  };

  const handleJuzFilterChange = (juz: number) => {
    setSelectedJuzFilter(juz);
    if (query.trim().length >= 2) {
      executeSearch(query, scope, selectedSurahFilter, juz);
    }
  };

  const highlightMatch = (text: string, keyword: string) => {
    if (!text || !keyword) return text;
    // حذف علائم اضافی از کلمه جستجو برای ساخت ریجکس امن
    const cleanKw = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!cleanKw) return text;

    const parts = text.split(new RegExp(`(${cleanKw})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === cleanKw.toLowerCase() ? (
        <mark
          key={i}
          className="bg-amber-300/80 dark:bg-amber-600/70 text-slate-950 dark:text-white px-1 py-0.5 rounded font-bold"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // تشخیص هوشمند پرش به صفحه (صفحه ۲۵۰، ص ۱۲، یا عدد ۱ تا ۶۰۴)
  const detectedPage = useMemo(() => {
    return parsePageQuery(query);
  }, [query]);

  // تشخیص هوشمند پرش به جزء (جزء ۱۵، ج ۳، جزء چهارم، یا عدد ۱ تا ۳۰)
  const detectedJuz = useMemo(() => {
    return parseJuzQuery(query);
  }, [query]);

  // آیا کاربر کلمه «جزء» را برای مرور فهرست اجزاء وارد کرده است؟
  const isBrowsingAllJuz = useMemo(() => {
    const q = query.trim();
    return q === 'جزء' || q === 'جزء ها' || q === 'جزءها' || q === 'اجزاء';
  }, [query]);

  // تشخیص هوشمند سوره (یس، الرحمن، کهف یا شماره سوره)
  const detectedSurah = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    const cleanNum = q.replace(/^سوره\s*/, '').replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
    const num = parseInt(cleanNum, 10);
    if (!isNaN(num) && num >= 1 && num <= 114) {
      return surahs.find((s) => s.id === num) || null;
    }
    const cleanName = q.replace(/^سوره\s*/, '').trim();
    return (
      surahs.find(
        (s) =>
          s.nameArabic === cleanName ||
          s.namePersian === cleanName ||
          s.nameArabic.includes(cleanName) ||
          (s.namePersian && s.namePersian.includes(cleanName))
      ) || null
    );
  }, [query, surahs]);

  // مدیریت فشردن کلید اینتر در باکس جستجو جهت پرش فوری
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (detectedJuz && onNavigateToJuz) {
        onNavigateToJuz(detectedJuz, false);
        onClose();
      } else if (detectedPage && onNavigateToPage) {
        onNavigateToPage(detectedPage, false);
        onClose();
      } else if (detectedSurah) {
        onSelectResult(detectedSurah.id, 1);
        onClose();
      } else if (results.length > 0) {
        onSelectResult(results[0].surahId, results[0].verseNumber);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="search-modal-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-12 p-3 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="search-modal-container"
        className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl shadow-2xl border transition-all duration-200 overflow-hidden ${
          darkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-[#faf8f5] border-stone-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* نوار بالایی جستجو */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold">جستجوی هوشمند قرآن کریم</h2>
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-400 font-semibold border border-teal-500/20">
                    <Zap className="w-3 h-3 text-amber-500" />
                    ۱۰۰٪ آفلاین و آنی
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  جستجوی بی‌درنگ در رسم‌الخط عثمانی، متن ساده و ۳ ترجمه معتبر فارسی
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* فیلد ورودی کلمه */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="جستجوی کلمه، شماره صفحه (مثلاً ۴۵) یا جزء (مثلاً جزء ۳۰)..."
              className={`w-full pr-11 pl-20 py-3 rounded-2xl text-sm font-medium border transition-all outline-none ${
                darkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100 focus:border-teal-500 focus:bg-slate-800'
                  : 'bg-white border-stone-300 text-slate-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10'
              }`}
            />
            <Search className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-400" />

            <div className="absolute left-2 top-2 flex items-center gap-1">
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    setTotalCount(0);
                    setHasSearched(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="پاک کردن"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isLoading && <Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-1" />}
            </div>
          </div>

          {/* فیلترها: دامنه جستجو، سوره و جزء */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            {/* دامنه جستجو (عربی / ترجمه / همه) */}
            <div className="flex items-center gap-1 bg-stone-200/70 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => handleScopeChange('all')}
                className={`px-3 py-1 rounded-lg transition-all font-semibold ${
                  scope === 'all'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                همه
              </button>
              <button
                onClick={() => handleScopeChange('arabic')}
                className={`px-3 py-1 rounded-lg transition-all font-semibold ${
                  scope === 'arabic'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                متن عربی
              </button>
              <button
                onClick={() => handleScopeChange('translation')}
                className={`px-3 py-1 rounded-lg transition-all font-semibold ${
                  scope === 'translation'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                ترجمه فارسی
              </button>
            </div>

            {/* فیلتر سوره و جزء */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedSurahFilter}
                  onChange={(e) => handleSurahFilterChange(Number(e.target.value))}
                  className={`py-1 px-2 rounded-xl text-xs border outline-none font-medium ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200'
                      : 'bg-white border-stone-300 text-slate-700'
                  }`}
                >
                  <option value={0}>تمام سوره‌ها</option>
                  {surahs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}. سوره {s.nameArabic} ({s.namePersian})
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={selectedJuzFilter}
                onChange={(e) => handleJuzFilterChange(Number(e.target.value))}
                className={`py-1 px-2 rounded-xl text-xs border outline-none font-medium ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-white border-stone-300 text-slate-700'
                }`}
              >
                <option value={0}>تمام اجزاء</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>
                    جزء {toPersianDigits(j)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* کلمات کلیدی پیشنهادی */}
          {!hasSearched && (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>کلیدواژه‌های موضوعی پرکاربرد:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SEARCH_KEYWORDS.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => {
                      setQuery(kw);
                      executeSearch(kw);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-400 transition-all"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* لیست نتایج جستجو */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* کارت‌های پرش مستقیم هوشمند (صفحه، جزء، سوره و فهرست اجزاء) */}
          {(detectedPage || detectedJuz || detectedSurah || isBrowsingAllJuz) && (
            <div className="space-y-2.5 mb-3">
              {/* مرور فهرست کل اجزاء */}
              {isBrowsingAllJuz && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>انتخاب مستقیم هر یک از ۳۰ جزء قرآن کریم:</span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-1">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((jNum) => (
                      <button
                        key={jNum}
                        onClick={() => {
                          if (onNavigateToJuz) onNavigateToJuz(jNum, false);
                          onClose();
                        }}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 font-bold text-xs transition-all text-center"
                      >
                        جزء {toPersianDigits(jNum)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* کارت پرش به جزء */}
              {detectedJuz && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                      ۞
                    </div>
                    <div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        پرش مستقیم به آغاز جزء {toPersianDigits(detectedJuz)} قرآن کریم
                      </span>
                      {(() => {
                        const jInfo = getJuzStartInfo(detectedJuz);
                        return (
                          <div className="text-[11px] text-amber-700/90 dark:text-amber-400 mt-0.5">
                            سوره {jInfo.surahNameArabic} ({jInfo.surahNamePersian}) • آیه {toPersianDigits(jInfo.ayah)} • صفحه {toPersianDigits(jInfo.page)}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => {
                        if (onNavigateToJuz) onNavigateToJuz(detectedJuz, false);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all active:scale-95 shrink-0"
                    >
                      نمای آیه‌ای (آیه {toPersianDigits(getJuzStartInfo(detectedJuz).ayah)})
                    </button>
                    <button
                      onClick={() => {
                        if (onNavigateToJuz) onNavigateToJuz(detectedJuz, true);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold text-xs border border-amber-500/30 transition-all active:scale-95 shrink-0"
                    >
                      مشاهده در مصحف (صفحه {toPersianDigits(getJuzStartInfo(detectedJuz).page)})
                    </button>
                  </div>
                </div>
              )}

              {/* کارت پرش به صفحه */}
              {detectedPage && (
                <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
                      📖
                    </div>
                    <div>
                      <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                        پرش مستقیم به صفحه {toPersianDigits(detectedPage)} مصحف شریف
                      </span>
                      <div className="text-[11px] text-teal-700/90 dark:text-teal-400 mt-0.5">
                        انتقال دقیق به ابتدای صفحه {toPersianDigits(detectedPage)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => {
                        if (onNavigateToPage) onNavigateToPage(detectedPage, false);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 shrink-0"
                    >
                      نمای آیه‌ای
                    </button>
                    <button
                      onClick={() => {
                        if (onNavigateToPage) onNavigateToPage(detectedPage, true);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-900 dark:text-teal-200 font-bold text-xs border border-teal-500/30 transition-all active:scale-95 shrink-0"
                    >
                      مشاهده در مصحف
                    </button>
                  </div>
                </div>
              )}

              {/* کارت پرش به سوره */}
              {detectedSurah && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      سوره {detectedSurah.nameArabic} ({detectedSurah.namePersian}) • جزء {toPersianDigits(detectedSurah.juzNumber)} • {toPersianDigits(detectedSurah.versesCount)} آیه
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onSelectResult(detectedSurah.id, 1);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 shrink-0"
                  >
                    باز کردن سوره
                  </button>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-teal-600 dark:text-teal-400" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                در حال جستجوی آنی در پایگاه داده قرآن...
              </p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-500 font-medium">{error}</div>
          ) : hasSearched && results.length === 0 && !detectedPage && !detectedJuz && !detectedSurah && !isBrowsingAllJuz ? (
            <div className="py-12 text-center space-y-2">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                نتیجه‌ای برای «{query}» یافت نشد.
              </h3>
              <p className="text-xs text-slate-400">
                لطفاً املای کلمه را بررسی فرمایید یا با کلمه هم‌ریشه دیگری جستجو کنید.
              </p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <span>
                    {toPersianDigits(totalCount)} آیه یافت شد
                    {results.length < totalCount ? ` (نمایش ${toPersianDigits(results.length)} مورد برتر)` : ''}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-slate-800 text-slate-500">
                    زمان جستجو: {toPersianDigits(searchTimeMs)} میلی‌ثانیه
                  </span>
                </div>
                <span>کلیک روی هر آیه جهت باز کردن در مصحف</span>
              </div>

              {results.map((item) => {
                const matchedSurah = surahs.find((s) => s.id === item.surahId);
                return (
                  <div
                    key={`${item.surahId}-${item.verseNumber}-${item.id}`}
                    onClick={() => {
                      onSelectResult(item.surahId, item.verseNumber);
                      onClose();
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                      darkMode
                        ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-teal-500/50'
                        : 'bg-white border-stone-200 hover:border-teal-600 hover:shadow-md'
                    }`}
                  >
                    {/* مشخصات سوره و آیه */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-teal-700 dark:text-teal-400">
                          سوره {matchedSurah?.nameArabic || item.surahNameArabic}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          آیه {toPersianDigits(item.verseNumber)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          جزء {toPersianDigits(item.juzNumber)} • صفحه {toPersianDigits(item.pageNumber)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {item.matchedIn === 'arabic' ? 'متن قرآن' : 'ترجمه'}
                        </span>
                      </div>
                      <span className="text-xs text-teal-600 dark:text-teal-400 flex items-center gap-0.5 group-hover:translate-x-[-2px] transition-transform">
                        <span>مشاهده در مصحف</span>
                        <ChevronLeft className="w-4 h-4" />
                      </span>
                    </div>

                    {/* متن آیه عربی */}
                    {item.textArabic && (
                      <p
                        className="text-base font-['Amiri_Quran'] leading-relaxed text-slate-800 dark:text-slate-100 mb-1"
                        dir="rtl"
                      >
                        {highlightMatch(item.textArabic, query)}
                      </p>
                    )}

                    {/* ترجمه آیه */}
                    {item.translation && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                        {highlightMatch(item.translation, query)}
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <p>کلمه مورد نظر خود را در کادر بالا وارد فرمایید.</p>
              <p className="text-[11px]">
                موتور جستجو مجهز به اعراب‌زدایی هوشمند، یکسان‌سازی الف/ی، همپوشانی رسم‌الخط عثمانی و املایی، و جستجوی آفلاین در پایگاه داده داخلی می‌باشد.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
