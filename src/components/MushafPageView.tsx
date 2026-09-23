import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Volume2, Sparkles, BookOpen, Bookmark, Loader2, Share2 } from 'lucide-react';
import { Surah, Verse, AppSettings } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';
import { shareAyah } from '../utils/shareAyah';
import { QuranService } from '../services/quranService';
import { QuranicSurahBanner } from './QuranicOrnament';
import { AyahEndMarker } from './QuranReader';
import { toPersianDigits } from '../utils/textNormalization';

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
  onPageChange: (newPage: number, surahId?: number, verseNumber?: number) => void;
}

function getTranslationDisplay(verse: Verse, settings: AppSettings): string {
  switch (settings.activeTranslator) {
    case 'fooladvand':
      return verse.translationFooladvand || verse.translationMakarem || '';
    case 'ansarian':
      return verse.translationAnsarian || verse.translationMakarem || '';
    case 'makarem':
    default:
      return verse.translationMakarem || verse.translationFooladvand || '';
  }
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
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [isJumpInputOpen, setIsJumpInputOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState(String(initialPageNumber || 1));
  const [isPartNavOpen, setIsPartNavOpen] = useState(false);

  const pageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPageNumber && initialPageNumber !== currentPage) {
      setCurrentPage(initialPageNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPageNumber]);

  // بارگذاری آیات صفحهٔ جاری به‌صورت کاملاً آفلاین از دیتابیس محلی (P3-T2)
  useEffect(() => {
    let isCancelled = false;
    async function loadPageData(pageNum: number) {
      setIsLoading(true);
      const pageVerses = await QuranService.getVersesByPage(pageNum);
      if (isCancelled) return;
      setVerses(pageVerses);
      setSelectedVerse(null);
      if (pageVerses.length > 0) {
        onPageChange(pageNum, pageVerses[0].surahId, pageVerses[0].verseNumber);
      }
      setIsLoading(false);
    }

    loadPageData(currentPage);
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ناوبری با کیبورد (P3-T6): در RTL فلش راست = صفحهٔ قبل و فلش چپ = صفحهٔ بعد
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (isLoading) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handlePrevPage();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleNextPage();
    }
  };

  // گروه‌بندی آیات این صفحه بر اساس سوره
  const surahsOnThisPage: { surah: Surah; verses: Verse[] }[] = [];
  verses.forEach((v) => {
    let group = surahsOnThisPage.find((g) => g.surah.id === v.surahId);
    if (!group) {
      const meta = surahs.find((item) => item.id === v.surahId);
      group = {
        surah: meta || {
          id: v.surahId,
          nameArabic: `سورة ${v.surahId}`,
          namePersian: `سوره ${v.surahId}`,
          englishName: '',
          revelationType: 'Meccan',
          versesCount: 0,
          startPage: currentPage,
          juzNumber: v.juzNumber,
        },
        verses: [],
      };
      surahsOnThisPage.push(group);
    }
    group.verses.push(v);
  });

  const currentJuz = verses[0]?.juzNumber || 1;
  const currentHizbQuarter = verses[0]?.hizbQuarter;

  const renderSajdaMark = (verse: Verse) => {
    if (!verse.sajda) return null;
    const isObligatory = verse.sajda.obligatory;
    return (
      <span
        className="inline-flex items-center justify-center mx-1 text-red-600 dark:text-red-400 font-bold select-none text-sm"
        title={isObligatory ? 'آیهٔ سجدهٔ واجب ✋' : 'آیهٔ سجدهٔ مستحب ✋'}
        aria-label={isObligatory ? 'آیه سجده واجب' : 'آیه سجده مستحب'}
      >
        ۩
      </span>
    );
  };

  return (
    <div id="mushaf-page-container" className="max-w-3xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* نوار بالایی مصحف (شماره جزء، ربع حزب، سوره، و ناوبری صفحات) */}
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
          aria-label="صفحه قبل"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="hidden sm:inline">صفحه قبل</span>
        </button>

        {/* سربرگ صفحه مصحف */}
        <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-center">
          <span className="text-teal-700 dark:text-teal-400">جزء {toPersianDigits(currentJuz)}</span>
          {currentHizbQuarter ? (
            <>
              <span className="opacity-30">•</span>
              <span className="text-slate-500 dark:text-slate-400">ربع {toPersianDigits(currentHizbQuarter)}</span>
            </>
          ) : null}
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
              صفحه {toPersianDigits(currentPage)} از ۶۰۴ ✎
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
          aria-label="صفحه بعد"
        >
          <span className="hidden sm:inline">صفحه بعد</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* ناوبری اجزاء و احزاب */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setIsPartNavOpen((v) => !v)}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
            darkMode
              ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
              : 'bg-white border-stone-200 text-teal-800 hover:bg-slate-50'
          }`}
          aria-expanded={isPartNavOpen}
        >
          جزء / حزب 📖
        </button>
      </div>

      {isPartNavOpen && (
        <div
          className={`rounded-2xl border p-3 space-y-2 ${
            darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-stone-200'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-400">شروع جزء ۳۰ گانه</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
              <button
                key={`juz-${juz}`}
                onClick={() => {
                  setIsPartNavOpen(false);
                  QuranService.getJuzStartPage(juz).then((page) => {
                    if (page) setCurrentPage(page);
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  juz === currentJuz
                    ? 'bg-teal-600 text-white border-teal-600'
                    : darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-teal-500'
                    : 'bg-slate-50 border-stone-200 text-slate-600 hover:border-teal-500'
                }`}
              >
                جزء {toPersianDigits(juz)}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-bold text-slate-400 pt-1">شروع ربع حزب ۶۰ گانه</div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {Array.from({ length: 60 }, (_, i) => i + 1).map((hizb) => (
              <button
                key={`hizb-${hizb}`}
                onClick={() => {
                  setIsPartNavOpen(false);
                  QuranService.getHizbStartPage(hizb).then((page) => {
                    if (page) setCurrentPage(page);
                  });
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                  hizb === currentHizbQuarter
                    ? 'bg-amber-600 text-white border-amber-600'
                    : darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500'
                    : 'bg-slate-50 border-stone-200 text-slate-600 hover:border-amber-500'
                }`}
              >
                {toPersianDigits(hizb)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* قاب تزئینی نمایهٔ صفحه‌ای (رندر بر اساس دیتابیس موجود؛ چیدمان ۱۵ خطی در P3-T3) */}
      <div
        ref={pageContainerRef}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        className={`relative p-5 sm:p-8 rounded-3xl border-2 transition-all duration-300 shadow-md outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
          darkMode
            ? 'bg-slate-900 border-amber-500/20 text-slate-100'
            : 'bg-[#fcfaf6] border-[#d4b982]/60 text-slate-900 shadow-stone-200'
        }`}
        aria-label="نمای صفحه مصحف — برای صفخهٔ قبل و بعد از کلیدهای جهتنما استفاده کنید"
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
              در حال بازخوانی صفحه {currentPage} از دیتابیس محلی...
            </p>
          </div>
        ) : verses.length === 0 ? (
          <div className="py-24 text-center text-sm text-slate-500 dark:text-slate-400">
            آیات این صفحه در دسترس نیست. لطفاً یکبار به اینترنت متصل شوید تا بستهٔ داده نصب شود.
          </div>
        ) : (
          <div className="space-y-6">
            {surahsOnThisPage.map((group) => {
              const isSurahStart = group.verses.some((v) => v.verseNumber === 1);
              return (
                <div key={group.surah.id} className="space-y-4">
                  {/* کتیبه سرسوره اگر آیه ۱ در این صفحه باشد */}
                  {isSurahStart && (
                    <div className="text-center space-y-2 pt-1 pb-1">
                      <QuranicSurahBanner surah={group.surah} darkMode={darkMode} />

                      {/* بسمله: به جز سورهٔ توبه (بدون بسمله) و فاتحه (آیهٔ ۱ خودش بسمله است - رفع تکرار) */}
                      {group.surah.id !== 1 && group.surah.id !== 9 && (
                        <p
                          className={`text-center py-1 text-lg sm:text-xl font-medium select-none ${
                            darkMode ? 'text-amber-300/90' : 'text-amber-800'
                          }`}
                          style={{
                            fontFamily: getArabicFontFamily(settings.arabicFont),
                          }}
                          dir="rtl"
                        >
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </p>
                      )}
                    </div>
                  )}

                  {/* متن پیوسته آیات صفحه */}
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
                              ? 'bg-amber-300/40 dark:bg-amber-500/30 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500/40'
                              : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                          }`}
                          title={`سوره ${group.surah.nameArabic} - آیه ${v.verseNumber} (کلیک جهت مشاهده ترجمه و تفاسیر)`}
                        >
                          {v.textArabic}
                          <AyahEndMarker verseNumber={v.verseNumber} isCurrentlyPlaying={isSelected} />
                          {renderSajdaMark(v)}
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
          — {toPersianDigits(currentPage)} —
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
                سوره {surahs.find((s) => s.id === selectedVerse.surahId)?.nameArabic || selectedVerse.surahId} • آیه {selectedVerse.verseNumber}
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
                aria-label="تلاوت صوتی این آیه"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => onOpenVerseDetail(selectedVerse)}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-600 dark:text-slate-300"
                title="مشاهده ترجمه‌ها و تفاسیر"
                aria-label="مشاهده ترجمه‌ها و تفاسیر"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <button
                onClick={() => onOpenAIForVerse(selectedVerse)}
                className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
                title="تدبّر هوشمند"
                aria-label="تدبر هوشمند"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button
                onClick={() => onToggleBookmark(selectedVerse.verseNumber)}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-600 dark:text-slate-300"
                title="نشانه‌گذاری"
                aria-label="نشانه‌گذاری"
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    bookmarkedVerseIds.has(selectedVerse.verseNumber)
                      ? 'fill-amber-500 text-amber-500'
                      : ''
                  }`}
                />
              </button>

              <button
                onClick={() =>
                  shareAyah(selectedVerse, getTranslationDisplay(selectedVerse, settings), surahs.find((s) => s.id === selectedVerse.surahId) || {
                    id: selectedVerse.surahId,
                    nameArabic: `سورة ${selectedVerse.surahId}`,
                    namePersian: `سوره ${selectedVerse.surahId}`,
                    englishName: '',
                    revelationType: 'Meccan',
                    versesCount: 0,
                    startPage: selectedVerse.pageNumber,
                    juzNumber: selectedVerse.juzNumber,
                  })
                }
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-600 dark:text-slate-300"
                title="اشتراک‌گذاری آیه"
                aria-label="اشتراک‌گذاری آیه"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ترجمه فارسی بر اساس مترجم انتخابی */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {settings.activeTranslator === 'makarem'
                ? 'ترجمه آیت‌الله مکارم: '
                : settings.activeTranslator === 'fooladvand'
                ? 'ترجمه استاد فولادوند: '
                : 'ترجمه استاد انصاریان: '}
            </span>
            {getTranslationDisplay(selectedVerse, settings)}
          </p>
          {selectedVerse.sajda && (
            <p className="text-[11px] text-red-500 dark:text-red-400 font-bold">
              ⚠️ {selectedVerse.sajda.obligatory ? 'این آیه از آیات سجدهٔ واجب است.' : 'این آیه از آیات سجدهٔ مستحب است.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};