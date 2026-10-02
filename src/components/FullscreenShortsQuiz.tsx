import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
  Palette,
  Flame,
  HelpCircle,
  Eye,
  EyeOff,
  BookOpen,
  Share2,
  Trophy,
} from 'lucide-react';
import { toPersianDigits } from '../utils/textNormalization';

export interface ShortsQuestion {
  id: string;
  prompt: string;
  contextText?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  surahName: string;
  verseNumber: number;
  verseAudioUrl?: string | null;
  categoryBadge?: string;
}

interface FullscreenShortsQuizProps {
  isOpen: boolean;
  onClose: () => void;
  questions: ShortsQuestion[];
  title?: string;
  onRestart?: () => void;
}

// تم‌های رنگی پویا و عرفانی پس‌زمینه
const BACKGROUND_THEMES = [
  {
    id: 'midnight',
    name: 'شب قدر و کهکشان',
    gradient: 'from-[#030712] via-[#0b1329] to-[#020617]',
    accentGlow: 'rgba(56, 189, 248, 0.15)',
    accentColor: '#38bdf8',
  },
  {
    id: 'emerald',
    name: 'حریم زمردی و محراب',
    gradient: 'from-[#021814] via-[#05332a] to-[#011410]',
    accentGlow: 'rgba(52, 211, 153, 0.15)',
    accentColor: '#34d399',
  },
  {
    id: 'amber',
    name: 'کهربا و زرین کهن',
    gradient: 'from-[#170e03] via-[#2e1d08] to-[#120a02]',
    accentGlow: 'rgba(251, 191, 36, 0.15)',
    accentColor: '#fbbf24',
  },
  {
    id: 'azure',
    name: 'اقیانوس لاجوردی',
    gradient: 'from-[#031326] via-[#0a274c] to-[#020d1c]',
    accentGlow: 'rgba(96, 165, 250, 0.15)',
    accentColor: '#60a5fa',
  },
  {
    id: 'violet',
    name: 'ارغوان و سحرگاه',
    gradient: 'from-[#14041e] via-[#2d0d40] to-[#100318]',
    accentGlow: 'rgba(216, 180, 254, 0.15)',
    accentColor: '#c084fc',
  },
];

export const FullscreenShortsQuiz: React.FC<FullscreenShortsQuizProps> = ({
  isOpen,
  onClose,
  questions,
  title = 'آزمون تخصصی حفظ قرآن',
  onRestart,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [themeIndex, setThemeIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSlideAnimating, setIsSlideAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down'>('up');
  const [isFinished, setIsFinished] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const lastWheelTime = useRef<number>(0);

  const currentTheme = BACKGROUND_THEMES[themeIndex % BACKGROUND_THEMES.length];
  const currentQ = questions[currentIndex];

  // ورود به حالت فول اسکرین مرورگر در صورت امکان
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // توقف صوت هنگام تغییر سوال
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
  }, [currentIndex]);

  // تغییر خودکار تم پس‌زمینه با هر سوال
  useEffect(() => {
    setThemeIndex((prev) => (prev + 1) % BACKGROUND_THEMES.length);
  }, [currentIndex]);

  // رفتن به سوال بعدی با انیمیشن اسلاید به بالا (یوتیوب شورتز)
  const goToNextQuestion = useCallback(() => {
    if (isSlideAnimating) return;
    if (currentIndex + 1 < questions.length) {
      setSlideDirection('up');
      setIsSlideAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setIsSlideAnimating(false);
      }, 260);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, questions.length, isSlideAnimating]);

  // رفتن به سوال قبلی با اسلاید به پایین
  const goToPrevQuestion = useCallback(() => {
    if (isSlideAnimating || currentIndex === 0) return;
    setSlideDirection('down');
    setIsSlideAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => prev - 1);
      setIsSlideAnimating(false);
    }, 260);
  }, [currentIndex, isSlideAnimating]);

  // رویدادهای لمسی گوشی (Swipe Up / Swipe Down)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaTime = Date.now() - touchStartTime.current;

    // اگر حرکت عمودی سریع و بیش از ۴۰ پیکسل بود
    if (Math.abs(deltaY) > 40 && deltaTime < 450) {
      if (deltaY > 0) {
        // بالا کشیدن: سوال بعدی
        goToNextQuestion();
      } else {
        // پایین کشیدن: سوال قبلی
        goToPrevQuestion();
      }
    }
  };

  // اسکرول ماوس / ترک‌پد در دسکتاپ
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 450) return; // دبانس
    lastWheelTime.current = now;

    if (e.deltaY > 30) {
      goToNextQuestion();
    } else if (e.deltaY < -30) {
      goToPrevQuestion();
    }
  };

  // کلیدهای میانبر کیبورد (فلش بالا/پایین)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextQuestion();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevQuestion();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNextQuestion, goToPrevQuestion, onClose]);

  // ثبت پاسخ
  const handleSelectOption = (optIndex: number) => {
    if (selectedAnswers[currentIndex] !== undefined) return;

    const isCorrect = optIndex === currentQ.correctIndex;
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: optIndex }));

    if (isCorrect) {
      setScore((s) => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
    } else {
      setStreak(0);
    }

    // پخش خودکار صوت در صورت وجود
    if (currentQ.verseAudioUrl && audioRef.current) {
      audioRef.current.src = currentQ.verseAudioUrl;
      audioRef.current.play().catch(() => {});
      setIsPlayingAudio(true);
    }

    // نمایش خودکار توضیح
    setShowExplanation((prev) => ({ ...prev, [currentIndex]: true }));
  };

  const handleToggleAudio = () => {
    if (!currentQ?.verseAudioUrl || !audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.src = currentQ.verseAudioUrl;
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden select-none bg-gradient-to-b ${currentTheme.gradient} text-white transition-colors duration-700`}
      dir="rtl"
    >
      <audio
        ref={audioRef}
        onEnded={() => setIsPlayingAudio(false)}
        className="hidden"
      />

      {/* الگوهای هندسی و هاله نوری ملکوتی در پس‌زمینه */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 35%, ${currentTheme.accentGlow}, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

      {/* نوار سربرگ فوقانی و خروج */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/90 transition-all cursor-pointer"
            title="خروج"
            aria-label="خروج"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{title}</span>
            </h2>
            <div className="text-[11px] text-white/60">
              سوره {currentQ?.surahName} • آیه {toPersianDigits(currentQ?.verseNumber || 1)}
            </div>
          </div>
        </div>

        {/* نشانگرهای امتیاز و زنجیره پیوسته */}
        <div className="flex items-center gap-2.5">
          {streak > 1 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black animate-pulse">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{toPersianDigits(streak)} پیاپی!</span>
            </div>
          )}

          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-teal-300">
            {toPersianDigits(score)} از {toPersianDigits(questions.length)} درست
          </div>

          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white/80 transition-all cursor-pointer"
            title={isFullscreen ? 'خروج از تمام‌صفحه' : 'حالت تمام‌صفحه مرورگر'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* خط باریک پیشرفت در بالاترین نقطه */}
      <div className="relative z-20 w-full bg-white/10 h-1">
        <div
          className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-300 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* بخش اصلی کارت شورتز با پشتیبانی از اسلاید */}
      <main className="relative flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {!isFinished && currentQ ? (
          <div
            className={`w-full max-w-xl mx-auto flex flex-col justify-between h-full max-h-[82vh] transition-all duration-300 ease-out transform ${
              isSlideAnimating
                ? slideDirection === 'up'
                  ? '-translate-y-8 opacity-0 scale-95'
                  : 'translate-y-8 opacity-0 scale-95'
                : 'translate-y-0 opacity-100 scale-100'
            }`}
          >
            {/* کارت فراز و متن اصلی سوال */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 font-bold">
                  سوال {toPersianDigits(currentIndex + 1)} از {toPersianDigits(questions.length)}
                </span>
                {currentQ.categoryBadge && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-medium">
                    {currentQ.categoryBadge}
                  </span>
                )}
              </div>

              {/* متن صورت سوال */}
              <div className="text-base sm:text-lg font-bold text-white leading-relaxed">
                {currentQ.prompt}
              </div>

              {/* کادر فراز شریفه قرآنی */}
              {currentQ.contextText && (
                <div className="p-4 sm:p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/15 text-center shadow-2xl relative overflow-hidden">
                  <div
                    className="text-xl sm:text-2xl font-bold leading-loose text-amber-100 py-1"
                    style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                  >
                    «{currentQ.contextText}»
                  </div>
                  {showHint[currentIndex] && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/70 animate-fadeIn">
                      راهنمایی: این فراز در سوره {currentQ.surahName}، آیه {toPersianDigits(currentQ.verseNumber)} قرار دارد.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* گزینه‌های چهارگانه */}
            <div className="space-y-2.5 my-3">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedAnswers[currentIndex] === idx;
                const isSubmitted = selectedAnswers[currentIndex] !== undefined;
                const isCorrect = idx === currentQ.correctIndex;

                let cardStyle = 'bg-white/10 hover:bg-white/20 border-white/15 text-white';

                if (isSubmitted) {
                  if (isCorrect) {
                    cardStyle =
                      'bg-emerald-600/70 border-emerald-400 text-white font-bold ring-2 ring-emerald-400/60 shadow-lg scale-[1.01]';
                  } else if (isSelected && !isCorrect) {
                    cardStyle = 'bg-red-600/70 border-red-400 text-white font-medium ring-2 ring-red-400/60';
                  } else {
                    cardStyle = 'bg-black/30 border-white/5 opacity-40 text-white/60';
                  }
                } else if (isSelected) {
                  cardStyle = 'bg-teal-500/40 border-teal-300 ring-2 ring-teal-300/60 text-white';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full p-3.5 sm:p-4 rounded-2xl border backdrop-blur-md text-right transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-white/15 text-xs font-bold flex items-center justify-center shrink-0">
                        {toPersianDigits(idx + 1)}
                      </span>
                      <span
                        className="text-sm sm:text-base font-medium leading-relaxed"
                        style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                      >
                        {option}
                      </span>
                    </div>

                    {isSubmitted && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 animate-bounce" />
                    )}
                    {isSubmitted && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-red-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* بخش پیام توضیح و دکمه اسلاید به سوال بعد */}
            <div className="space-y-3 pb-2">
              {showExplanation[currentIndex] && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-black/40 border border-white/15 text-xs sm:text-sm text-white/90 leading-relaxed backdrop-blur-md animate-fadeIn">
                  <div className="font-bold text-amber-300 mb-0.5">پاسخ و تبیین قرآنی:</div>
                  <div>{currentQ.explanation}</div>
                </div>
              )}

              {/* راهنما و دکمه اسلاید شورتز */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
                  <ChevronUp className="w-4 h-4 animate-bounce text-amber-300" />
                  <span>برای سوال بعد به بالا بکشید (Swipe Up)</span>
                </div>

                <button
                  onClick={goToNextQuestion}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm shadow-lg flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <span>{currentIndex + 1 < questions.length ? 'سوال بعدی' : 'مشاهده نتیجه'}</span>
                  <ChevronUp className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* صحنه شکوهمند کارنامه پایانی شورتز */
          <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-black/50 backdrop-blur-2xl border border-white/20 text-center space-y-6 shadow-2xl animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 mx-auto flex items-center justify-center shadow-lg animate-pulse">
              <Trophy className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {score === questions.length
                  ? 'تسلط ۱۰۰٪ قرآنی! بی‌نظیر بود'
                  : score >= questions.length * 0.75
                  ? 'بسیار عالی و با تسلط بالا'
                  : 'تلاش ارزشمند؛ نیازمند مرور بیشتر'}
              </h3>
              <p className="text-xs text-white/70 mt-1">کارنامه نهایی آزمون</p>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-center">
                <div className="text-2xl font-black text-teal-400">
                  {toPersianDigits(Math.round((score / questions.length) * 100))}٪
                </div>
                <div className="text-[10px] text-white/60">درصد درستی</div>
              </div>
              <div className="text-center border-x border-white/10">
                <div className="text-2xl font-black text-emerald-400">
                  {toPersianDigits(score)}/{toPersianDigits(questions.length)}
                </div>
                <div className="text-[10px] text-white/60">پاسخ‌های صحیح</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4 fill-current" />
                  {toPersianDigits(maxStreak)}
                </div>
                <div className="text-[10px] text-white/60">بیشترین پیاپی</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setSelectedAnswers({});
                  setShowExplanation({});
                  setShowHint({});
                  setScore(0);
                  setStreak(0);
                  setIsFinished(false);
                  onRestart?.();
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تکرار آزمون</span>
              </button>

              <button
                onClick={onClose}
                className="py-3 px-5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                بازگشت
              </button>
            </div>
          </div>
        )}

        {/* ستون کناری عملیات شناور (شبیه نوار کناری یوتیوب شورتز / ریلز) */}
        {!isFinished && currentQ && (
          <aside className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3.5">
            {/* صوت ترتیل */}
            {currentQ.verseAudioUrl && (
              <button
                onClick={handleToggleAudio}
                className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                  isPlayingAudio
                    ? 'bg-teal-500 border-teal-300 text-white shadow-lg shadow-teal-500/50 animate-pulse'
                    : 'bg-black/40 border-white/20 text-white/80 hover:bg-white/20'
                }`}
                title="استماع ترتیل این آیه"
              >
                {isPlayingAudio ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 opacity-70" />}
              </button>
            )}

            {/* کلید راهنمایی آیه */}
            <button
              onClick={() =>
                setShowHint((prev) => ({ ...prev, [currentIndex]: !prev[currentIndex] }))
              }
              className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                showHint[currentIndex]
                  ? 'bg-amber-500 border-amber-300 text-slate-950'
                  : 'bg-black/40 border-white/20 text-white/80 hover:bg-white/20'
              }`}
              title="نمایش راهنمایی"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* تغییر تم پس‌زمینه */}
            <button
              onClick={() => setThemeIndex((prev) => (prev + 1) % BACKGROUND_THEMES.length)}
              className="w-11 h-11 rounded-full bg-black/40 border border-white/20 text-white/80 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer active:scale-90"
              title={`تغییر پس‌زمینه (فعلی: ${currentTheme.name})`}
            >
              <Palette className="w-5 h-5" />
            </button>

            {/* سوال قبلی */}
            <button
              onClick={goToPrevQuestion}
              disabled={currentIndex === 0}
              className={`w-11 h-11 rounded-full bg-black/40 border border-white/20 text-white/80 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''
              }`}
              title="سوال قبلی (اسلاید به پایین)"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            {/* سوال بعدی */}
            <button
              onClick={goToNextQuestion}
              className="w-11 h-11 rounded-full bg-teal-500/80 hover:bg-teal-500 border border-teal-300 text-white backdrop-blur-md flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md"
              title="سوال بعدی (اسلاید به بالا)"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </aside>
        )}
      </main>
    </div>
  );
};
