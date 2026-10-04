import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Volume2,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
  Award,
  Play,
  ArrowRight,
  Flame,
  Check,
  Eye,
  CornerDownLeft,
  Undo2,
  Send,
  HelpCircle,
} from 'lucide-react';
import { toPersianDigits } from '../utils/textNormalization';
import { quizAudio } from '../utils/quizAudio';

export interface QuizQuestionItem {
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
  fullVerseText?: string;
  fullVerseTranslation?: string;
  isBlankFill?: boolean;
  questionMode?: 'mcq' | 'ordering' | 'matching' | 'typing';
  // داده‌های تکمیلی برای سبک‌های نوین
  orderingTokens?: string[]; // کلمات به‌هم‌ریخته برای حالت چینشی
  matchingPairs?: { id: string; left: string; right: string }[]; // جفت‌های وصلی
  targetWord?: string; // کلمه هدف برای حالت تایپی
}

interface RealisticQuizViewProps {
  questions: QuizQuestionItem[];
  title?: string;
  totalQuizTimeSeconds?: number;
  isTimerEnabled?: boolean;
  timePerQuestion?: number;
  arabicFont?: string;
  onClose: () => void;
  onRestart: () => void;
  onFinish?: (score: number, total: number) => void;
}

const OPTION_LABELS = ['الف', 'ب', 'ج', 'د'];

// فرمت‌بندی ایمن متن گزینه برای جلوگیری از به هم خوردن پرانتزها و علائم
const sanitizeOptionText = (text: string): string => {
  if (!text) return '';
  let t = text.trim();
  t = t.replace(/^(\.\.\.|…|\.\s*)+/, '').trim();
  return t;
};

// نمایش نقطه‌های قرمز در پرانتز به جای [جای خالی]
export const renderAyahWithRedDots = (text?: string): React.ReactNode => {
  if (!text) return null;
  const normalized = text
    .replace(/\[\s*جای خالی\s*\]/g, '(__BLANK__)')
    .replace(/\(\s*(\.\.\.|…|•\s*•\s*•|\s*)\s*\)/g, '(__BLANK__)');

  if (!normalized.includes('(__BLANK__)')) {
    return text;
  }

  const parts = normalized.split('(__BLANK__)');
  return (
    <>
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          {part}
          {idx < parts.length - 1 && (
            <span className="inline-flex items-center justify-center align-middle mx-1 px-2 py-0.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 font-black tracking-widest text-base sm:text-lg select-none">
              <span className="text-red-500 font-sans tracking-widest text-sm sm:text-base">( • • • )</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </>
  );
};

export const RealisticQuizView: React.FC<RealisticQuizViewProps> = ({
  questions,
  title = 'آزمون سنجش حفظ قرآن',
  totalQuizTimeSeconds,
  isTimerEnabled = true,
  timePerQuestion,
  onClose,
  onRestart,
  onFinish,
}) => {
  // زمان کل آزمون (پیش‌فرض: برای هر سوال ۴۵ ثانیه => برای ۲۰ سوال ۱۵ دقیقه)
  const defaultTotalSeconds = useMemo(() => {
    if (typeof totalQuizTimeSeconds === 'number' && totalQuizTimeSeconds > 0) {
      return totalQuizTimeSeconds;
    }
    return Math.max(60, Math.round(questions.length * 45));
  }, [totalQuizTimeSeconds, questions.length]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [userAnswers, setUserAnswers] = useState<
    Array<{
      questionIndex: number;
      selected: number;
      selectedText?: string;
      isCorrect: boolean;
      question: QuizQuestionItem;
    }>
  >([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // وضعیت باز/بسته بودن متن طولانی آیه (فقط اگر آیه طولانی باشد)
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  // وضعیت باز/بسته بودن گزینه‌های چندخطی بر اساس ایندکس گزینه
  const [expandedOptions, setExpandedOptions] = useState<Record<number, boolean>>({});

  // وضعیت‌های اختصاصی سبک چینشی (Ordering)
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);

  // وضعیت‌های اختصاصی سبک تایپی (Typing)
  const [typedAnswer, setTypedAnswer] = useState('');

  // وضعیت‌های اختصاصی سبک وصلی (Matching)
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [selectedLeftMatch, setSelectedLeftMatch] = useState<string | null>(null);

  // تایمر کل آزمون
  const [totalTimeLeft, setTotalTimeLeft] = useState<number>(defaultTotalSeconds);

  // صوت آیه
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);

  const currentQ = questions[currentIndex];

  // تشخیص طولانی بودن آیه سوال (برای نمایش فلش گسترش)
  const isQuestionTextLong = useMemo(() => {
    if (!currentQ?.contextText) return false;
    const wordCount = currentQ.contextText.trim().split(/\s+/).length;
    return wordCount > 13 || currentQ.contextText.length > 70;
  }, [currentQ?.contextText]);

  // بازنشانی وضعیت هنگام تغییر سوال
  useEffect(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setIsQuestionExpanded(false);
    setExpandedOptions({});
    setSelectedTokens([]);
    setTypedAnswer('');
    setMatchedPairs({});
    setSelectedLeftMatch(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
  }, [currentIndex]);

  // ریست کامل وضعیت هنگام تغییر لیست سوالات یا فراخوانی تکرار
  const resetEntireQuiz = useCallback(() => {
    scoreRef.current = 0;
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setUserAnswers([]);
    setIsFinished(false);
    setIsReviewMode(false);
    setIsQuestionExpanded(false);
    setExpandedOptions({});
    setSelectedTokens([]);
    setTypedAnswer('');
    setMatchedPairs({});
    setSelectedLeftMatch(null);
    setTotalTimeLeft(defaultTotalSeconds);
    if (autoNextTimerRef.current) {
      window.clearTimeout(autoNextTimerRef.current);
    }
  }, [defaultTotalSeconds]);

  // شمارش معکوس تایمر کل آزمون
  useEffect(() => {
    if (!isTimerEnabled || isFinished || isReviewMode || defaultTotalSeconds <= 0) return;

    const timer = setInterval(() => {
      setTotalTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleQuizTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerEnabled, isFinished, isReviewMode, defaultTotalSeconds]);

  // پایان مهلت کل آزمون
  const handleQuizTimeOut = useCallback(() => {
    setIsFinished(true);
    quizAudio.playIncorrect();
    if (onFinish) {
      onFinish(scoreRef.current, questions.length);
    }
  }, [questions.length, onFinish]);

  // پاک‌سازی تایمر خودکار هنگام خروج
  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        window.clearTimeout(autoNextTimerRef.current);
      }
    };
  }, []);

  // ثبت و بررسی پاسخ کاربر در حالت ۴ گزینه‌ای
  const handleSelectOption = (index: number) => {
    if (isAnswered || isFinished || !currentQ) return;

    setIsAnswered(true);
    setSelectedOption(index);

    const isCorrect = index === currentQ.correctIndex;

    if (isCorrect) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      quizAudio.playCorrect();
    } else {
      setStreak(0);
      quizAudio.playIncorrect();
    }

    setUserAnswers((prev) => [
      ...prev,
      {
        questionIndex: currentIndex,
        selected: index,
        selectedText: currentQ.options[index],
        isCorrect,
        question: currentQ,
      },
    ]);

    // انتقال خودکار به سوال بعد پس از مکث کوتاه
    autoNextTimerRef.current = window.setTimeout(() => {
      advanceToNextQuestion();
    }, 1400);
  };

  // ثبت و بررسی پاسخ در حالت چینشی (Ordering)
  const handleTokenClick = (token: string, tokenIndex: number) => {
    if (isAnswered || isFinished) return;
    if (selectedTokens.includes(`${token}__${tokenIndex}`)) return;

    const updated = [...selectedTokens, `${token}__${tokenIndex}`];
    setSelectedTokens(updated);

    const expectedTokens = currentQ.orderingTokens || [];
    if (updated.length === expectedTokens.length) {
      setIsAnswered(true);
      const userText = updated.map((t) => t.split('__')[0]).join(' ');
      const expectedText = currentQ.options[currentQ.correctIndex] || expectedTokens.join(' ');
      const isCorrect = userText.trim() === expectedText.trim();

      if (isCorrect) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setStreak((s) => s + 1);
        quizAudio.playCorrect();
      } else {
        setStreak(0);
        quizAudio.playIncorrect();
      }

      setUserAnswers((prev) => [
        ...prev,
        {
          questionIndex: currentIndex,
          selected: isCorrect ? currentQ.correctIndex : -1,
          selectedText: userText,
          isCorrect,
          question: currentQ,
        },
      ]);

      autoNextTimerRef.current = window.setTimeout(() => {
        advanceToNextQuestion();
      }, 1600);
    }
  };

  const handleUndoToken = () => {
    if (isAnswered || selectedTokens.length === 0) return;
    setSelectedTokens((prev) => prev.slice(0, -1));
  };

  // ثبت و بررسی پاسخ در حالت تایپی (Typing)
  const handleSubmitTypedAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnswered || isFinished || !typedAnswer.trim()) return;

    setIsAnswered(true);
    const cleanUser = typedAnswer.trim().replace(/[ًٌٍَُِّْٰ]/g, '');
    const cleanTarget = (currentQ.targetWord || currentQ.options[currentQ.correctIndex] || '')
      .trim()
      .replace(/[ًٌٍَُِّْٰ]/g, '');

    const isCorrect = cleanUser === cleanTarget || typedAnswer.trim() === (currentQ.targetWord || '');

    if (isCorrect) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setStreak((s) => s + 1);
      quizAudio.playCorrect();
    } else {
      setStreak(0);
      quizAudio.playIncorrect();
    }

    setUserAnswers((prev) => [
      ...prev,
      {
        questionIndex: currentIndex,
        selected: isCorrect ? currentQ.correctIndex : -1,
        selectedText: typedAnswer.trim(),
        isCorrect,
        question: currentQ,
      },
    ]);

    autoNextTimerRef.current = window.setTimeout(() => {
      advanceToNextQuestion();
    }, 1500);
  };

  // رفتن به سوال بعدی یا پایان آزمون
  const advanceToNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      if (onFinish) {
        onFinish(scoreRef.current, questions.length);
      }
    }
  };

  // تکرار آزمون با ریست قطعی و کامل وضعیت
  const handleRestartQuiz = () => {
    resetEntireQuiz();
    onRestart();
  };

  // پخش یا توقف صوت ترتیل آیه
  const handleToggleAudio = () => {
    if (!currentQ?.verseAudioUrl || !audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.src = currentQ.verseAudioUrl;
      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    }
  };

  const progressPercent = questions.length > 0 ? Math.round(((currentIndex + (isAnswered ? 1 : 0)) / questions.length) * 100) : 0;

  // فرمت زمان دقیقه و ثانیه (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${toPersianDigits(mins)}:${secs < 10 ? '۰' : ''}${toPersianDigits(secs)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">
      {/* پخش‌کننده صوتی مخفی */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlayingAudio(false)}
        className="hidden"
      />

      {/* سربرگ فشرده، خلوت و کاملاً موبایل‌محور (تک‌خطی) */}
      <header className="shrink-0 px-3 sm:px-5 py-2.5 bg-white dark:bg-slate-900 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between shadow-2xs h-14">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all cursor-pointer active:scale-95 shrink-0"
            title="خروج از آزمون"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">{title}</span>
            </h2>
            {currentQ && !isFinished && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                سوره {currentQ.surahName} • آیه {toPersianDigits(currentQ.verseNumber)}
              </p>
            )}
          </div>
        </div>

        {/* نشانگرهای زمان و امتیاز به صورت فشرده */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isTimerEnabled && !isFinished && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold border transition-all ${
                totalTimeLeft <= 60
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="tabular-nums">{formatTime(totalTimeLeft)}</span>
            </div>
          )}

          {streak > 1 && !isFinished && (
            <div className="hidden xs:flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-black">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{toPersianDigits(streak)}</span>
            </div>
          )}

          <div className="px-2.5 py-1 rounded-xl bg-teal-600/10 border border-teal-500/25 text-teal-700 dark:text-teal-300 text-xs font-bold">
            {toPersianDigits(score)} درست
          </div>
        </div>
      </header>

      {/* نوار باریک پیشرفت سوالات */}
      {!isFinished && (
        <div className="w-full bg-stone-200 dark:bg-slate-800 h-1 shrink-0 overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* محتوای اصلی آزمون */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-5 flex flex-col justify-start max-w-2xl mx-auto w-full">
        {!isFinished && currentQ ? (
          <div className="space-y-3 sm:space-y-4 my-auto w-full">
            {/* ردیف بالای سوال: شماره سوال و سبک */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-[11px]">
                سوال {toPersianDigits(currentIndex + 1)} از {toPersianDigits(questions.length)}
              </span>

              <div className="flex items-center gap-2">
                {currentQ.categoryBadge && (
                  <span className="px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold text-[11px] border border-teal-500/20">
                    {currentQ.categoryBadge}
                  </span>
                )}

                {currentQ.verseAudioUrl && (
                  <button
                    onClick={handleToggleAudio}
                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                      isPlayingAudio
                        ? 'bg-teal-600 text-white border-teal-600 animate-pulse'
                        : 'bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-stone-200 dark:border-slate-700'
                    }`}
                    title="شنیدن تلاوت آیه"
                  >
                    {isPlayingAudio ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* کارت سوال و آیه شریفه با فونت بزرگ، بسیار خوانا و چشم‌نواز */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-3.5">
              {/* صورت سوال - فونت درشت‌تر، خوانا و تفکیک‌شده */}
              <h3 className="font-['Vazirmatn'] text-base sm:text-lg md:text-xl font-extrabold text-slate-900 dark:text-slate-50 leading-relaxed sm:leading-loose text-right tracking-tight">
                {currentQ.prompt}
              </h3>

              {/* باکس آیه شریفه با نقطه‌های قرمز به جای [جای خالی] */}
              {currentQ.contextText && (
                <div className="relative p-4 sm:p-6 rounded-2xl bg-teal-50/50 dark:bg-slate-800/70 border border-teal-500/25 dark:border-slate-700">
                  {/* دکمه فلش کنار باکس فقط در صورتی که آیه واقعاً طولانی باشد ظاهر می‌شود */}
                  <div className="flex items-center justify-between pb-2 border-b border-teal-500/15 dark:border-slate-700/60 mb-2.5">
                    <span className="text-xs font-bold text-teal-800 dark:text-teal-300">
                      فراز قرآنی آیه {toPersianDigits(currentQ.verseNumber)} سوره مبارکه {currentQ.surahName}
                    </span>

                    {/* دکمه گسترش فقط برای آیات طولانی و بدون افشای پاسخ */}
                    {isQuestionTextLong && (
                      <button
                        type="button"
                        onClick={() => setIsQuestionExpanded((prev) => !prev)}
                        className="px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold active:scale-95 shadow-2xs"
                        title={isQuestionExpanded ? 'کوتاه‌سازی نمایش' : 'مشاهده کل فراز سوال'}
                      >
                        <span>{isQuestionExpanded ? 'خلاصه' : 'متن کامل سوال'}</span>
                        {isQuestionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* متن فراز آیه با رسم‌الخط قرآنی درشت، واضح و نقطه‌های قرمز */}
                  <div
                    className={`text-2xl sm:text-3xl md:text-4xl font-normal leading-[2.4] sm:leading-[2.6] text-teal-950 dark:text-teal-100 text-center transition-all ${
                      !isQuestionExpanded && isQuestionTextLong ? 'line-clamp-3' : ''
                    }`}
                    style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                    dir="rtl"
                  >
                    <bdi dir="rtl" className="unicode-isolate">
                      «{renderAyahWithRedDots(currentQ.contextText)}»
                    </bdi>
                  </div>
                </div>
              )}
            </div>

            {/* بخش پاسخ‌ها متناسب با سبک آزمون */}
            {currentQ.questionMode === 'ordering' && currentQ.orderingTokens ? (
              /* سبک چینشی (مرتب‌سازی کلمات) */
              <div className="space-y-3">
                {/* محل قرارگیری کلمات انتخاب شده */}
                <div className="p-3.5 min-h-[58px] rounded-2xl border border-dashed border-teal-500/40 bg-teal-50/20 dark:bg-slate-800/40 flex flex-wrap items-center justify-center gap-2">
                  {selectedTokens.length === 0 ? (
                    <span className="text-xs text-slate-400">کلمات زیر را به ترتیب صحیح لمس کنید…</span>
                  ) : (
                    selectedTokens.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-xl bg-teal-600 text-white font-bold text-sm shadow-xs animate-fadeIn"
                      >
                        {t.split('__')[0]}
                      </span>
                    ))
                  )}
                </div>

                {/* دکمه حذف آخرین کلمه */}
                {selectedTokens.length > 0 && !isAnswered && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleUndoToken}
                      className="px-3 py-1 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>حذف آخرین کلمه</span>
                    </button>
                  </div>
                )}

                {/* بانک کلمات به‌هم‌ریخته برای انتخاب */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {currentQ.orderingTokens.map((token, tIdx) => {
                    const isUsed = selectedTokens.includes(`${token}__${tIdx}`);
                    return (
                      <button
                        key={tIdx}
                        type="button"
                        onClick={() => handleTokenClick(token, tIdx)}
                        disabled={isUsed || isAnswered}
                        className={`px-3.5 py-2 rounded-2xl border text-sm font-bold transition-all cursor-pointer ${
                          isUsed
                            ? 'opacity-30 border-stone-200 dark:border-slate-800 bg-stone-100 dark:bg-slate-800 pointer-events-none'
                            : 'border-teal-500/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-teal-500 active:scale-95 shadow-xs'
                        }`}
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : currentQ.questionMode === 'typing' ? (
              /* سبک تایپی (نوشتاری) */
              <form onSubmit={handleSubmitTypedAnswer} className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    disabled={isAnswered}
                    placeholder="کلمه جاافتاده را بنویسید…"
                    className="flex-1 px-4 py-3 rounded-2xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!typedAnswer.trim() || isAnswered}
                    className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <span>ثبت</span>
                    <Send className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>

                {/* راهنمایی یا گزینه‌های کمکی برای تایپ */}
                {currentQ.options && currentQ.options.length > 0 && !isAnswered && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-400 block mb-1.5">یا از کلمات پیشنهادی انتخاب کنید:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentQ.options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => setTypedAnswer(opt)}
                          className="px-3 py-1 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all border border-stone-200 dark:border-slate-700"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            ) : (
              /* سبک کلاسیک ۴ گزینه‌ای */
              <div className="space-y-2.5">
                {currentQ.options.map((optionRaw, optIndex) => {
                  const optionText = sanitizeOptionText(optionRaw);
                  const isSelected = selectedOption === optIndex;
                  const isCorrectOption = optIndex === currentQ.correctIndex;
                  const showCorrectHighlight = isAnswered && isCorrectOption;
                  const showWrongHighlight = isAnswered && isSelected && !isCorrectOption;
                  const isExpanded = !!expandedOptions[optIndex];
                  // اگر متن گزینه بیشتر از یک خط بود (بیشتر از ۳۵ کاراکتر یا شامل خط جدید)
                  const isMultiLine = optionText.length > 35 || optionText.includes('\n');

                  let borderBgClass = 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500 hover:bg-stone-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100';

                  if (showCorrectHighlight) {
                    borderBgClass = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/40 shadow-xs';
                  } else if (showWrongHighlight) {
                    borderBgClass = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/40 shadow-xs';
                  } else if (isAnswered) {
                    borderBgClass = 'border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-900/50 text-slate-400 opacity-60';
                  }

                  return (
                    <div
                      key={optIndex}
                      onClick={() => {
                        if (!isAnswered) {
                          handleSelectOption(optIndex);
                        }
                      }}
                      className={`p-3 sm:p-4 rounded-2xl border transition-all flex items-start gap-3 shadow-2xs ${borderBgClass} ${
                        isAnswered ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-xs sm:text-sm font-black shrink-0 transition-colors ${
                          showCorrectHighlight
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : showWrongHighlight
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {showCorrectHighlight ? (
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : showWrongHighlight ? (
                          <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          OPTION_LABELS[optIndex] || toPersianDigits(optIndex + 1)
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <div
                          className={`font-['Vazirmatn'] text-sm sm:text-base md:text-lg font-semibold leading-relaxed sm:leading-loose text-right ${
                            !isExpanded && isMultiLine ? 'line-clamp-1 truncate' : ''
                          }`}
                          dir="rtl"
                        >
                          <bdi dir="rtl" className="unicode-isolate">
                            {optionText}
                          </bdi>
                        </div>
                      </div>

                      {/* فلش کنار جواب برای گزینه‌های بیش از یک خط */}
                      {isMultiLine && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedOptions((prev) => ({
                              ...prev,
                              [optIndex]: !prev[optIndex],
                            }));
                          }}
                          className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 transition-all shrink-0 cursor-pointer pointer-events-auto border border-stone-200/60 dark:border-slate-700/60 active:scale-95"
                          title={isExpanded ? 'بستن متن کامل' : 'مشاهده متن کامل گزینه'}
                          aria-label="نمایش متن کامل گزینه"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* راهنما و پاسخ تشریحی پس از پاسخ دادن */}
            {isAnswered && currentQ.explanation && (
              <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/25 text-teal-900 dark:text-teal-200 text-xs sm:text-sm leading-relaxed animate-fadeIn flex items-start gap-2 text-right">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-bold">توضیح: </span>
                  <bdi dir="rtl" className="unicode-isolate">
                    {currentQ.explanation}
                  </bdi>
                </div>
              </div>
            )}
          </div>
        ) : isFinished ? (
          /* صفحه کارنامه و نتیجه نهایی آزمون / حالت Review */
          isReviewMode ? (
            /* حالت Review مرور سوالات آزمون */
            <div className="space-y-4 py-3 animate-fadeIn w-full">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsReviewMode(false)}
                    className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    title="بازگشت به کارنامه"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    مرور سوالات و پاسخ‌های آزمون
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold">
                  {toPersianDigits(score)} از {toPersianDigits(questions.length)} درست
                </span>
              </div>

              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const ans = userAnswers.find((u) => u.questionIndex === idx);
                  const isCorrect = ans?.isCorrect ?? false;
                  const isUnanswered = !ans || ans.selected === -1;

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                        isCorrect
                          ? 'border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20'
                          : isUnanswered
                          ? 'border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/20'
                          : 'border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">
                          سوال {toPersianDigits(idx + 1)} • سوره {q.surahName} (آیه {toPersianDigits(q.verseNumber)})
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : isUnanswered
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>صحیح</span>
                            </>
                          ) : isUnanswered ? (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>اتمام زمان / بدون پاسخ</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3" />
                              <span>نادرست</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                        {q.prompt}
                      </p>

                      {q.contextText && (
                        <div
                          className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 text-base sm:text-lg text-teal-900 dark:text-teal-200 text-center"
                          style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                        >
                          «{renderAyahWithRedDots(q.contextText)}»
                        </div>
                      )}

                      {/* پاسخ انتخابی و پاسخ صحیح */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800">
                          <span className="text-slate-400 block mb-0.5">پاسخ شما:</span>
                          <span className={isCorrect ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            {ans?.selectedText || (ans?.selected !== undefined && ans.selected >= 0 ? q.options[ans.selected] : 'پاسخ داده نشد')}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold block mb-0.5">پاسخ صحیح:</span>
                          <span className="text-slate-800 dark:text-slate-100 font-bold">
                            {q.targetWord || q.options[q.correctIndex] || 'مشخص شده در متن'}
                          </span>
                        </div>
                      </div>

                      {q.explanation && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-stone-200/50 dark:border-slate-800">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  onClick={() => setIsReviewMode(false)}
                  className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  بازگشت به کارنامه آزمون
                </button>
                <button
                  onClick={handleRestartQuiz}
                  className="py-3 px-4 rounded-2xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تکرار آزمون</span>
                </button>
              </div>
            </div>
          ) : (
            /* صفحه خلاصه نتایج و کارنامه */
            <div className="my-auto py-5 space-y-5 text-center animate-fadeIn max-w-lg mx-auto w-full">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center shadow-lg shadow-teal-500/10">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  آزمون حفظ با موفقیت به پایان رسید!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  سوره مبارکه {currentQ?.surahName || 'انتخابی'}
                </p>
              </div>

              {/* کارت امتیاز و درصد */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-around">
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-teal-700 dark:text-teal-400">
                      {toPersianDigits(score)} از {toPersianDigits(questions.length)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">پاسخ‌های صحیح</div>
                  </div>

                  <div className="w-px h-10 bg-stone-200 dark:bg-slate-800" />

                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                      {toPersianDigits(Math.round((score / Math.max(1, questions.length)) * 100))}٪
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">درصد تسلط</div>
                  </div>
                </div>

                {maxStreak > 1 && (
                  <div className="pt-3 border-t border-stone-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>بیشترین تسلط پیاپی: {toPersianDigits(maxStreak)} سوال</span>
                  </div>
                )}
              </div>

              {/* دکمه‌های اقدام: Review، تکرار، خروج */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <button
                  onClick={() => setIsReviewMode(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 text-teal-800 dark:text-teal-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>مرور سوالات و پاسخ‌ها (Review)</span>
                </button>

                <div className="flex items-center gap-2 w-full">
                  <button
                    onClick={handleRestartQuiz}
                    className="flex-1 py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>تکرار آزمون</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer active:scale-95"
                  >
                    بازگشت به منوی حفظ
                  </button>
                </div>
              </div>
            </div>
          )
        ) : null}
      </main>
    </div>
  );
};
