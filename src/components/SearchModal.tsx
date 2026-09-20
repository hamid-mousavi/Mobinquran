import React, { useState, useEffect, useRef } from 'react';
import { Search, X, BookOpen, Loader2, ChevronLeft, Sparkles, Filter, Database, Globe, WifiOff } from 'lucide-react';
import { Surah, SearchResultItem } from '../types';
import { QuranService } from '../services/quranService';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  surahs: Surah[];
  onSelectResult: (surahId: number, verseNumber: number) => void;
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
];

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  surahs,
  onSelectResult,
  darkMode,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'arabic' | 'translation'>('all');
  const [searchSource, setSearchSource] = useState<'auto' | 'offline' | 'online'>('auto');
  const [selectedSurahFilter, setSelectedSurahFilter] = useState<number | 0>(0);
  const [results, setResults] = useState<(SearchResultItem & { isOfflineResult?: boolean })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualSourceUsed, setActualSourceUsed] = useState<'online' | 'offline' | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setError(null);
      setActualSourceUsed(null);
    }
  }, [isOpen]);

  const handleSearch = async (searchTerm?: string) => {
    const q = (searchTerm !== undefined ? searchTerm : query).trim();
    if (q.length < 2) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setActualSourceUsed(null);

    // حالت ۱: کاربر صراحتاً جستجوی آفلاین را خواسته است
    if (searchSource === 'offline') {
      try {
        const offlineData = await QuranService.searchOffline(
          q,
          scope,
          selectedSurahFilter > 0 ? selectedSurahFilter : undefined
        );
        setResults(offlineData.results || []);
        setActualSourceUsed('offline');
      } catch (err: any) {
        console.error('Offline search failed:', err);
        setError('خطا در جستجو در دیتابیس آفلاین محلی.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // حالت ۲: حالت خودکار (تلاش آنلاین، و در صورت قطعی یا خطا فال‌بک آفلاین) یا آنلاین صِرف
    try {
      let url = `/api/quran/search?q=${encodeURIComponent(q)}&scope=${scope}`;
      if (selectedSurahFilter > 0) {
        url += `&surahId=${selectedSurahFilter}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('خطا در ارتباط با سرور آنلاین');
      }

      const data = await res.json();
      const onlineResults = (data.results || []).map((r: any) => ({ ...r, isOfflineResult: false }));

      // اگر در حالت auto نتیجه آنلاین کم بود یا خالی بود، با آفلاین هم ترکیب کنیم
      if (searchSource === 'auto' && onlineResults.length === 0) {
        const offlineData = await QuranService.searchOffline(
          q,
          scope,
          selectedSurahFilter > 0 ? selectedSurahFilter : undefined
        );
        if (offlineData.results && offlineData.results.length > 0) {
          setResults(offlineData.results);
          setActualSourceUsed('offline');
          setIsLoading(false);
          return;
        }
      }

      setResults(onlineResults);
      setActualSourceUsed('online');
    } catch (err: any) {
      console.warn('Online search failed, checking offline database fallback:', err);
      // فال‌بک خودکار به دیتابیس آفلاین محلی
      try {
        const offlineData = await QuranService.searchOffline(
          q,
          scope,
          selectedSurahFilter > 0 ? selectedSurahFilter : undefined
        );
        setResults(offlineData.results || []);
        setActualSourceUsed('offline');
      } catch (offlineErr) {
        setError('ارتباط با سرور برقرار نشد و جستجوی آفلاین نیز با خطا مواجه شد.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const highlightMatch = (text: string, keyword: string) => {
    if (!text || !keyword) return text;
    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 dark:bg-amber-600/60 text-slate-950 dark:text-white px-1 py-0.5 rounded font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
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
                <h2 className="text-base sm:text-lg font-bold">جستجوی قرآن کریم</h2>
                <p className="text-[11px] text-slate-400">جستجوی هوشمند آنلاین و دیتابیس آفلاین محلی دستگاه</p>
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
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="جستجوی کلمه، عبارت قرآنی یا مفاهیم فارسی (صبر، تقوا، انفاق)..."
              className={`w-full pr-11 pl-24 py-3 rounded-2xl text-sm font-medium border transition-all outline-none ${
                darkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100 focus:border-teal-500 focus:bg-slate-800'
                  : 'bg-white border-stone-300 text-slate-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10'
              }`}
            />
            <Search className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-400" />
            
            <div className="absolute left-2 top-2 flex items-center gap-1">
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleSearch()}
                disabled={isLoading || query.trim().length < 2}
                className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs disabled:opacity-50 transition-all"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بیاب'}
              </button>
            </div>
          </div>

          {/* انتخاب منبع جستجو (آفلاین / خودکار / آنلاین) و دامنه */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            {/* کلیدهای انتخاب منبع داده: دیتابیس آفلاین یا آنلاین */}
            <div className="flex items-center gap-1 bg-stone-200/70 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setSearchSource('auto')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-semibold ${
                  searchSource === 'auto'
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="جستجوی همگام آنلاین و آفلاین"
              >
                <span>خودکار</span>
              </button>
              <button
                onClick={() => setSearchSource('offline')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-semibold ${
                  searchSource === 'offline'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="جستجوی بدون اینترنت از حافظه داخلی و دیتابیس دستگاه"
              >
                <Database className="w-3 h-3" />
                <span>دیتابیس آفلاین</span>
              </button>
              <button
                onClick={() => setSearchSource('online')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-semibold ${
                  searchSource === 'online'
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="جستجو از سرور ابری"
              >
                <Globe className="w-3 h-3" />
                <span>آنلاین</span>
              </button>
            </div>

            {/* دامنه جستجو (عربی / ترجمه / همه) */}
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-slate-800/60 p-1 rounded-xl">
              <button
                onClick={() => setScope('all')}
                className={`px-2 py-0.5 rounded-lg transition-all font-medium ${
                  scope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                همه
              </button>
              <button
                onClick={() => setScope('arabic')}
                className={`px-2 py-0.5 rounded-lg transition-all font-medium ${
                  scope === 'arabic'
                    ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                عربی
              </button>
              <button
                onClick={() => setScope('translation')}
                className={`px-2 py-0.5 rounded-lg transition-all font-medium ${
                  scope === 'translation'
                    ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ترجمه
              </button>
            </div>

            {/* فیلتر سوره */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedSurahFilter}
                onChange={(e) => setSelectedSurahFilter(Number(e.target.value))}
                className={`py-1 px-2.5 rounded-xl text-xs border outline-none font-medium ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-white border-stone-300 text-slate-700'
                }`}
              >
                <option value={0}>تمام ۱۱۴ سوره</option>
                {surahs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. سوره {s.nameArabic} ({s.namePersian})
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
                      handleSearch(kw);
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
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-teal-600 dark:text-teal-400" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                در حال جستجوی کلمه «{query}» {searchSource === 'offline' ? 'در دیتابیس آفلاین محلی...' : 'در قرآن کریم...'}
              </p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-500 font-medium">
              {error}
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                نتیجه‌ای برای «{query}» یافت نشد.
              </h3>
              <p className="text-xs text-slate-400">
                {searchSource === 'offline'
                  ? 'می‌توانید منبع را روی حالت «خودکار» قرار دهید تا در صورت نیاز سرور آنلاین نیز بررسی شود.'
                  : 'لطفاً املای کلمه را بررسی فرمایید یا با کلمه هم‌ریشه دیگری جستجو کنید.'}
              </p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <span>{results.length} آیه مرتبط یافت شد</span>
                  {actualSourceUsed === 'offline' && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30">
                      <Database className="w-3 h-3" />
                      استخراج از دیتابیس آفلاین
                    </span>
                  )}
                  {actualSourceUsed === 'online' && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-400 font-semibold border border-teal-500/30">
                      <Globe className="w-3 h-3" />
                      سرور آنلاین
                    </span>
                  )}
                </div>
                <span>کلیک روی هر آیه جهت انتقال به مصحف</span>
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
                          آیه {item.verseNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          جزء {item.juzNumber} • صفحه {item.pageNumber}
                        </span>
                        {item.isOfflineResult && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            آفلاین
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-teal-600 dark:text-teal-400 flex items-center gap-0.5 group-hover:translate-x-[-2px] transition-transform">
                        <span>مشاهده در مصحف</span>
                        <ChevronLeft className="w-4 h-4" />
                      </span>
                    </div>

                    {/* متن آیه عربی یا ترجمه */}
                    {item.textArabic && (
                      <p
                        className="text-base font-['Amiri_Quran'] leading-relaxed text-slate-800 dark:text-slate-100 mb-1"
                        dir="rtl"
                      >
                        {highlightMatch(item.textArabic, query)}
                      </p>
                    )}

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
              <p>کلمه مورد نظر خود را در کادر بالا وارد کرده و کلید جستجو را لمس فرمایید.</p>
              <p className="text-[11px]">جستجوی عربی مجهز به اعراب‌زدایی هوشمند، یکسان‌سازی الف و ی، و جستجوی آفلاین در پایگاه داده داخلی می‌باشد.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
