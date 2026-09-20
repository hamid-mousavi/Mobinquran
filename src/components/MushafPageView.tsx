import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Volume2, Sparkles, BookOpen, Bookmark, Copy, Loader2, Info } from 'lucide-react';
import { Surah, Verse, AppSettings } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';

interface PageVerse {
  id: number;
  surahId: number;
  surahNameArabic: string;
  surahNamePersian: string;
  verseNumber: number;
  juzNumber: number;
  pageNumber: number;
  textArabic: string;
  translationMakarem: string;
}

interface MushafPageViewProps {
  initialPageNumber: number;
  surahs: Surah[];
  settings: AppSettings;
  darkMode: boolean;
  bookmarkedVerseIds: Set<number>;
  onToggleBookmark: (verseNumber: number) => void;
  onOpenVerseDetail: (verse: Verse) => void;
  onOpenAIForVerse: (verse: Verse) => void;
  onPlayVerseAudio: (verseNumber: number) => void;
  onPageChange: (newPage: number) => void;
}

export const MushafPageView: React.FC<MushafPageViewProps> = ({
  initialPageNumber,
  surahs,
  settings,
  darkMode,
  bookmarkedVerseIds,
  onToggleBookmark,
  onOpenVerseDetail,
  onOpenAIForVerse,
  onPlayVerseAudio,
  onPageChange,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPageNumber || 1);
  const [verses, setVerses] = useState<PageVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<PageVerse | null>(null);
  const [isJumpInputOpen, setIsJumpInputOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState(String(initialPageNumber || 1));

  const pageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPageNumber && initialPageNumber !== currentPage) {
      setCurrentPage(initialPageNumber);
    }
  }, [initialPageNumber]);

  // بارگذاری آیات صفحه جاری
  useEffect(() => {
    let isCancelled = false;
    async function loadPageData(pageNum: number) {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/quran/page/${pageNum}`);
        if (!res.ok) throw new Error('خطا در دریافت صفحه مصحف');
        const data = await res.json();
        if (!isCancelled && data.verses) {
          setVerses(data.verses);
          setSelectedVerse(null);
          onPageChange(pageNum);
        }
      } catch (err) {
        console.error('Error loading mushaf page:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPageData(currentPage);
    return () => {
      isCancelled = true;
    };
  }, [currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < 604) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= 604) {
      setCurrentPage(target);
      setIsJumpInputOpen(false);
    }
  };

  // گروه‌بندی آیات این صفحه بر اساس سوره
  const surahsOnThisPage: { surah: Surah; verses: PageVerse[] }[] = [];
  verses.forEach((v) => {
    let group = surahsOnThisPage.find((g) => g.surah.id === v.surahId);
    if (!group) {
      const s = surahs.find((item) => item.id === v.surahId) || {
        id: v.surahId,
        nameArabic: v.surahNameArabic,
        namePersian: v.surahNamePersian,
        englishName: '',
        revelationType: 'Meccan',
        versesCount: 0,
        startPage: currentPage,
        juzNumber: v.juzNumber,
      };
      group = { surah: s, verses: [] };
      surahsOnThisPage.push(group);
    }
    group.verses.push(v);
  });

  const currentJuz = verses[0]?.juzNumber || 1;

  // تبدیل آیه صفحه به مدل کامل Verse جهت ارسال به مودال تفسیر و تدبّر
  const toFullVerse = (pv: PageVerse): Verse => ({
    id: pv.id,
    surahId: pv.surahId,
    verseNumber: pv.verseNumber,
    juzNumber: pv.juzNumber,
    pageNumber: pv.pageNumber,
    textArabic: pv.textArabic,
    translationMakarem: pv.translationMakarem,
    translationFooladvand: '',
    translationAnsarian: '',
  });

  return (
    <div id="mushaf-page-container" className="max-w-3xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* نوار بالایی مصحف (شماره جزء، سوره، و ناوبری صفحات) */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border transition-all ${
          darkMode
            ? 'bg-slate-900 border-slate-800 text-slate-200'
            : 'bg-white border-stone-200 text-slate-800 shadow-xs'
        }`}
      >
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1 || isLoading}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
          title="صفحه قبل"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="hidden sm:inline">صفحه قبل</span>
        </button>

        {/* سربرگ صفحه مصحف */}
        <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-center">
          <span className="text-teal-700 dark:text-teal-400">جزء {currentJuz}</span>
          <span className="opacity-30">•</span>
          {isJumpInputOpen ? (
            <form onSubmit={handleJumpToPage} className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={604}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                autoFocus
                className="w-16 px-1.5 py-0.5 rounded border text-center font-bold text-xs bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-teal-700 text-white text-xs font-bold"
              >
                برو
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setJumpPageInput(String(currentPage));
                setIsJumpInputOpen(true);
              }}
              className="px-2 py-0.5 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400"
              title="کلیک جهت پرش به صفحه دلخواه"
            >
              صفحه {currentPage} از ۶۰۴ ✎
            </button>
          )}
          <span className="opacity-30">•</span>
          <span className="text-slate-600 dark:text-slate-300">
            {surahsOnThisPage.map((s) => s.surah.nameArabic).join('، ')}
          </span>
        </div>

        <button
          onClick={handleNextPage}
          disabled={currentPage >= 604 || isLoading}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
          title="صفحه بعد"
        >
          <span className="hidden sm:inline">صفحه بعد</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* قاب تزئینی مصحف شریف عثمان‌طه */}
      <div
        ref={pageContainerRef}
        className={`relative p-5 sm:p-8 rounded-3xl border-2 transition-all duration-300 shadow-md ${
          darkMode
            ? 'bg-slate-900 border-amber-500/20 text-slate-100'
            : 'bg-[#fcfaf6] border-[#d4b982]/60 text-slate-900 shadow-stone-200'
        }`}
      >
        {/* کادر تذهیب گوشه‌های صفحه مصحف */}
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-600/40 pointer-events-none" />
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-600/40 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-600/40 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-600/40 pointer-events-none" />

        {isLoading ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-teal-600 dark:text-teal-400" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              در حال بازخوانی صفحه {currentPage} مصحف شریف مدینه...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {surahsOnThisPage.map((group) => {
              const isSurahStart = group.verses.some((v) => v.verseNumber === 1);
              return (
                <div key={group.surah.id} className="space-y-4">
                  {/* کتیبه سرسوره اگر آیه ۱ در این صفحه باشد */}
                  {isSurahStart && (
                    <div className="text-center space-y-3 pt-2">
                      <div
                        className={`inline-block w-full max-w-lg py-2.5 px-6 rounded-2xl border text-center relative ${
                          darkMode
                            ? 'bg-gradient-to-r from-slate-900 via-teal-950/40 to-slate-900 border-amber-500/30'
                            : 'bg-gradient-to-r from-amber-50 via-[#f7f0df] to-amber-50 border-[#d4b982]'
                        }`}
                      >
                        <h3 className="font-['Amiri_Quran'] font-bold text-xl sm:text-2xl text-amber-800 dark:text-amber-400">
                          سُورَةُ {group.surah.nameArabic}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {group.surah.revelationType === 'Meccan' ? 'مَكِّيَّة' : 'مَدَنِيَّة'} • {group.surah.versesCount} آيَات
                        </p>
                      </div>

                      {/* بسمله (به جز سوره توبه) */}
                      {group.surah.id !== 9 && (
                        <p className="font-['Amiri_Quran'] text-lg sm:text-xl text-amber-900 dark:text-amber-300 py-1">
                          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                        </p>
                      )}
                    </div>
                  )}

                  {/* متن پیوسته آیات صفحه با علائم عثمان‌طه */}
                  <div
                    className="text-justify leading-[2.6] tracking-normal text-slate-800 dark:text-slate-100"
                    style={{
                      fontFamily: getArabicFontFamily(settings.arabicFont),
                      fontSize: `${settings.arabicFontSize}px`,
                    }}
                    dir="rtl"
                  >
                    {group.verses.map((v) => {
                      const isSelected = selectedVerse?.id === v.id;
                      return (
                        <span
                          key={v.id}
                          onClick={() => setSelectedVerse(isSelected ? null : v)}
                          className={`inline cursor-pointer px-1 py-0.5 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-amber-300/40 dark:bg-amber-500/30 text-amber-950 dark:text-amber-200'
                              : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                          }`}
                          title={`سوره ${v.surahNameArabic} - آیه ${v.verseNumber} (کلیک جهت مشاهده ترجمه و تفسیر)`}
                        >
                          {v.textArabic}{' '}
                          <span className="inline-flex items-center justify-center text-amber-700 dark:text-amber-400 text-sm font-bold select-none px-1">
                            ﴿{v.verseNumber}﴾
                          </span>{' '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* فوتر شماره صفحه */}
        <div className="mt-8 pt-4 border-t border-stone-200 dark:border-slate-800 text-center text-xs font-bold text-slate-400">
          — {currentPage} —
        </div>
      </div>

      {/* نوار شناور مشخصات و ترجمه آیه انتخاب شده در صفحه */}
      {selectedVerse && (
        <div
          className={`p-4 rounded-2xl border transition-all space-y-3 animate-fadeIn shadow-lg ${
            darkMode
              ? 'bg-slate-900 border-slate-700 text-slate-100'
              : 'bg-white border-stone-300 text-slate-800'
          }`}
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-teal-700 dark:text-teal-400">
                سوره {selectedVerse.surahNameArabic} • آیه {selectedVerse.verseNumber}
              </span>
              <span className="text-xs text-slate-400">
                (صفحه {selectedVerse.pageNumber}، جزء {selectedVerse.juzNumber})
              </span>
            </div>

            {/* کلیدهای سریع آیه انتخاب شده */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPlayVerseAudio(selectedVerse.verseNumber)}
                className="p-1.5 rounded-lg bg-teal-600/10 text-teal-700 dark:text-teal-400 hover:bg-teal-600/20"
                title="تلاوت صوتی این آیه"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => onOpenVerseDetail(toFullVerse(selectedVerse))}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-600 dark:text-slate-300"
                title="تفسیر المیزان و نمونه"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <button
                onClick={() => onOpenAIForVerse(toFullVerse(selectedVerse))}
                className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
                title="تدبّر هوشمند"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button
                onClick={() => onToggleBookmark(selectedVerse.verseNumber)}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-600 dark:text-slate-300"
                title="نشانه‌گذاری"
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    bookmarkedVerseIds.has(selectedVerse.verseNumber)
                      ? 'fill-amber-500 text-amber-500'
                      : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ترجمه فارسی روان */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-slate-800 dark:text-slate-200">ترجمه آیت‌الله مکارم: </span>
            {selectedVerse.translationMakarem}
          </p>
        </div>
      )}
    </div>
  );
};
