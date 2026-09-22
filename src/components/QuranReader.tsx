import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Sparkles, Copy, BookOpen, Play, Volume2, Loader2, AlertCircle, RefreshCw, Share2 } from 'lucide-react';
import { Verse, Surah, AppSettings } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';
import { prefersReducedMotion } from '../utils/motion';
import { shareAyah } from '../utils/shareAyah';

/**
 * نشان سنتی و گل مصحفی انتهای آیه شبیه به مصحف شریف عثمان طه و نسخه‌های نفیس کتب قرآن
 */
export const AyahEndMarker: React.FC<{
  verseNumber: number;
  className?: string;
  isCurrentlyPlaying?: boolean;
}> = ({ verseNumber, className = '', isCurrentlyPlaying }) => {
  const persianNumber = verseNumber.toLocaleString('fa-IR');
  return (
    <span
      className={`inline-flex items-center justify-center align-middle mx-1.5 select-none relative group/marker ${className}`}
      title={`پایان آیهٔ ${persianNumber}`}
      aria-label={`آیه ${persianNumber}`}
      style={{ verticalAlign: 'middle', display: 'inline-flex' }}
    >
      <svg
        viewBox="0 0 40 40"
        className={`w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover/marker:scale-110 shrink-0 ${
          isCurrentlyPlaying
            ? 'text-amber-500 fill-amber-500/20 stroke-amber-600 dark:stroke-amber-400'
            : 'text-amber-600/90 dark:text-amber-400/90 fill-amber-500/5 stroke-amber-600/80 dark:stroke-amber-400/80'
        }`}
        strokeWidth="1.2"
      >
        {/* حلقه بیرونی دندانه‌دار گل مصحفی */}
        <circle cx="20" cy="20" r="18" fill="none" strokeDasharray="3 1.5" />
        <circle cx="20" cy="20" r="15" fill="none" strokeWidth="0.8" opacity="0.85" />
        <circle cx="20" cy="20" r="13" fill="none" strokeWidth="0.5" opacity="0.4" />
        {/* گلبرگ‌های چهارگوشه به سبک سنتی تذهیب قرآنی */}
        <path d="M20 2 L21.5 5 L20 6 L18.5 5 Z" fill="currentColor" stroke="none" />
        <path d="M20 38 L21.5 35 L20 34 L18.5 35 Z" fill="currentColor" stroke="none" />
        <path d="M2 20 L5 21.5 L6 20 L5 18.5 Z" fill="currentColor" stroke="none" />
        <path d="M38 20 L35 21.5 L34 20 L35 18.5 Z" fill="currentColor" stroke="none" />
        <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="32.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="7.5" cy="32.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="32.5" cy="32.5" r="1.3" fill="currentColor" stroke="none" />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold font-sans tabular-nums pt-0.5 ${
          isCurrentlyPlaying
            ? 'text-slate-950 dark:text-amber-200'
            : 'text-amber-800 dark:text-amber-300'
        }`}
        style={{ fontSize: verseNumber >= 100 ? '9px' : '11px' }}
      >
        {persianNumber}
      </span>
    </span>
  );
};

interface QuranReaderProps {
  currentSurah: Surah;
  verses: Verse[];
  settings: AppSettings;
  darkMode: boolean;
  bookmarkedVerseIds: Set<number>;
  activePlayingVerseNumber: number | null;
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  onToggleBookmark: (verseNumber: number) => void;
  onOpenVerseAction: (verse: Verse) => void;
  onOpenAIFortVerse: (verse: Verse) => void;
  onPlayVerseAudio: (verseNumber: number) => void;
  onReadingPositionChange?: (verse: Verse) => void;
  initialScrollToVerseNumber?: number | null;
  onInitialScrollHandled?: () => void;
}

// مجازی‌سازی لیست (P3-T8): مت‌ریال‌سازی تدریجی آیه‌ها برای سوره‌های بلند.
// بار اول فقط INITIAL_CHUNK آیه رندر می‌شود؛ با نزدیک‌شدن به انتها، chunk بعدی اضافه می‌شود
// و پرش به آیهٔ دلخواه (شروع/پخش/مودال) از طریق متد سراسری کار می‌کند.
const VIRTUALIZE_THRESHOLD = 200;
const INITIAL_CHUNK = 40;
const CHUNK_SIZE = 30;

const scrollListeners = new Set<(verseNumber: number) => void>();

/** درخواست اسکرول به آیه از خارج از کامپوننت (App.tsx) */
export function requestQuranScrollToVerse(verseNumber: number): void {
  scrollListeners.forEach((listener) => listener(verseNumber));
}

/**
 * انتخاب «آیهٔ در حال مطالعه» از میان آیات قابل‌مشاهده (P3-T1).
 * آیه‌ای برنده است که بیشترین پوشش را روی «خط مرجع مطالعه» (reading line) داشته باشد؛
 * یعنی آیه‌ای که در حال عبور از ناحیهٔ مرکزی دید کاربر است.
 * برخلاف حالت قبلی، انتخاب بر اساس هندسهٔ «همین دسته» انجام می‌شود و
 * آیه‌ای که زمانی در بالای صفحه بوده (ratio=1) برای همیشه برنده نمی‌ماند.
 */
export interface VerseCandidate {
  verse: Verse;
  top: number;
  bottom: number;
}

export function pickReadingVerse(
  candidates: VerseCandidate[],
  readingLineY: number
): Verse | null {
  let best: VerseCandidate | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const center = (candidate.top + candidate.bottom) / 2;
    const distance = Math.abs(center - readingLineY);
    if (distance < bestScore) {
      bestScore = distance;
      best = candidate;
    }
  }

  return best?.verse ?? null;
}

export const QuranReader: React.FC<QuranReaderProps> = ({
  currentSurah,
  verses,
  settings,
  darkMode,
  bookmarkedVerseIds,
  activePlayingVerseNumber,
  isLoading,
  loadError,
  onRetry,
  onToggleBookmark,
  onOpenVerseAction,
  onOpenAIFortVerse,
  onPlayVerseAudio,
  onReadingPositionChange,
  initialScrollToVerseNumber,
  onInitialScrollHandled,
}) => {
  // مرجع جدیدترین تابع جهت استفاده در observer بدون وابستگی‌های رندر
  const onReadingPositionChangeRef = useRef(onReadingPositionChange);
  useEffect(() => {
    onReadingPositionChangeRef.current = onReadingPositionChange;
  }, [onReadingPositionChange]);

  // مرجع وضعیت «بازگشت به آخرین مطالعه در حال انجام» برای observer؛
  // تا بستن لغو شود، observer فقط با آخرین مقدار آن کار می‌کند و نیازی به بازسازی observable نیست.
  const resumePendingRef = useRef(Boolean(initialScrollToVerseNumber));
  useEffect(() => {
    resumePendingRef.current = Boolean(initialScrollToVerseNumber);
  }, [initialScrollToVerseNumber]);

  // --- مجازی‌سازی لیست (P3-T8) ---
  const isVirtualized = verses.length > VIRTUALIZE_THRESHOLD;
  const [renderCount, setRenderCount] = useState(0);
  useEffect(() => {
    // هنگام تغییر سوره/آیات، پنجرهٔ متریال‌سازی ریست می‌شود ولی کوچک نمی‌شود
    setRenderCount((prev) => (prev === 0 ? INITIAL_CHUNK : Math.max(prev, INITIAL_CHUNK)));
  }, [verses]);

  const visibleVerses = isVirtualized ? verses.slice(0, renderCount) : verses;

  // پرش به آیهٔ مشخص: مطمین می‌شویم تعداد رندر کافی است، سپس اسکرول
  const scrollToVerse = (verseNumber: number, behavior: 'auto' | 'smooth') => {
    const el2 = document.getElementById(`verse-${verseNumber}`);
    if (el2) {
      el2.scrollIntoView({ behavior, block: 'center' });
      return;
    }
    if (isVirtualized && verseNumber >= 1 && verseNumber <= verses.length) {
      setRenderCount((prev) => Math.max(prev, verseNumber, INITIAL_CHUNK));
      // بعد از رندر تعداد کافی، اسکرول انجام می‌شود
      const tryScroll = () => {
        const el3 = document.getElementById(`verse-${verseNumber}`);
        if (el3) {
          el3.scrollIntoView({ behavior: behavior === 'smooth' && !prefersReducedMotion() ? 'smooth' : 'auto', block: 'center' });
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(tryScroll));
    }
  };

  // سرویس درخواست اسکرول از خارج (App.tsx: پخش صوتی/ونمودار/انتخاب از مودال)
  useEffect(() => {
    const listener = (verseNumber: number) => scrollToVerse(verseNumber, 'smooth');
    scrollListeners.add(listener);
    return () => {
      scrollListeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVirtualized, verses, renderCount]);

  // سنتینل پایین: وقتی به انتهای پنجرهٔ متریال‌شده نزدیک شویم، chunk بعدی اضافه می‌شود
  useEffect(() => {
    if (!isVirtualized || isLoading || verses.length === 0) return;
    if (renderCount >= verses.length) return;
    const sentinel = document.getElementById('reader-virtual-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setRenderCount((prev) => Math.min(prev + CHUNK_SIZE, verses.length));
        }
      },
      { rootMargin: '800px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isVirtualized, renderCount, verses, isLoading]);

  // اسکرول بازگشت به آیهٔ آخرین مطالعه پس از بارگذاری آیات (P3-T1)
  useEffect(() => {
    if (isLoading || verses.length === 0 || !initialScrollToVerseNumber) return;
    if (initialScrollToVerseNumber < 1 || initialScrollToVerseNumber > verses.length) {
      onInitialScrollHandled?.();
      return;
    }
    // اگر سوره بلند است و آیهٔ مقصد هنوز متریال نشده، تعداد را افزایش بده
    const targetEl = document.getElementById(`verse-${initialScrollToVerseNumber}`);
    if (isVirtualized && !targetEl && initialScrollToVerseNumber > renderCount) {
      setRenderCount(initialScrollToVerseNumber);
    }
    if (!targetEl) return; // در commit بعدی (مثلاً پنجره‌سازی) دوباره تلاش می‌شود
    targetEl.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    });
    onInitialScrollHandled?.();
  }, [verses, isLoading, renderCount, initialScrollToVerseNumber]);

  // ثبت «آخرین محل مطالعه» با IntersectionObserver + debounce (P3-T1)
  useEffect(() => {
    const handler = onReadingPositionChangeRef.current;
    if (!handler || isLoading || verses.length === 0) return;

    const verseMap = new Map<number, Verse>();
    verses.forEach((v) => verseMap.set(v.verseNumber, v));

    let bestVerse: Verse | null = null;
    let scrollDebounce: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        // هنگام بازگشت به آخرین مطالعه (still pending)، موقعیت فعلی (بالای صفحه/آیه ۱)
        // را ثبت نکن تا آخرین آیهٔ واقعی حفظ شود.
        if (resumePendingRef.current) return;

        // برای هر دسته، برنده را صرفاً از روی همین ورودی‌ها و با هندسهٔ لحظهٔ فعلی
        // محاسبه می‌کنیم تا انتخاب قبلی (مثلاً آیهٔ ۱ بالای صفحه) برندهٔ همیشگی نماند.
        const candidates: VerseCandidate[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const vn = Number((entry.target as HTMLElement).dataset.verseNumber);
          const verse = verseMap.get(vn);
          if (!verse) continue;
          const rect = entry.boundingClientRect;
          candidates.push({ verse, top: rect.top, bottom: rect.bottom });
        }

        const picked = pickReadingVerse(
          candidates,
          (window.innerHeight || document.documentElement.clientHeight || 800) * 0.3
        );
        if (!picked) return;
        bestVerse = picked;

        if (scrollDebounce) clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(() => {
          if (bestVerse && onReadingPositionChangeRef.current) {
            onReadingPositionChangeRef.current(bestVerse);
          }
        }, 800);
      },
      { rootMargin: '0px 0px 0px 0px', threshold: [0, 0.2, 0.5, 1] }
    );

    document.querySelectorAll('[data-reader-verse-element]').forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      if (scrollDebounce) clearTimeout(scrollDebounce);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses, isLoading, renderCount]);

  // اسکرول خودکار به آیه جاری هنگام پخش ترتیل صوتی (P5-T6)
  useEffect(() => {
    if (activePlayingVerseNumber !== null) {
      const verseEl = document.getElementById(`verse-${activePlayingVerseNumber}`);
      if (isVirtualized && !verseEl && activePlayingVerseNumber > renderCount) {
        setRenderCount(activePlayingVerseNumber);
        return;
      }
      if (verseEl) {
        verseEl.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'center',
        });
      }
    }
  }, [activePlayingVerseNumber, renderCount, isVirtualized]);

  const arabicFontFamily = getArabicFontFamily(settings.arabicFont);

  const arabicLineHeightClass =
    settings.lineHeight === 'normal'
      ? 'leading-[2.1] sm:leading-[2.3]'
      : settings.lineHeight === 'loose'
      ? 'leading-[2.9] sm:leading-[3.2]'
      : 'leading-[2.5] sm:leading-[2.7]';

  const getTranslationText = (verse: Verse) => {
    switch (settings.activeTranslator) {
      case 'fooladvand':
        return verse.translationFooladvand || verse.translationMakarem;
      case 'ansarian':
        return verse.translationAnsarian || verse.translationMakarem;
      case 'makarem':
      default:
        return verse.translationMakarem;
    }
  };

  const handleCopy = (verse: Verse) => {
    const text = `${verse.textArabic}\n\n«${getTranslationText(verse)}»\n(سوره ${currentSurah.nameArabic}، آیه ${verse.verseNumber})`;
    navigator.clipboard.writeText(text);
  };

  return (
    <main
      id="quran-reader-container"
      className="max-w-3xl mx-auto px-3 sm:px-4 py-6 pb-28 space-y-6"
    >
      {/* کتیبه مذهب سرسوره به سبک مصاحف نفیس کهن و عثمان طه */}
      <div
        id="surah-header-banner"
        className={`relative overflow-hidden rounded-3xl p-5 sm:p-7 text-center border-2 shadow-md transition-all select-none ${
          darkMode
            ? 'bg-gradient-to-b from-slate-900 via-teal-950/60 to-slate-900 border-amber-500/40 text-slate-100 shadow-teal-950/40'
            : 'bg-gradient-to-b from-amber-50/70 via-stone-50 to-amber-50/60 border-amber-600/35 text-slate-900 shadow-stone-200'
        }`}
      >
        {/* نقوش هندسی و قاب بیرونی کتیبه */}
        <div className="absolute inset-1.5 rounded-2xl border border-dashed border-amber-500/30 pointer-events-none" />

        {/* گوشه‌های اسلیمی سنتی تذهیب */}
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-500/60" />
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-500/60" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-500/60" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-500/60" />

        {/* نوار متادیتا و مدال‌های طرفین */}
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto mb-3">
          {/* مدال سمت راست: محل نزول */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs">
            <span>{currentSurah.revelationType === 'Meccan' ? 'مَكِّيَّة' : 'مَدَنِيَّة'}</span>
            <span className="text-[10px] opacity-70">({currentSurah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'})</span>
          </div>

          {/* پلاک مرکزی شماره سوره */}
          <div className="text-xs font-bold text-teal-700 dark:text-teal-300 px-2.5 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
            سوره {currentSurah.id} از ۱۱۴
          </div>

          {/* مدال سمت چپ: تعداد آیات */}
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs">
            <span>{currentSurah.versesCount.toLocaleString('fa-IR')} آیه</span>
          </div>
        </div>

        {/* قاب عنوان سوره با خط ثلث و امیری */}
        <div className="relative py-2 my-1">
          <div className="flex items-center justify-center gap-3">
            <span className="hidden sm:inline-block w-12 sm:w-16 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-amber-500" />
            <h1
              className="text-3xl sm:text-5xl font-bold tracking-normal text-amber-600 dark:text-amber-300 drop-shadow-xs"
              style={{ fontFamily: "'Amiri', 'Amiri Quran', serif" }}
            >
              سُورَةُ {currentSurah.nameArabic}
            </h1>
            <span className="hidden sm:inline-block w-12 sm:w-16 h-px bg-gradient-to-l from-transparent via-amber-500/70 to-amber-500" />
          </div>
        </div>

        {/* زیرنویس و اطلاعات مصحف (نام فارسی، جزء و صفحه) */}
        <div className="mt-2 pt-2.5 border-t border-amber-500/20 flex items-center justify-center gap-3 sm:gap-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>نام فارسی: <strong className="text-slate-700 dark:text-slate-200">{currentSurah.namePersian}</strong> ({currentSurah.englishName})</span>
          <span>•</span>
          <span>جزء {currentSurah.juzNumber.toLocaleString('fa-IR')}</span>
          <span>•</span>
          <span>صفحه {currentSurah.startPage?.toLocaleString('fa-IR') || '۱'}</span>
        </div>
      </div>

      {/* سرآغاز بسم‌الله الرحمن الرحیم در کادر مزین سنتی (به جز سوره توبه - شماره ۹) */}
      {currentSurah.id !== 9 && (
        <div
          id="bismillah-banner"
          className={`relative max-w-xl mx-auto my-6 py-4 px-6 rounded-2xl text-center select-none border shadow-xs ${
            darkMode
              ? 'bg-gradient-to-r from-slate-900 via-teal-950/40 to-slate-900 border-amber-500/30 text-amber-200'
              : 'bg-gradient-to-r from-amber-50/40 via-stone-50 to-amber-50/40 border-amber-500/25 text-teal-950'
          }`}
          dir="rtl"
        >
          {/* تزئین خطوط طرفین */}
          <div className="flex items-center justify-center gap-4">
            <span className="w-8 sm:w-14 h-px bg-gradient-to-r from-transparent to-amber-500/60" />
            <div
              className="text-2xl sm:text-3xl font-medium tracking-wide drop-shadow-xs"
              style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
            >
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
            <span className="w-8 sm:w-14 h-px bg-gradient-to-l from-transparent to-amber-500/60" />
          </div>
        </div>
      )}

      {/* لیست آیات */}
      <div id="verses-list" className="space-y-4">
        {isLoading ? (
          <div className="p-10 text-center rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-stone-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                در حال بارگذاری آیات سوره {currentSurah.nameArabic}...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فراخوانی متن عربی مصحف شریف و ۳ ترجمه رسمی مکارم، فولادوند و انصاریان
              </p>
            </div>
            {/* جلوه بصری اسکلتون متن */}
            <div className="max-w-md mx-auto space-y-2.5 pt-3 opacity-60">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse w-full" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse w-4/5 mx-auto" />
              <div className="h-3 bg-stone-100 dark:bg-slate-800/60 rounded-full animate-pulse w-3/5 mx-auto" />
            </div>
          </div>
        ) : loadError ? (
          <div className="p-8 text-center rounded-3xl bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {loadError}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تلاش مجدد برای بارگذاری سوره</span>
              </button>
            )}
          </div>
        ) : verses.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
            <p className="text-sm text-slate-500">آیه‌ای برای نمایش در این سوره یافت نشد.</p>
          </div>
        ) : (
          <>
            {visibleVerses.map((verse) => {
              const isBookmarked = bookmarkedVerseIds.has(verse.verseNumber);
              const isCurrentlyPlaying = activePlayingVerseNumber === verse.verseNumber;

            return (
              <article
                key={verse.id}
                id={`verse-${verse.verseNumber}`}
                data-reader-verse-element=""
                data-verse-number={verse.verseNumber}
                className={`reader-verse-card p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative group ${
                  isCurrentlyPlaying
                    ? darkMode
                      ? 'bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/30'
                      : 'bg-teal-50/70 border-teal-400 ring-2 ring-teal-500/20'
                    : darkMode
                    ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-stone-200/90 hover:border-stone-300 shadow-sm'
                }`}
              >
                {/* نوار بالایی آیه: نشان سنتی آیه و ابزارها */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <AyahEndMarker verseNumber={verse.verseNumber} isCurrentlyPlaying={isCurrentlyPlaying} />
                    <span className="text-[11px] text-slate-400 font-medium">
                      جزء {verse.juzNumber.toLocaleString('fa-IR')} • صفحه {verse.pageNumber.toLocaleString('fa-IR')}
                    </span>
                  </div>

                  {/* دکمه‌های کنشی روی هر آیه */}
                  <div className="flex items-center gap-1">
                    {/* دکمه ترتیل صوتی آیه */}
                    <button
                      onClick={() => onPlayVerseAudio(verse.verseNumber)}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        isCurrentlyPlaying
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : darkMode
                          ? 'hover:bg-slate-800 text-slate-400 hover:text-amber-400'
                          : 'hover:bg-slate-100 text-slate-500 hover:text-amber-600'
                      }`}
                      title="پخش ترتیل صوتی این آیه"
                    >
                      {isCurrentlyPlaying ? (
                        <Volume2 className="w-4 h-4 animate-pulse" />
                      ) : (
                        <Play className="w-4 h-4 fill-current mr-0.5" />
                      )}
                    </button>

                    {/* دکمه دستیار هوش مصنوعی تدبّر برای این آیه */}
                    <button
                      onClick={() => onOpenAIFortVerse(verse)}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        darkMode
                          ? 'bg-teal-950/80 text-teal-300 hover:bg-teal-900 border border-teal-800'
                          : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                      }`}
                      title="تدبّر و پرسش از هوش مصنوعی درباره این آیه"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span className="hidden sm:inline">تدبّر با هوش مصنوعی</span>
                    </button>

                    {/* تفسیر و جزئیات */}
                    <button
                      onClick={() => onOpenVerseAction(verse)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      title="مشاهده تفسیر و مقایسه ترجمه‌ها"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>

                    {/* کپی متن */}
                    <button
                      onClick={() => handleCopy(verse)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                      title="کپی آیه و ترجمه"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* اشتراک‌گذاری آیه (متن + کارت تصویری) */}
                    <button
                      onClick={() => shareAyah(verse, getTranslationText(verse), currentSurah)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      title="اشتراک‌گذاری آیه"
                      aria-label="اشتراک‌گذاری آیه"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {/* نشانه‌گذاری آیه (Bookmark) */}
                    <button
                      onClick={() => onToggleBookmark(verse.verseNumber)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isBookmarked
                          ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={isBookmarked ? 'حذف از نشانه‌گذاری‌ها' : 'افزودن به نشانه‌گذاری‌ها'}
                    >
                      <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* متن عربی آیه با خط و اعراب برجسته و تراز Justify */}
                <div
                  className={`text-justify [text-align-last:right] font-medium transition-all tracking-normal ${arabicLineHeightClass} ${
                    darkMode ? 'text-slate-100' : 'text-slate-900'
                  }`}
                  style={{
                    fontFamily: arabicFontFamily,
                    fontSize: `${settings.arabicFontSize}px`,
                  }}
                  dir="rtl"
                >
                  {verse.textArabic}
                  {/* نشان سنتی انتهای آیه درون متن عربی بدون پرانتز */}
                  <AyahEndMarker verseNumber={verse.verseNumber} isCurrentlyPlaying={isCurrentlyPlaying} />
                </div>

                {/* ترجمه فارسی آیه با تراز Justify */}
                {settings.showTranslation && (
                  <div className="mt-3.5 pt-3 border-t border-dashed border-stone-200/80 dark:border-slate-800">
                    <p
                      className={`text-justify [text-align-last:right] leading-relaxed ${
                        darkMode ? 'text-slate-300' : 'text-stone-700'
                      }`}
                      style={{ fontSize: `${settings.translationFontSize}px` }}
                      dir="rtl"
                    >
                      {getTranslationText(verse)}
                    </p>
                    <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
                      <span>ترجمه: {settings.activeTranslator === 'makarem' ? 'آیت‌الله مکارم شیرازی' : settings.activeTranslator === 'fooladvand' ? 'استاد فولادوند' : 'استاد انصاریان'}</span>
                    </div>
                  </div>
                )}
              </article>
            );
            })}
            {/* سنتینل مجازی‌سازی: افزودن chunk بعدی هنگام نزدیک‌شدن به انتهای رندر فعلی */}
            {isVirtualized && renderCount < verses.length && (
              <div
                id="reader-virtual-sentinel"
                className="flex items-center justify-center py-3 text-xs text-slate-400"
                aria-hidden="true"
              >
                در حال بارگذاری آیات بعدی…
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};
