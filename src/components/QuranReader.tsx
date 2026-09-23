import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bookmark, Sparkles, Copy, BookOpen, Play, Volume2, Loader2, AlertCircle, RefreshCw, Share2 } from 'lucide-react';
import { Verse, Surah, AppSettings } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';
import { prefersReducedMotion } from '../utils/motion';
import { shareAyah } from '../utils/shareAyah';
import { QuranicSurahBanner } from './QuranicOrnament';
import { toPersianDigits } from '../utils/textNormalization';

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

/**
 * نشان سنتی و گل مصحفی انتهای آیه شبیه به مصحف شریف عثمان طه و نسخه‌های نفیس کتب قرآن
 */
export const AyahEndMarker: React.FC<{
  verseNumber: number;
  className?: string;
  isCurrentlyPlaying?: boolean;
}> = ({ verseNumber, className = '', isCurrentlyPlaying }) => {
  const persianNumber = toPersianDigits(verseNumber);
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

// ثبت شنوندگان سراسری اسکرول (برای هماهنگی بین کامپوننت‌ها)
const scrollListeners = new Set<(verseNumber: number) => void>();

/** درخواست اسکرول مستقیم به آیه از خارج از کامپوننت (App.tsx) */
export function requestQuranScrollToVerse(verseNumber: number): void {
  scrollListeners.forEach((listener) => listener(verseNumber));
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
  // مرجع جدیدترین تابع جهت استفاده در شنوندهٔ اسکرول
  const onReadingPositionChangeRef = useRef(onReadingPositionChange);
  useEffect(() => {
    onReadingPositionChangeRef.current = onReadingPositionChange;
  }, [onReadingPositionChange]);

  // پرچم قفل‌کردن ردیاب مطالعه در هنگام اسکرول برنامه‌ای (جلوگیری از ثبت اشتباه آیات میانی)
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleVerses = verses;

  // اسکرول کاملاً پایدار، دقیق و مقاوم در برابر بارگذاری فونت و ریفلاو به آیه مورد نظر
  const performScrollToVerse = useCallback((verseNumber: number) => {
    const el = document.getElementById(`verse-${verseNumber}`);
    if (!el) return false;

    // قفل ردیاب موقعیت تا زمانی که تمام تثبیت‌های اسکرول به پایان برسد
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }

    const pinToReadingLine = () => {
      const currentEl = document.getElementById(`verse-${verseNumber}`);
      if (!currentEl) return;
      const rect = currentEl.getBoundingClientRect();
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      // هدایت آیه به فاصله دقیق ۱۰۰ پیکسل از بالای صفحه (زیر هدر ثابت)
      const targetY = Math.max(0, currentScrollY + rect.top - 100);
      window.scrollTo({
        top: targetY,
        behavior: 'auto',
      });
    };

    // پرش فوری و مستقیم (بدون تأخیر انیمیشن که در صفحات بلند لغو شود)
    pinToReadingLine();

    // تصحیح مکرر موقعیت جهت همگامی ۱۰۰٪ با بارگذاری قلم‌های عثمانی و متون ترجمه
    setTimeout(pinToReadingLine, 50);
    setTimeout(pinToReadingLine, 150);
    setTimeout(pinToReadingLine, 350);
    setTimeout(pinToReadingLine, 650);
    setTimeout(pinToReadingLine, 1000);

    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        pinToReadingLine();
      });
    }

    // جلوه بصری تأکید روی آیه هدف
    el.classList.add('ring-4', 'ring-amber-500/80', 'bg-amber-500/15');
    setTimeout(() => {
      el.classList.remove('ring-4', 'ring-amber-500/80', 'bg-amber-500/15');
    }, 3500);

    // باز کردن قفل ردیاب پس از ثبات کامل المان‌ها
    programmaticScrollTimerRef.current = setTimeout(() => {
      pinToReadingLine();
      isProgrammaticScrollRef.current = false;
    }, 1200);

    return true;
  }, []);

  // سرویس درخواست اسکرول از خارج (App.tsx: پخش صوتی/مودال/صفحه اصلی)
  useEffect(() => {
    const listener = (verseNumber: number) => {
      performScrollToVerse(verseNumber);
    };
    scrollListeners.add(listener);
    return () => {
      scrollListeners.delete(listener);
    };
  }, [performScrollToVerse]);

  // اسکرول مطمئن و بدون لغزش به آیهٔ آخرین مطالعه یا آیه منتخب پس از بارگذاری آیات سوره
  useEffect(() => {
    if (isLoading || verses.length === 0 || !initialScrollToVerseNumber) return;
    const targetNum = initialScrollToVerseNumber;
    if (targetNum < 1 || targetNum > verses.length) {
      onInitialScrollHandled?.();
      return;
    }

    let attempts = 0;
    let done = false;
    const interval = setInterval(() => {
      attempts++;
      const success = performScrollToVerse(targetNum);
      if (success) {
        clearInterval(interval);
        done = true;
        setTimeout(() => {
          onInitialScrollHandled?.();
        }, 1300);
      } else if (attempts >= 40) {
        clearInterval(interval);
        if (!done) onInitialScrollHandled?.();
      }
    }, 35);

    return () => clearInterval(interval);
  }, [verses, isLoading, initialScrollToVerseNumber, onInitialScrollHandled, performScrollToVerse]);

  // تشخیص کاملاً دقیق و بلادرنگ «آیه در حال مطالعه» با اسکرول کاربر (P3-T1)
  useEffect(() => {
    if (isLoading || verses.length === 0) return;

    const verseMap = new Map<number, Verse>();
    verses.forEach((v) => verseMap.set(v.verseNumber, v));

    let scrollDebounce: ReturnType<typeof setTimeout> | null = null;

    const checkCurrentReadingVerse = () => {
      if (isProgrammaticScrollRef.current) return;

      const elements = document.querySelectorAll<HTMLElement>('[data-reader-verse-element]');
      if (elements.length === 0) return;

      // خط فرضی دید کاربر: حدود ۱۴۰ پیکسل از بالای پنجره (زیر هدر)
      const readingLineY = 140;
      let matchedVerse: Verse | null = null;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const rect = el.getBoundingClientRect();
        if (rect.top <= readingLineY && rect.bottom >= readingLineY) {
          const vn = Number(el.dataset.verseNumber);
          matchedVerse = verseMap.get(vn) || null;
          break;
        }
      }

      // در صورت قرارگیری در فواصل کارت‌ها، نزدیک‌ترین کارت به خط دید انتخاب می‌شود
      if (!matchedVerse) {
        let minDistance = Infinity;
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const rect = el.getBoundingClientRect();
          const dist = Math.abs(rect.top - readingLineY);
          if (dist < minDistance) {
            minDistance = dist;
            const vn = Number(el.dataset.verseNumber);
            matchedVerse = verseMap.get(vn) || null;
          }
        }
      }

      if (matchedVerse && onReadingPositionChangeRef.current) {
        onReadingPositionChangeRef.current(matchedVerse);
      }
    };

    const onWindowScroll = () => {
      if (scrollDebounce) clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(checkCurrentReadingVerse, 150);
    };

    window.addEventListener('scroll', onWindowScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      if (scrollDebounce) clearTimeout(scrollDebounce);
    };
  }, [verses, isLoading]);

  // اسکرول خودکار به آیه جاری هنگام پخش ترتیل صوتی (P5-T6)
  useEffect(() => {
    if (activePlayingVerseNumber !== null) {
      performScrollToVerse(activePlayingVerseNumber, 'smooth');
    }
  }, [activePlayingVerseNumber, performScrollToVerse]);

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
      {/* کتیبه فشرده و فاخر سرسوره قرآنی */}
      <QuranicSurahBanner surah={currentSurah} darkMode={darkMode} />

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
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, a, input, select')) return;
                  onPlayVerseAudio(verse.verseNumber);
                  const el = document.getElementById(`verse-${verse.verseNumber}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className={`reader-verse-card p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative group cursor-pointer ${
                  isCurrentlyPlaying
                    ? darkMode
                      ? 'bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/30'
                      : 'bg-teal-50/70 border-teal-400 ring-2 ring-teal-500/20'
                    : darkMode
                    ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-stone-200/90 hover:border-stone-300 shadow-xs'
                }`}
              >
                {/* بسم الله درون کارت آیه اول (برای تمام سوره‌ها به جز سوره ۱ و ۹) با همان فونت و بدون شماره آیه */}
                {verse.verseNumber === 1 && currentSurah.id !== 1 && currentSurah.id !== 9 && (
                  <div
                    className={`text-center py-2.5 mb-3 border-b border-stone-200/50 dark:border-slate-800 font-medium select-none ${arabicLineHeightClass} ${
                      darkMode ? 'text-amber-300/90' : 'text-amber-800'
                    }`}
                    style={{
                      fontFamily: arabicFontFamily,
                      fontSize: `${settings.arabicFontSize}px`,
                    }}
                    dir="rtl"
                  >
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </div>
                )}

                {/* نوار بالایی آیه: فقط جزء و صفحه در هدر کارت (شماره آیه حذف شد و فقط انتهای متن می‌آید) */}
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-stone-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                    <span>جزء {toPersianDigits(verse.juzNumber)}</span>
                    <span>•</span>
                    <span>صفحه {toPersianDigits(verse.pageNumber)}</span>
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
          </>
        )}
      </div>
    </main>
  );
};
