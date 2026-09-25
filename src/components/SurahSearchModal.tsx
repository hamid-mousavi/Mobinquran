import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown, ArrowRight, BookOpen } from 'lucide-react';
import { Surah, Verse } from '../types';
import { toPersianDigits, normalizeArabicForSearch, normalizePersianForSearch } from '../utils/textNormalization';

interface SurahSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSurah: Surah;
  verses: Verse[];
  onSelectVerse: (verseNumber: number) => void;
  darkMode: boolean;
}

export const SurahSearchModal: React.FC<SurahSearchModalProps> = ({
  isOpen,
  onClose,
  currentSurah,
  verses,
  onSelectVerse,
  darkMode,
}) => {
  const [query, setQuery] = useState('');
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setSelectedMatchIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // فیلتر کردن هوشمند آیات سوره بر اساس عربی یا ترجمه
  const matches = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const normQueryArabic = normalizeArabicForSearch(trimmed);
    const normQueryPersian = normalizePersianForSearch(trimmed);

    return verses.filter((verse) => {
      const matchArabic = normalizeArabicForSearch(verse.textArabic).includes(normQueryArabic);
      const matchMakarem = verse.translationMakarem
        ? normalizePersianForSearch(verse.translationMakarem).includes(normQueryPersian)
        : false;
      const matchAnsarian = verse.translationAnsarian
        ? normalizePersianForSearch(verse.translationAnsarian).includes(normQueryPersian)
        : false;
      const matchFooladvand = verse.translationFooladvand
        ? normalizePersianForSearch(verse.translationFooladvand).includes(normQueryPersian)
        : false;

      return matchArabic || matchMakarem || matchAnsarian || matchFooladvand;
    });
  }, [query, verses]);

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = (selectedMatchIndex + 1) % matches.length;
    setSelectedMatchIndex(nextIdx);
    onSelectVerse(matches[nextIdx].verseNumber);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prevIdx = (selectedMatchIndex - 1 + matches.length) % matches.length;
    setSelectedMatchIndex(prevIdx);
    onSelectVerse(matches[prevIdx].verseNumber);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-3 sm:pt-16 p-3 bg-black/60 backdrop-blur-xs animate-fadeIn font-['Vazirmatn'] select-none"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl transition-all overflow-hidden flex flex-col max-h-[85vh] ${
          darkMode
            ? 'bg-slate-900 border-slate-700/80 text-slate-100 shadow-black/80'
            : 'bg-white border-stone-200 text-slate-800 shadow-slate-400/30'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* نوار جستجوی سوره */}
        <div className="p-3.5 border-b border-stone-200 dark:border-slate-800 bg-stone-50/80 dark:bg-slate-800/50 flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 shrink-0">
            <Search className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (matches.length > 0) {
                    onSelectVerse(matches[selectedMatchIndex].verseNumber);
                    onClose();
                  }
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }}
              placeholder={`جستجو در سورهٔ ${currentSurah.nameArabic} (عربی یا ترجمه)...`}
              className="w-full bg-transparent border-0 outline-hidden text-sm sm:text-base font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
              title="پاک‌کردن متن"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* کلیدهای ناوبری بین یافته‌ها */}
          {matches.length > 1 && (
            <div className="flex items-center gap-1 border-r border-stone-300 dark:border-slate-700 pr-2">
              <button
                onClick={handlePrevMatch}
                className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="مورد قبلی"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMatch}
                className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="مورد بعدی"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors shrink-0"
            title="بستن جستجو"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* وضعیت نتایج و تعداد */}
        <div className="px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-stone-100 dark:border-slate-800/80 bg-stone-100/40 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>سوره {currentSurah.nameArabic} ({toPersianDigits(currentSurah.versesCount)} آیه)</span>
          </div>
          {query.trim().length >= 2 && (
            <span>
              {matches.length > 0
                ? `${toPersianDigits(matches.length)} آیه یافت شد`
                : 'موردی یافت نشد'}
            </span>
          )}
        </div>

        {/* لیست آیات یافته‌شده */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-stone-100 dark:divide-slate-800/60">
          {query.trim().length < 2 ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
              عبارت مورد نظر خود را برای جستجو در آیات یا ترجمهٔ سوره {currentSurah.nameArabic} بنویسید…
            </div>
          ) : matches.length === 0 ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
              عبارت «{query}» در سوره مبارکه {currentSurah.nameArabic} یافت نشد.
            </div>
          ) : (
            matches.map((verse, idx) => {
              const isSelected = idx === selectedMatchIndex;
              return (
                <button
                  key={verse.id}
                  onClick={() => {
                    onSelectVerse(verse.verseNumber);
                    onClose();
                  }}
                  className={`w-full text-right p-3 rounded-xl transition-all flex flex-col gap-1.5 pt-3 ${
                    isSelected
                      ? 'bg-teal-50 dark:bg-teal-950/40 border border-teal-500/40 ring-1 ring-teal-500/20'
                      : 'hover:bg-stone-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
                      آیه {toPersianDigits(verse.verseNumber)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      صفحه {toPersianDigits(verse.pageNumber)} • جزء {toPersianDigits(verse.juzNumber)}
                    </span>
                  </div>

                  <p
                    className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100 line-clamp-2"
                    style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                  >
                    {verse.textArabic}
                  </p>

                  {verse.translationMakarem && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">
                      {verse.translationMakarem}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
