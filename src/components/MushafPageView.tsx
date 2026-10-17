import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Volume2, Sparkles, BookOpen, Bookmark, Loader2, Share2, Copy, X } from 'lucide-react';
import { Surah, Verse, AppSettings } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';
import { shareAyah } from '../utils/shareAyah';
import { QuranService } from '../services/quranService';
import { QuranicSurahBanner } from './QuranicOrnament';
import { AyahEndMarker } from './QuranReader';
import { toPersianDigits } from '../utils/textNormalization';
import { loadMushafPage } from '../services/mushafLayoutService';
import type { MushafPageData } from '../types/mushafLayout';

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

  // دکمهٔ Back ابتدا منوی آیهٔ انتخاب‌شده را می‌بندد
  useEffect(() => {
    if (!selectedVerse) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      setSelectedVerse(null);
    };
    window.addEventListener('mobin-back', onBack);
    return () => window.removeEventListener('mobin-back', onBack);
  }, [selectedVerse]);
  const [isJumpInputOpen, setIsJumpInputOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState(String(initialPageNumber || 1));
  const [isPartNavOpen, setIsPartNavOpen] = useState(false);

  const pageContainerRef = useRef<HTMLDivElement>(null);

  // چیدمان خط‌به‌خط مصحف مدینه (۱۵ سطر): هر سطر دقیقاً عرض صفحه را پر می‌کند
  const [layoutPage, setLayoutPage] = useState<MushafPageData | null>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ fontSize: number; centered: number[] }>({ fontSize: 22, centered: [] });

  useEffect(() => {
    let cancelled = false;
    setLayoutPage(null);
    loadMushafPage(currentPage).then((page) => {
      if (!cancelled) setLayoutPage(page);
    });
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  // اندازهٔ فونت را طوری تنظیم می‌کنیم که پهن‌ترین سطر دقیقاً در عرض صفحه جا شود؛
  // فاصلهٔ بین کلمات (نه حروف) کشیده می‌شود تا اعراب و اتصال حروف هرگز به‌هم نریزد.
  useLayoutEffect(() => {
    const root = linesRef.current;
    if (!root || !layoutPage) return;
    const measure = () => {
      const width = root.clientWidth;
      if (!width) return;
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-mline="text"]'));
      if (rows.length === 0) return;
      const currentSize = parseFloat(getComputedStyle(root).fontSize) || 22;
      const MIN_GAP_EM = 0.32;
      const naturals = rows.map((row) => {
        const kids = Array.from(row.children) as HTMLElement[];
        const sum = kids.reduce((acc, el) => acc + el.getBoundingClientRect().width, 0);
        return sum + Math.max(0, kids.length - 1) * MIN_GAP_EM * currentSize;
      });
      const widest = Math.max(...naturals, 1);
      const next = Math.max(13, Math.min(36, (currentSize * width) / widest * 0.99));
      const centered = rows
        .map((row, i) => (naturals[i] < widest * 0.7 ? Number(row.dataset.line) : -1))
        .filter((n) => n >= 0);
      setFit((prev) =>
        Math.abs(prev.fontSize - next) < 0.2 && prev.centered.join() === centered.join()
          ? prev
          : { fontSize: next, centered }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [layoutPage, settings.arabicFont]);

  // با تغییر صفحه، به ابتدای صفحه برگرد (کاربر پایین صفحه روی «صفحه بعد» زده است)
  const previousPageRef = useRef(currentPage);
  useEffect(() => {
    if (previousPageRef.current !== currentPage) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      previousPageRef.current = currentPage;
    }
  }, [currentPage]);

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

  const verseByKey = new Map<string, Verse>(verses.map((v) => [`${v.surahId}:${v.verseNumber}`, v]));
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
        className={`relative px-3 py-5 sm:px-8 sm:py-8 rounded-3xl border-2 transition-all duration-300 shadow-md outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
          darkMode
            ? 'bg-slate-900 border-amber-500/20 text-slate-100'
            : 'bg-[#fbf8ef] border-[#d4b982]/60 text-slate-900 shadow-stone-200'
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
        ) : layoutPage ? (
          <div
            ref={linesRef}
            dir="rtl"
            className="text-slate-800 dark:text-slate-100"
            style={{ fontFamily: getArabicFontFamily(settings.arabicFont), fontSize: `${fit.fontSize}px` }}
          >
            {layoutPage.lines.map((line) => {
              const first = line.words[0];
              if (first?.type === 'surah_header') {
                const meta = surahs.find((sr) => sr.id === first.sura);
                return (
                  <div key={line.line} data-mline="head" className="py-1" style={{ fontSize: '16px' }}>
                    {meta ? <QuranicSurahBanner surah={meta} darkMode={darkMode} /> : null}
                  </div>
                );
              }
              if (first?.type === 'bismillah') {
                return (
                  <div
                    key={line.line}
                    data-mline="bismillah"
                    className={`text-center select-none ${darkMode ? 'text-amber-300/90' : 'text-amber-800'}`}
                    style={{ lineHeight: 2.2 }}
                  >
                    {first.text}
                  </div>
                );
              }
              const isCentered = fit.centered.includes(line.line);
              return (
                <div
                  key={line.line}
                  data-mline="text"
                  data-line={line.line}
                  className="flex items-center whitespace-nowrap"
                  style={{ justifyContent: isCentered ? 'center' : 'space-between', gap: '0.32em', lineHeight: 2.2 }}
                >
                  {line.words.map((w, idx) => {
                    if (w.type === 'quarter') {
                      return (
                        <span key={idx} className="text-amber-600 select-none" aria-hidden="true" style={{ fontSize: '0.7em' }}>
                          ۞
                        </span>
                      );
                    }
                    const verse = w.verse ? verseByKey.get(w.verse) : undefined;
                    const isSel = !!verse && selectedVerse?.id === verse.id;
                    const hit = {
                      onClick: verse ? () => setSelectedVerse(isSel ? null : verse) : undefined,
                    };
                    if (w.type === 'end') {
                      const num = w.verse ? Number(w.verse.split(':')[1]) : 0;
                      return (
                        <span key={idx} {...hit} className="inline-flex items-center cursor-pointer" style={{ lineHeight: 1 }}>
                          <span
                            className="relative inline-flex items-center justify-center"
                            style={{ width: '1.2em', height: '1.2em' }}
                            aria-label={`آیه ${toPersianDigits(num)}`}
                          >
                            <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full" aria-hidden="true" fill="none" strokeWidth="1.2" stroke={isSel ? '#d97706' : '#a8802c'}>
                              <circle cx="20" cy="20" r="18" strokeDasharray="3 1.5" />
                              <circle cx="20" cy="20" r="15" strokeWidth="0.8" opacity="0.85" fill={isSel ? 'rgba(245,158,11,0.25)' : 'none'} />
                            </svg>
                            <span
                              className="relative font-bold tabular-nums text-amber-800 dark:text-amber-300"
                              style={{ fontSize: num >= 100 ? '0.34em' : '0.42em', fontFamily: "'Vazirmatn', sans-serif" }}
                            >
                              {toPersianDigits(num)}
                            </span>
                          </span>
                          {verse && renderSajdaMark(verse)}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={idx}
                        {...hit}
                        className={`cursor-pointer rounded-md transition-colors ${
                          isSel ? 'bg-amber-300/40 dark:bg-amber-500/30' : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        {w.text}
                      </span>
                    );
                  })}
                </div>
              );
            })}
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
                    className="text-right leading-[2.6] tracking-normal text-slate-800 dark:text-slate-100"
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

      {/* ناوبری انتهای صفحه: بدون نیاز به برگشت به بالا */}
      <div className="flex items-center gap-2" dir="rtl">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1 || isLoading}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-1.5 rounded-2xl border border-amber-300/70 dark:border-slate-700 bg-stone-50 dark:bg-slate-900 text-sm font-bold text-teal-800 dark:text-teal-300 disabled:opacity-40 cursor-pointer active:scale-[0.98] transition-transform"
          aria-label="صفحه قبل"
        >
          <ChevronRight className="w-5 h-5" />
          صفحه قبل
        </button>
        <div className="min-w-[56px] text-center text-xs font-bold text-slate-500 dark:text-slate-400">
          {toPersianDigits(currentPage)}
        </div>
        <button
          onClick={handleNextPage}
          disabled={currentPage >= 604 || isLoading}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-1.5 rounded-2xl bg-teal-800 text-amber-200 text-sm font-bold disabled:opacity-40 cursor-pointer active:scale-[0.98] transition-transform"
          aria-label="صفحه بعد"
        >
          صفحه بعد
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* منوی عملیات آیهٔ انتخاب‌شده: پایین صفحه، با تپ روی آیه باز می‌شود */}
      {selectedVerse && (() => {
        const verseSurah =
          surahs.find((s) => s.id === selectedVerse.surahId) || {
            id: selectedVerse.surahId,
            nameArabic: `سورة ${selectedVerse.surahId}`,
            namePersian: `سوره ${selectedVerse.surahId}`,
            englishName: '',
            revelationType: 'Meccan' as const,
            versesCount: 0,
            startPage: selectedVerse.pageNumber,
            juzNumber: selectedVerse.juzNumber,
          };
        const translation = getTranslationDisplay(selectedVerse, settings);
        const isBookmarked = bookmarkedVerseIds.has(selectedVerse.verseNumber);
        const actions = [
          { label: 'تدبّر هوشمند', icon: Sparkles, primary: true, run: () => onOpenAIForVerse(selectedVerse) },
          { label: 'پخش', icon: Volume2, run: () => onPlayVerseAudio(selectedVerse.verseNumber) },
          { label: isBookmarked ? 'حذف نشانک' : 'نشانک', icon: Bookmark, active: isBookmarked, run: () => onToggleBookmark(selectedVerse.verseNumber) },
          { label: 'تفسیر', icon: BookOpen, run: () => onOpenVerseDetail(selectedVerse) },
          {
            label: 'کپی',
            icon: Copy,
            run: () => {
              try {
                navigator.clipboard.writeText(
                  `${selectedVerse.textArabic}\n\n«${translation}»\n(سوره ${verseSurah.nameArabic}، آیه ${selectedVerse.verseNumber})`
                );
              } catch {}
            },
          },
          { label: 'اشتراک', icon: Share2, run: () => shareAyah(selectedVerse, translation, verseSurah) },
        ];
        return (
          <>
            {/* فضای خالی تا آیه‌های پایین صفحه زیر منو نمانند */}
            <div className="h-80" aria-hidden="true" />
            <div
              role="dialog"
              aria-label="منوی آیه"
              className="fixed bottom-0 inset-x-0 z-[90] max-w-3xl mx-auto rounded-t-3xl border-t-2 border-amber-600 bg-stone-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-[0_-8px_28px_rgba(19,78,74,0.18)] px-5 pt-2.5 space-y-3 animate-fadeIn max-h-[70vh] overflow-y-auto"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
              dir="rtl"
            >
              <div className="mx-auto w-10 h-1 rounded-full bg-stone-300 dark:bg-slate-600" />
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">
                  آیه {toPersianDigits(selectedVerse.verseNumber)} · سوره {verseSurah.nameArabic}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <span>صفحه {toPersianDigits(selectedVerse.pageNumber)}</span>
                  <button
                    onClick={() => setSelectedVerse(null)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="بستن منوی آیه"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.label}
                      onClick={() => {
                        a.run();
                        setSelectedVerse(null);
                      }}
                      className={`min-h-[64px] flex flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-bold cursor-pointer active:scale-[0.97] transition-transform ${
                        a.primary
                          ? 'bg-teal-800 border-teal-800 text-white'
                          : a.active
                          ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300'
                          : 'bg-white dark:bg-slate-800 border-amber-300/70 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <Icon className={`w-[22px] h-[22px] ${a.primary ? 'text-amber-300' : a.active ? 'fill-current' : 'text-teal-600 dark:text-teal-400'}`} />
                      {a.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {settings.activeTranslator === 'makarem'
                    ? 'ترجمه آیت‌الله مکارم: '
                    : settings.activeTranslator === 'fooladvand'
                    ? 'ترجمه استاد فولادوند: '
                    : 'ترجمه استاد انصاریان: '}
                </span>
                {translation}
              </p>
              {selectedVerse.sajda && (
                <p className="text-[11px] text-red-500 dark:text-red-400 font-bold">
                  ⚠️ {selectedVerse.sajda.obligatory ? 'این آیه از آیات سجدهٔ واجب است.' : 'این آیه از آیات سجدهٔ مستحب است.'}
                </p>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
};