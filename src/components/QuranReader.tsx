import React, { useEffect } from 'react';
import { Bookmark, Sparkles, Copy, BookOpen, Play, Volume2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Verse, Surah, AppSettings } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';

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
}) => {
  // اسکرول خودکار به آیه جاری هنگام پخش ترتیل صوتی
  useEffect(() => {
    if (activePlayingVerseNumber !== null) {
      const verseEl = document.getElementById(`verse-${activePlayingVerseNumber}`);
      if (verseEl) {
        verseEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activePlayingVerseNumber]);

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
      {/* بنر معنوی سوره به سبک کتیبه‌های مصحف شریف */}
      <div
        id="surah-header-banner"
        className={`relative overflow-hidden rounded-3xl p-6 text-center border shadow-sm transition-all ${
          darkMode
            ? 'bg-gradient-to-b from-slate-900 via-teal-950/40 to-slate-900 border-teal-800/40 text-slate-100'
            : 'bg-gradient-to-b from-stone-50 via-teal-50/50 to-stone-50 border-stone-200 text-slate-800'
        }`}
      >
        <div className="absolute top-2 right-4 text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
          جزء {currentSurah.juzNumber}
        </div>
        <div className="absolute top-2 left-4 text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
          صفحه {currentSurah.startPage}
        </div>

        <div className="inline-block p-1 px-4 mb-2 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          سوره شماره {currentSurah.id} • {currentSurah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
        </div>

        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight text-teal-800 dark:text-teal-200 mb-1"
          style={{ fontFamily: "'Amiri', serif" }}
        >
          سُورَةُ {currentSurah.nameArabic}
        </h1>

        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {currentSurah.namePersian} ({currentSurah.englishName}) • {currentSurah.versesCount} آیه
        </p>
      </div>

      {/* سرآغاز بسم الله (به جز سوره توبه - شماره ۹) */}
      {currentSurah.id !== 9 && (
        <div
          id="bismillah-banner"
          className="py-4 text-center select-none"
          dir="rtl"
        >
          <div
            className={`inline-block text-2xl sm:text-3xl font-medium tracking-wide ${
              darkMode ? 'text-amber-300/90' : 'text-teal-900'
            }`}
            style={{ fontFamily: "'Amiri Quran', serif" }}
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </div>
          <div className="h-0.5 w-24 mx-auto mt-3 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60" />
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
          verses.map((verse) => {
            const isBookmarked = bookmarkedVerseIds.has(verse.verseNumber);
            const isCurrentlyPlaying = activePlayingVerseNumber === verse.verseNumber;

            return (
              <article
                key={verse.id}
                id={`verse-${verse.verseNumber}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative group ${
                  isCurrentlyPlaying
                    ? darkMode
                      ? 'bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/30'
                      : 'bg-teal-50/70 border-teal-400 ring-2 ring-teal-500/20'
                    : darkMode
                    ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-stone-200/90 hover:border-stone-300 shadow-sm'
                }`}
              >
                {/* نوار بالایی آیه: شماره آیه و ابزارها */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        isCurrentlyPlaying
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : darkMode
                          ? 'bg-slate-800 text-teal-400'
                          : 'bg-stone-100 text-teal-700'
                      }`}
                    >
                      {verse.verseNumber}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      جزء {verse.juzNumber} • صفحه {verse.pageNumber}
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

                {/* متن عربی آیه با خط و اعراب برجسته */}
                <div
                  className={`text-right font-medium transition-all tracking-normal ${arabicLineHeightClass} ${
                    darkMode ? 'text-slate-100' : 'text-slate-900'
                  }`}
                  style={{
                    fontFamily: arabicFontFamily,
                    fontSize: `${settings.arabicFontSize}px`,
                  }}
                  dir="rtl"
                >
                  {verse.textArabic}
                  {/* نشانگر انتهای آیه در دل متن عربی */}
                  <span
                    className="inline-flex items-center justify-center mx-1.5 text-amber-600 dark:text-amber-400 font-bold opacity-85 select-none"
                    style={{ fontSize: '0.85em' }}
                  >
                    ﴿{verse.verseNumber}﴾
                  </span>
                </div>

                {/* ترجمه فارسی آیه */}
                {settings.showTranslation && (
                  <div className="mt-3.5 pt-3 border-t border-dashed border-stone-200/80 dark:border-slate-800">
                    <p
                      className={`text-right leading-relaxed ${
                        darkMode ? 'text-slate-300' : 'text-stone-700'
                      }`}
                      style={{ fontSize: `${settings.translationFontSize}px` }}
                      dir="rtl"
                    >
                      {getTranslationText(verse)}
                    </p>
                    <div className="text-[11px] text-slate-400 mt-1">
                      ترجمه: {settings.activeTranslator === 'makarem' ? 'آیت‌الله مکارم شیرازی' : settings.activeTranslator === 'fooladvand' ? 'استاد فولادوند' : 'استاد انصاریان'}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </main>
  );
};
