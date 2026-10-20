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
import {
  ensureQcf4Font,
  isFullyDownloaded,
  isQcf4Supported,
  loadQcf4Manifest,
  onQcf4Change,
  wasPromptDismissed,
} from '../services/qcf4FontService';
import { Qcf4DownloadSheet } from './Qcf4DownloadSheet';

interface MushafPageViewProps {
  initialPageNumber: number;
  surahs: Surah[];
  settings: AppSettings;
  darkMode: boolean;
  bookmarkedVerseIds: Set<number>;
  onToggleBookmark: (verseNumber: number) => void;
  onOpenVerseDetail: (verse: Verse) => void;
  onOpenAIForVerse: (verse: Verse) => void;
  onPlayVerseAudio: (verseNumber: number, surahId?: number) => void;
  /** کلید آیه‌ی در حال پخش (مثل «2:255») برای هایلایت هماهنگ با پلیر */
  activeVerseKey?: string | null;
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
  activeVerseKey = null,
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
  const [fit, setFit] = useState<{ fontSize: number; centered: number[]; scales: Record<number, number> }>({
    fontSize: 22,
    centered: [],
    scales: {},
  });

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

  // فونت‌های QCF4: رندر گلیفی فقط وقتی همه‌ی فونت‌های این صفحه آماده باشند؛ در غیر این‌صورت نمایش ساده
  const [qcfReady, setQcfReady] = useState(false);
  const [qcfOffer, setQcfOffer] = useState(false); // فونت‌ها موجودند ولی هنوز دانلود نشده‌اند
  const [showQcfSheet, setShowQcfSheet] = useState(false);
  const hasGlyphData = !!layoutPage?.lines.some((l) => l.words.some((w) => w.c && w.f));

  useEffect(() => {
    setQcfReady(false);
    if (!layoutPage || !hasGlyphData || !isQcf4Supported()) return;
    const fonts = Array.from(
      new Set(layoutPage.lines.flatMap((l) => l.words.map((w) => w.f).filter((f): f is string => !!f)))
    );
    let cancelled = false;
    const check = async () => {
      const ok = await Promise.all(fonts.map((f) => ensureQcf4Font(f)));
      if (!cancelled) setQcfReady(ok.every(Boolean));
    };
    void check();
    const off = onQcf4Change(() => void check());
    return () => {
      cancelled = true;
      off();
    };
  }, [layoutPage, hasGlyphData]);

  // اگر بستهٔ گلیف و فونت‌ها در دسترس باشند ولی دانلود نشده باشند، پیشنهاد دانلود (با حجم) نشان می‌دهیم
  useEffect(() => {
    if (!hasGlyphData || !isQcf4Supported()) return;
    let cancelled = false;
    (async () => {
      const manifest = await loadQcf4Manifest();
      if (cancelled || !manifest) return;
      const done = await isFullyDownloaded();
      if (cancelled) return;
      setQcfOffer(!done);
      if (!done && !wasPromptDismissed()) setShowQcfSheet(true);
      if (done) setShowQcfSheet(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasGlyphData, qcfReady]);

  // اندازهٔ فونت پایه طوری تنظیم می‌شود که پهن‌ترین سطر دقیقاً در عرض صفحه جا شود.
  // سطرهای کوتاه‌تر تا ۱۰٪ بزرگ‌تر می‌شوند (به‌جای کشیده‌شدن فاصله‌ها) و باقی‌مانده بین کلمه‌ها پخش می‌شود؛
  // فاصلهٔ بین کلمات (نه حروف) کشیده می‌شود تا اعراب و اتصال حروف هرگز به‌هم نریزد.
  useLayoutEffect(() => {
    const root = linesRef.current;
    if (!root || !layoutPage) return;
    const MAX_LINE_SCALE = 1.1;
    const measure = () => {
      // عرض قابل‌استفاده = عرض ریشه منهای پدینگ (حاشیهٔ ایمن برای بیرون‌زدگی گلیف‌ها)
      const cs = getComputedStyle(root);
      const width = root.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (width <= 0) return;
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-mline="text"]'));
      if (rows.length === 0) return;
      const currentSize = parseFloat(getComputedStyle(root).fontSize) || 22;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      const MIN_GAP_EM = isMobile ? 0.16 : 0.28;
      // در گوشی حاشیهٔ اطمینان بیشتر؛ اندازه‌گیری و رندر نهایی فونت ممکن است کمی اختلاف داشته باشد
      const SAFETY = isMobile ? 0.97 : 0.985;
      // عرض طبیعی هر سطر در مقیاس ۱ (اثر مقیاس فعلی سطر حذف می‌شود)
      const naturals = rows.map((row) => {
        const applied = Number(row.dataset.scale) || 1;
        const kids = Array.from(row.children) as HTMLElement[];
        const sum = kids.reduce((acc, el) => acc + el.getBoundingClientRect().width, 0) / applied;
        return sum + Math.max(0, kids.length - 1) * MIN_GAP_EM * currentSize;
      });
      const widest = Math.max(...naturals, 1);
      const next = Math.max(8.5, Math.min(36, (currentSize * width) / widest * SAFETY));
      const centered: number[] = [];
      const scales: Record<number, number> = {};
      rows.forEach((row, i) => {
        const lineNo = Number(row.dataset.line);
        if (naturals[i] < widest * 0.7) {
          centered.push(lineNo);
          scales[lineNo] = 1;
        } else {
          scales[lineNo] = Math.min(MAX_LINE_SCALE, Math.max(1, widest / naturals[i]));
        }
      });
      setFit((prev) => {
        const sameScales = Object.keys(scales).every((k) => Math.abs((prev.scales[Number(k)] ?? 1) - scales[Number(k)]) < 0.01);
        return Math.abs(prev.fontSize - next) < 0.2 && prev.centered.join() === centered.join() && sameScales
          ? prev
          : { fontSize: next, centered, scales };
      });
    };
    measure();
    // بعد از اعمال اندازه‌ی جدید و بعد از لود کامل فونت دوباره اندازه‌گیری می‌کنیم
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
    };
  }, [layoutPage, settings.arabicFont, qcfReady]);

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

  // آیهٔ در حال پخش را در دید نگه می‌دارد (فقط اگر بیرون از ناحیهٔ قابل‌دید باشد)
  useEffect(() => {
    if (!activeVerseKey || isLoading) return;
    const t = window.setTimeout(() => {
      const el = pageContainerRef.current?.querySelector<HTMLElement>(`[data-verse="${activeVerseKey}"]`)
        ?? document.querySelector<HTMLElement>(`#mushaf-page-container [data-verse="${activeVerseKey}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 120; // فضای هدر و پلیر شناور
      if (r.top < margin || r.bottom > window.innerHeight - margin) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [activeVerseKey, isLoading, layoutPage, currentPage]);

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
    <div id="mushaf-page-container" className="w-full max-w-3xl mx-auto px-1 sm:px-4 py-2 sm:py-4 space-y-3 sm:space-y-4 overflow-x-hidden box-border">
      {/* نوار بالایی مصحف (شماره جزء، ربع حزب، سوره، و ناوبری صفحات) */}
      <div
        className={`flex items-center justify-between px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border transition-all w-full max-w-full overflow-hidden ${
          darkMode
            ? 'bg-slate-900 border-slate-800 text-slate-200'
            : 'bg-white border-stone-200 text-slate-800 shadow-xs'
        }`}
      >
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1 || isLoading}
          className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-all shrink-0 cursor-pointer"
          title="صفحه قبل"
          aria-label="صفحه قبل"
        >
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">صفحه قبل</span>
        </button>

        {/* سربرگ صفحه مصحف */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 text-[11px] sm:text-xs font-bold text-center min-w-0 flex-1 px-1">
          <span className="text-teal-700 dark:text-teal-400 shrink-0">جزء {toPersianDigits(currentJuz)}</span>
          {currentHizbQuarter ? (
            <>
              <span className="opacity-30 hidden sm:inline">•</span>
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline shrink-0">حزب {toPersianDigits(currentHizbQuarter)}</span>
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
                className="w-12 sm:w-16 px-1 py-0.5 rounded border text-center font-bold text-xs bg-white dark:bg-slate-800"
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
              className="px-1.5 py-0.5 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 shrink-0 cursor-pointer"
              title="کلیک جهت پرش به صفحه دلخواه"
            >
              ص {toPersianDigits(currentPage)}<span className="hidden sm:inline"> از ۶۰۴</span> ✎
            </button>
          )}
          <span className="opacity-30">•</span>
          <span className="text-slate-600 dark:text-slate-300 truncate max-w-[80px] xs:max-w-[120px] sm:max-w-[200px]" title={surahsOnThisPage.map((s) => s.surah.nameArabic).join('، ')}>
            {surahsOnThisPage.map((s) => s.surah.nameArabic).join('، ')}
          </span>
        </div>

        <button
          onClick={handleNextPage}
          disabled={currentPage >= 604 || isLoading}
          className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-all shrink-0 cursor-pointer"
          title="صفحه بعد"
          aria-label="صفحه بعد"
        >
          <span className="hidden xs:inline">صفحه بعد</span>
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
        className={`relative w-full max-w-full px-0 py-2 sm:px-8 sm:py-6 sm:rounded-2xl sm:border transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-teal-500 overflow-x-hidden box-border ${
          darkMode
            ? 'bg-slate-900 sm:border-slate-800 text-slate-100'
            : 'bg-[#fbf8ef] sm:border-[#d4b982]/40 text-slate-900'
        }`}
        aria-label="نمای صفحه مصحف — برای صفحهٔ قبل و بعد از کلیدهای جهت‌نما استفاده کنید"
      >
        {qcfOffer && !qcfReady && !isLoading && (
          <button
            onClick={() => setShowQcfSheet(true)}
            className="w-full mb-2 min-h-[40px] rounded-xl border border-amber-500/50 bg-amber-50 dark:bg-slate-800 text-xs font-bold text-amber-800 dark:text-amber-300 cursor-pointer"
          >
            دانلود فونت مصحف برای نمایش دقیق صفحه
          </button>
        )}

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
            className="w-full max-w-full overflow-x-hidden px-1 text-slate-800 dark:text-slate-100"
            style={{ fontFamily: getArabicFontFamily(settings.arabicFont), fontSize: `${fit.fontSize}px` }}
          >
            {layoutPage.lines.map((line) => {
              const first = line.words[0];
              if (first?.type === 'surah_header') {
                const meta = surahs.find((sr) => sr.id === first.sura);
                return (
                  <div key={line.line} data-mline="head" className="py-1 w-full max-w-full overflow-hidden" style={{ fontSize: '16px' }}>
                    {meta ? <QuranicSurahBanner surah={meta} darkMode={darkMode} variant="mushaf" /> : null}
                  </div>
                );
              }
              if (first?.type === 'bismillah') {
                return (
                  <div
                    key={line.line}
                    data-mline="bismillah"
                    className={`text-center select-none w-full max-w-full overflow-hidden ${darkMode ? 'text-amber-300/90' : 'text-amber-800'}`}
                    style={{ lineHeight: 2.2 }}
                  >
                    {qcfReady && first.c && first.f ? (
                      <span style={{ fontFamily: `'${first.f}'` }}>{first.c}</span>
                    ) : (
                      first.text
                    )}
                  </div>
                );
              }
              const isCentered = fit.centered.includes(line.line);
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
              return (
                <div
                  key={line.line}
                  data-mline="text"
                  data-line={line.line}
                  data-scale={fit.scales[line.line] ?? 1}
                  className="flex items-center w-full max-w-full overflow-visible whitespace-nowrap"
                  style={{
                    fontSize: `${fit.scales[line.line] ?? 1}em`,
                    justifyContent: isCentered ? 'center' : 'space-between',
                    gap: isMobile ? '0.16em' : '0.28em',
                    lineHeight: 2.15,
                  }}
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
                    const isPlaying = !!w.verse && w.verse === activeVerseKey;
                    const hit = {
                      onClick: verse ? () => setSelectedVerse(isSel ? null : verse) : undefined,
                    };
                    if (qcfReady && w.c && w.f && (w.type === 'end' || w.type === 'word')) {
                      return (
                        <span
                          key={idx}
                          {...hit}
                          data-verse={w.verse}
                          className={`cursor-pointer rounded-md transition-colors ${
                            isPlaying
                              ? 'bg-teal-400/35 dark:bg-teal-400/25'
                              : isSel
                                ? 'bg-amber-300/40 dark:bg-amber-500/30'
                                : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                          }`}
                          style={{ fontFamily: `'${w.f}'`, lineHeight: 1.9 }}
                        >
                          {w.c}
                        </span>
                      );
                    }
                    if (w.type === 'end') {
                      const num = w.verse ? Number(w.verse.split(':')[1]) : 0;
                      return (
                        <span
                          key={idx}
                          {...hit}
                          data-verse={w.verse}
                          className={`inline-flex items-center cursor-pointer rounded-full transition-colors ${
                            isPlaying ? 'bg-teal-400/40 dark:bg-teal-400/30' : ''
                          }`}
                          style={{ lineHeight: 1 }}
                        >
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
                        data-verse={w.verse}
                        className={`cursor-pointer rounded-md transition-colors ${
                          isPlaying
                            ? 'bg-teal-400/35 dark:bg-teal-400/25 text-teal-950 dark:text-teal-100'
                            : isSel
                              ? 'bg-amber-300/40 dark:bg-amber-500/30'
                              : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
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
                      const isPlayingVerse = activeVerseKey === `${v.surahId}:${v.verseNumber}`;
                      return (
                        <span
                          key={v.id}
                          data-verse={`${v.surahId}:${v.verseNumber}`}
                          onClick={() => setSelectedVerse(isSelected ? null : v)}
                          className={`inline cursor-pointer px-1 py-0.5 rounded-lg transition-all ${
                            isPlayingVerse
                              ? 'bg-teal-400/35 dark:bg-teal-400/25 ring-1 ring-teal-500/40'
                              : isSelected
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
          { label: 'پخش', icon: Volume2, run: () => onPlayVerseAudio(selectedVerse.verseNumber, selectedVerse.surahId) },
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
      {showQcfSheet && <Qcf4DownloadSheet darkMode={darkMode} onClose={() => setShowQcfSheet(false)} />}
    </div>
  );
};