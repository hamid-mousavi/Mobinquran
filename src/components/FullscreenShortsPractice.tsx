import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Palette,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Sparkles,
  BookOpen,
  Type,
} from 'lucide-react';
import { Verse, Surah, AppSettings, ArabicFont } from '../types';
import { toPersianDigits } from '../utils/textNormalization';
import { ReciterId, getAudioSourceUrl } from '../services/audioSources';
import { getArabicFontFamily } from '../utils/fontHelper';

interface FullscreenShortsPracticeProps {
  isOpen: boolean;
  onClose: () => void;
  surah: Surah;
  verses: Verse[];
  startAyah: number;
  endAyah: number;
  reciterId: ReciterId;
  arabicFont: ArabicFont;
}

const BACKGROUND_THEMES = [
  {
    id: 'emerald',
    name: 'حریم زمردی و محراب',
    gradient: 'from-[#021814] via-[#05332a] to-[#011410]',
    accentGlow: 'rgba(52, 211, 153, 0.18)',
    accentColor: '#34d399',
  },
  {
    id: 'midnight',
    name: 'شب قدر و کهکشان',
    gradient: 'from-[#030712] via-[#0b1329] to-[#020617]',
    accentGlow: 'rgba(56, 189, 248, 0.18)',
    accentColor: '#38bdf8',
  },
  {
    id: 'amber',
    name: 'کهربا و مصحف زرین',
    gradient: 'from-[#170e03] via-[#2e1d08] to-[#120a02]',
    accentGlow: 'rgba(251, 191, 36, 0.18)',
    accentColor: '#fbbf24',
  },
  {
    id: 'azure',
    name: 'اقیانوس لاجوردی',
    gradient: 'from-[#031326] via-[#0a274c] to-[#020d1c]',
    accentGlow: 'rgba(96, 165, 250, 0.18)',
    accentColor: '#60a5fa',
  },
  {
    id: 'violet',
    name: 'ارغوان و سحرگاه',
    gradient: 'from-[#14041e] via-[#2d0d40] to-[#100318]',
    accentGlow: 'rgba(216, 180, 254, 0.18)',
    accentColor: '#c084fc',
  },
];

export const FullscreenShortsPractice: React.FC<FullscreenShortsPracticeProps> = ({
  isOpen,
  onClose,
  surah,
  verses,
  startAyah,
  endAyah,
  reciterId,
  arabicFont,
}) => {
  const [currentAyahNumber, setCurrentAyahNumber] = useState<number>(startAyah);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isMasked, setIsMasked] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [fontScale, setFontScale] = useState<number>(0); // 0: بزرگ، 1: خیلی بزرگ، 2: غول‌پیکر
  const [themeIndex, setThemeIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSlideAnimating, setIsSlideAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down'>('up');
  const [autoAdvance, setAutoAdvance] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const lastWheelTime = useRef<number>(0);

  const currentTheme = BACKGROUND_THEMES[themeIndex % BACKGROUND_THEMES.length];
  const currentVerse = verses.find((v) => v.verseNumber === currentAyahNumber);
  const arabicFontFamily = getArabicFontFamily(arabicFont);

  // تغییر سوره یا بازه
  useEffect(() => {
    setCurrentAyahNumber(startAyah);
  }, [startAyah, surah.id]);

  // اسکرول نرم به بالای صفحه با تغییر آیه تا متن کامل از ابتدا دیده شود
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentAyahNumber]);

  // پخش خودکار صوت آیه جاری هنگام باز شدن یا اسلاید
  useEffect(() => {
    if (!isOpen || !currentVerse) return;

    const url = getAudioSourceUrl(reciterId, surah.id, currentAyahNumber, 0);
    if (url && audioRef.current) {
      audioRef.current.src = url;
      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    }

    // تغییر تم با هر آیه
    setThemeIndex((t) => (t + 1) % BACKGROUND_THEMES.length);
  }, [currentAyahNumber, isOpen, reciterId, surah.id]);

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    if (autoAdvance && currentAyahNumber < endAyah) {
      // مکث کوتاه ۱ ثانیه‌ای و رفتن به آیه بعدی
      setTimeout(() => {
        goToNextAyah();
      }, 1000);
    }
  };

  const goToNextAyah = useCallback(() => {
    if (isSlideAnimating) return;
    if (currentAyahNumber < endAyah) {
      setSlideDirection('up');
      setIsSlideAnimating(true);
      setTimeout(() => {
        setCurrentAyahNumber((prev) => prev + 1);
        setIsSlideAnimating(false);
      }, 250);
    }
  }, [currentAyahNumber, endAyah, isSlideAnimating]);

  const goToPrevAyah = useCallback(() => {
    if (isSlideAnimating) return;
    if (currentAyahNumber > startAyah) {
      setSlideDirection('down');
      setIsSlideAnimating(true);
      setTimeout(() => {
        setCurrentAyahNumber((prev) => prev - 1);
        setIsSlideAnimating(false);
      }, 250);
    }
  }, [currentAyahNumber, startAyah, isSlideAnimating]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaTime = Date.now() - touchStartTime.current;

    // بررسی آیا صفحه اسکرول خورده است تا کاربر ابتدا متن بلند را بخواند
    const scrollEl = mainScrollRef.current;
    if (scrollEl) {
      const isScrollable = scrollEl.scrollHeight > scrollEl.clientHeight + 25;
      if (isScrollable) {
        const isAtBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 30;
        const isAtTop = scrollEl.scrollTop <= 15;

        // فقط وقتی کاربر به انتهای آیه رسیده باشد و سوایپ سریع بزند، به آیه بعدی برود
        if (deltaY > 60 && deltaTime < 400 && isAtBottom) {
          goToNextAyah();
        } else if (deltaY < -60 && deltaTime < 400 && isAtTop) {
          goToPrevAyah();
        }
        return;
      }
    }

    if (Math.abs(deltaY) > 40 && deltaTime < 450) {
      if (deltaY > 0) {
        goToNextAyah();
      } else {
        goToPrevAyah();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const scrollEl = mainScrollRef.current;
    if (scrollEl) {
      const isScrollable = scrollEl.scrollHeight > scrollEl.clientHeight + 20;
      if (isScrollable) {
        const isAtBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 25;
        const isAtTop = scrollEl.scrollTop <= 15;

        // اجازه اسکرول طبیعی متن آیه با غلتک ماوس داده می‌شود، مگر اینکه در انتها/ابتدا باشیم
        const now = Date.now();
        if (now - lastWheelTime.current < 500) return;

        if (e.deltaY > 50 && isAtBottom) {
          lastWheelTime.current = now;
          goToNextAyah();
        } else if (e.deltaY < -50 && isAtTop) {
          lastWheelTime.current = now;
          goToPrevAyah();
        }
        return;
      }
    }

    const now = Date.now();
    if (now - lastWheelTime.current < 450) return;
    lastWheelTime.current = now;

    if (e.deltaY > 30) {
      goToNextAyah();
    } else if (e.deltaY < -30) {
      goToPrevAyah();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
    }
  };

  if (!isOpen) return null;

  const totalAyahs = endAyah - startAyah + 1;
  const currentProgress = currentAyahNumber - startAyah + 1;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden select-none bg-gradient-to-b ${currentTheme.gradient} text-white transition-colors duration-700`}
      dir="rtl"
    >
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* الگوهای هندسی و هاله نوری ملکوتی در پس‌زمینه */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 35%, ${currentTheme.accentGlow}, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

      {/* نوار سربرگ */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              onClose();
            }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/90 transition-all cursor-pointer"
            title="خروج"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>تمرین حفظ</span>
            </h2>
            <div className="text-[11px] text-white/60">
              سوره {surah.nameArabic} • آیه {toPersianDigits(currentAyahNumber)} از {toPersianDigits(endAyah)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* کلید تغییر اندازه فونت در سربرگ */}
          <button
            onClick={() => setFontScale((prev) => (prev + 1) % 3)}
            className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title="اندازه قلم و خوانایی متن"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">
              {fontScale === 0 ? 'فونت بزرگ' : fontScale === 1 ? 'خیلی بزرگ' : 'غول‌پیکر'}
            </span>
            <span className="xs:hidden font-black">
              {fontScale === 0 ? 'A' : fontScale === 1 ? 'A+' : 'A++'}
            </span>
          </button>

          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-teal-300">
            {toPersianDigits(currentProgress)} از {toPersianDigits(totalAyahs)} آیه
          </div>

          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white/80 transition-all cursor-pointer"
            title={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* خط باریک پیشرفت در بالاترین نقطه */}
      <div className="relative z-20 w-full bg-white/10 h-1">
        <div
          className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-300 transition-all duration-300"
          style={{ width: `${(currentProgress / totalAyahs) * 100}%` }}
        />
      </div>

      {/* بدنه اصلی نمایش آیه با اسکرول آزاد و اسلاید روان */}
      <main
        ref={mainScrollRef}
        className="relative flex-1 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 overflow-y-auto reels-scrollbar scroll-smooth"
      >
        {currentVerse ? (
          <div
            className={`w-full max-w-3xl mx-auto flex flex-col justify-between my-auto py-2 sm:py-6 space-y-6 transition-all duration-300 ease-out transform ${
              isSlideAnimating
                ? slideDirection === 'up'
                  ? '-translate-y-8 opacity-0 scale-95'
                  : 'translate-y-8 opacity-0 scale-95'
                : 'translate-y-0 opacity-100 scale-100'
            }`}
          >
            <div className="text-center pt-2">
              <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                سوره {surah.nameArabic} • آیه {toPersianDigits(currentVerse.verseNumber)}
              </span>
            </div>

            {/* کارت فراز آیه با فونت بزرگتر و قابلیت اسکرول کامل */}
            <div className="p-6 sm:p-10 rounded-3xl bg-black/45 backdrop-blur-2xl border border-white/15 text-center shadow-2xl relative space-y-6">
              <div
                className={`font-bold transition-all duration-300 ${
                  isMasked ? 'blur-md select-none opacity-20' : 'text-slate-50'
                } ${
                  fontScale === 0
                    ? 'text-3xl sm:text-5xl md:text-6xl leading-[2.6]'
                    : fontScale === 1
                    ? 'text-4xl sm:text-6xl md:text-7xl leading-[2.8]'
                    : 'text-5xl sm:text-7xl md:text-8xl leading-[3.0]'
                }`}
                style={{ fontFamily: arabicFontFamily }}
                dir="rtl"
              >
                {currentVerse.textArabic}
              </div>

              {showTranslation && (
                <div
                  className={`leading-relaxed font-normal pt-4 border-t border-white/10 max-w-2xl mx-auto transition-all ${
                    fontScale === 0
                      ? 'text-base sm:text-xl text-teal-100/90'
                      : fontScale === 1
                      ? 'text-lg sm:text-2xl text-teal-100/95 font-medium'
                      : 'text-xl sm:text-3xl text-teal-50 font-medium'
                  }`}
                >
                  {currentVerse.translationMakarem || currentVerse.translationFooladvand}
                </div>
              )}
            </div>

            {/* نوار راهنمای اسلاید پایین */}
            <div className="flex items-center justify-between text-xs text-white/60 pb-3">
              <div className="flex items-center gap-1.5 font-medium">
                <ChevronUp className="w-4 h-4 animate-bounce text-amber-300" />
                <span>برای آیه بعد به بالا بکشید (یا کلیک روی دکمه)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevAyah}
                  disabled={currentAyahNumber <= startAyah}
                  className={`px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer ${
                    currentAyahNumber <= startAyah ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                >
                  آیه قبلی
                </button>
                <button
                  onClick={goToNextAyah}
                  disabled={currentAyahNumber >= endAyah}
                  className={`px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold transition-all cursor-pointer ${
                    currentAyahNumber >= endAyah ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                >
                  آیه بعدی
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3 my-auto">
            <h3 className="text-lg font-bold">پایان بازه تمرین</h3>
            <button
              onClick={() => setCurrentAyahNumber(startAyah)}
              className="px-4 py-2 rounded-xl bg-teal-500 text-white font-bold text-xs"
            >
              شروع مجدد
            </button>
          </div>
        )}

        {/* دکمه‌های شناور کناری */}
        <aside className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
          {/* پخش/توقف صوت */}
          <button
            onClick={togglePlayAudio}
            className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
              isPlayingAudio
                ? 'bg-teal-500 border-teal-300 text-white shadow-lg shadow-teal-500/50 animate-pulse'
                : 'bg-black/40 border-white/20 text-white/80 hover:bg-white/20'
            }`}
            title={isPlayingAudio ? 'توقف صوت' : 'پخش صوت ترتیل'}
          >
            {isPlayingAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          {/* تغییر اندازه فونت و بزرگنمایی */}
          <button
            onClick={() => setFontScale((prev) => (prev + 1) % 3)}
            className="w-11 h-11 rounded-full bg-black/40 border border-white/20 text-white hover:bg-white/20 backdrop-blur-md flex flex-col items-center justify-center transition-all cursor-pointer active:scale-90"
            title={`اندازه قلم: ${fontScale === 0 ? 'بزرگ' : fontScale === 1 ? 'خیلی بزرگ' : 'غول‌پیکر'}`}
          >
            <Type className="w-4 h-4 text-amber-300" />
            <span className="text-[9px] font-black text-amber-300">
              {fontScale === 0 ? 'A' : fontScale === 1 ? 'A+' : 'A++'}
            </span>
          </button>

          {/* پنهان‌سازی متن برای خودآزمایی */}
          <button
            onClick={() => setIsMasked(!isMasked)}
            className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
              isMasked
                ? 'bg-amber-500 border-amber-300 text-slate-950 font-bold'
                : 'bg-black/40 border-white/20 text-white/80 hover:bg-white/20'
            }`}
            title={isMasked ? 'آشکارسازی متن' : 'پنهان‌سازی متن آیه'}
          >
            {isMasked ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>

          {/* تغییر تم رنگی */}
          <button
            onClick={() => setThemeIndex((t) => (t + 1) % BACKGROUND_THEMES.length)}
            className="w-11 h-11 rounded-full bg-black/40 border border-white/20 text-white/80 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer active:scale-90"
            title={`تغییر پس‌زمینه (فعلی: ${currentTheme.name})`}
          >
            <Palette className="w-5 h-5" />
          </button>

          {/* آیه قبلی */}
          <button
            onClick={goToPrevAyah}
            disabled={currentAyahNumber <= startAyah}
            className={`w-11 h-11 rounded-full bg-black/40 border border-white/20 text-white/80 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
              currentAyahNumber <= startAyah ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            title="آیه قبلی (اسلاید به پایین)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          {/* آیه بعدی */}
          <button
            onClick={goToNextAyah}
            disabled={currentAyahNumber >= endAyah}
            className={`w-11 h-11 rounded-full bg-teal-500/80 hover:bg-teal-500 border border-teal-300 text-white backdrop-blur-md flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md ${
              currentAyahNumber >= endAyah ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            title="آیه بعدی (اسلاید به بالا)"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </aside>
      </main>
    </div>
  );
};
