import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Pause,
  ArrowRight,
  Flame,
  Check,
  Maximize2,
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
}

interface RealisticQuizViewProps {
  questions: QuizQuestionItem[];
  title?: string;
  timePerQuestion?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  arabicFont?: string;
  onClose: () => void;
  onRestart: () => void;
  onFinish?: (score: number, total: number) => void;
}

const OPTION_LABELS = ['الف', 'ب', 'ج', 'د'];

// فرمت‌بندی ایمن متن گزینه برای جلوگیری از به هم خوردن پرانتزها و علائم در متون دوزبانه/راست‌به‌چپ
const sanitizeOptionText = (text: string): string => {
  if (!text) return '';
  let t = text.trim();
  // حذف سه نقطه‌های ابتدایی نامربوط که کاربر را به اشتباه می‌اندازد
  t = t.replace(/^(\.\.\.|…|\.\s*)+/, '').trim();
  return t;
};

// تمیزسازی متن صورت آیه سوال برای رفع ابهام سه‌نقطه
const cleanContextAyah = (text?: string, isBlankFill?: boolean): string => {
  if (!text) return '';
  let clean = text.trim();
  if (!isBlankFill) {
    // اگر سوال جای خالی نیست، هرگونه سه نقطه ابتدایی یا انتهایی را پاک کن تا کاربر فکر نکند سوال جای خالی است
    clean = clean.replace(/^(\.\.\.|…|\.\s*)+/, '').replace(/(\.\.\.|…|\.\s*)+$/, '').trim();
  }
  return clean;
};

export const RealisticQuizView: React.FC<RealisticQuizViewProps> = ({
  questions,
  title = 'آزمون سنجش حفظ قرآن',
  timePerQuestion = 0,
  difficulty = 'medium',
  arabicFont = 'Uthman Taha',
  onClose,
  onRestart,
  onFinish,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [userAnswers, setUserAnswers] = useState<
    Array<{ questionIndex: number; selected: number; isCorrect: boolean }>
  >([]);
  const [isFinished, setIsFinished] = useState(false);

  // وضعیت باز/بسته بودن متن کامل آیه با آیکون فلش کنار باکس (بدون باز شدن مودال جداگانه)
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  // وضعیت باز/بسته بودن گزینه‌های طولانی
  const [expandedOptionIndex, setExpandedOptionIndex] = useState<number | null>(null);

  // تایمر سوال
  const [timeLeft, setTimeLeft] = useState<number>(timePerQuestion);

  // پخش صوت آیه در صورت نیاز
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoNextTimerRef = useRef<number | null>(null);

  const currentQ = questions[currentIndex];

  // بازنشانی وضعیت سوال با رفتن به سوال بعدی
  useEffect(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setIsQuestionExpanded(false);
    setExpandedOptionIndex(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
  }, [currentIndex]);

  // شمارش معکوس تایمر
  useEffect(() => {
    if (isFinished || isAnswered || timePerQuestion <= 0) return;

    setTimeLeft(timePerQuestion);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isFinished, isAnswered, timePerQuestion]);

  // پایان مهلت پاسخ
  const handleTimeOut = useCallback(() => {
    if (isAnswered || !currentQ) return;
    setIsAnswered(true);
    setSelectedOption(-1); // -1 = بدون پاسخ / تایم اوت
    setStreak(0);
    quizAudio.playIncorrect();

    setUserAnswers((prev) => [
      ...prev,
      { questionIndex: currentIndex, selected: -1, isCorrect: false },
    ]);

    // رفتن خودکار به سوال بعدی پس از مکث
    autoNextTimerRef.current = window.setTimeout(() => {
      advanceToNextQuestion();
    }, 1400);
  }, [currentIndex, isAnswered, currentQ]);

  // پاک‌سازی تایمر خودکار هنگام خروج
  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        window.clearTimeout(autoNextTimerRef.current);
      }
    };
  }, []);

  // انتخاب گزینه توسط کاربر
  const handleSelectOption = (index: number) => {
    if (isAnswered || isFinished || !currentQ) return;

    setIsAnswered(true);
    setSelectedOption(index);

    const isCorrect = index === currentQ.correctIndex;

    if (isCorrect) {
      setScore((s) => s + 1);
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
      { questionIndex: currentIndex, selected: index, isCorrect },
    ]);

    // انتقال خودکار به سوال بعد بعد از مکث کوتاه و پخش صدا
    autoNextTimerRef.current = window.setTimeout(() => {
      advanceToNextQuestion();
    }, 1400);
  };

  // رفتن به سوال بعدی یا پایان آزمون
  const advanceToNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      if (onFinish) {
        onFinish(score + (selectedOption === currentQ?.correctIndex ? 1 : 0), questions.length);
      }
    }
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

  // متن تمیزشده برای نمایش در باکس سوال
  const displayedAyahText = currentQ
    ? isQuestionExpanded
      ? currentQ.fullVerseText || currentQ.contextText
      : cleanContextAyah(currentQ.contextText, currentQ.isBlankFill)
    : '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">
      {/* المان صوتی پنهان */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlayingAudio(false)}
        className="hidden"
      />

      {/* سربرگ تمیز و بهینه‌شده آزمون برای موبایل */}
      <header className="shrink-0 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all cursor-pointer active:scale-95"
            title="انصراف و بازگشت"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{title}</span>
            </h2>
            {currentQ && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                سوره {currentQ.surahName} • آیه {toPersianDigits(currentQ.verseNumber)}
              </p>
            )}
          </div>
        </div>

        {/* وضعیت امتیاز و تایمر */}
        <div className="flex items-center gap-2">
          {timePerQuestion > 0 && !isFinished && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                timeLeft <= 5 && !isAnswered
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{toPersianDigits(timeLeft)} ثانیه</span>
            </div>
          )}

          {streak > 1 && (
            <div className="hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-black">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{toPersianDigits(streak)} پیاپی</span>
            </div>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-teal-600/10 border border-teal-500/25 text-teal-700 dark:text-teal-300 text-xs font-bold">
            {toPersianDigits(score)} درست
          </div>
        </div>
      </header>

      {/* نوار باریک پیشرفت سوالات */}
      <div className="w-full bg-stone-200 dark:bg-slate-800 h-1.5 shrink-0 overflow-hidden">
        <div
          className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* محتوای اصلی آزمون - طراحی روان، خوانا و بهینه برای صفحات موبایل */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-5 flex flex-col justify-start max-w-2xl mx-auto w-full">
        {!isFinished && currentQ ? (
          <div className="space-y-3 sm:space-y-4 my-auto w-full">
            {/* شمارنده سوال و نشان سبک */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="px-3 py-1 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700">
                سوال {toPersianDigits(currentIndex + 1)} از {toPersianDigits(questions.length)}
              </span>

              <div className="flex items-center gap-2">
                {currentQ.categoryBadge && (
                  <span className="px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20">
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
                    {isPlayingAudio ? <Volume2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* کارت سوال و آیه - دارای آیکون فلش اختصاصی کنار باکس برای مشاهده کل آیه بدون تغییر صفحه */}
            <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm space-y-3">
              {/* صورت سوال با فونت درشت و خوانا */}
              <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed text-right">
                {currentQ.prompt}
              </h3>

              {/* باکس آیه شریفه - با آیکون فلش باز/بسته در گوشه باکس */}
              {currentQ.contextText && (
                <div className="relative p-4 sm:p-6 rounded-2xl bg-teal-50/40 dark:bg-slate-800/60 border border-teal-500/20 dark:border-slate-700">
                  {/* آیکون فلش کنار باکس برای مشاهده متن کامل آیه */}
                  <div className="flex items-center justify-between pb-2 border-b border-teal-500/15 dark:border-slate-700/60 mb-2">
                    <span className="text-xs font-bold text-teal-800 dark:text-teal-300">
                      فراز قرآنی آیه {toPersianDigits(currentQ.verseNumber)} سوره {currentQ.surahName}
                    </span>

                    {/* دکمه فلش کنار باکس */}
                    <button
                      type="button"
                      onClick={() => setIsQuestionExpanded((prev) => !prev)}
                      className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-50 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold active:scale-95 shadow-2xs"
                      title={isQuestionExpanded ? 'کوتاه‌سازی نمایش' : 'مشاهده کل آیه'}
                      aria-label="نمایش کامل آیه"
                    >
                      <span className="text-[11px] hidden xs:inline">
                        {isQuestionExpanded ? 'خلاصه' : 'متن کامل'}
                      </span>
                      {isQuestionExpanded ? (
                        <ChevronUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      )}
                    </button>
                  </div>

                  {/* متن آیه با قلم فاخر عثمان طه/امیری و ابعاد کاملاً خوانا */}
                  <div
                    className={`text-2xl sm:text-3xl md:text-4xl font-normal leading-[2.4] text-teal-950 dark:text-teal-100 text-center transition-all ${
                      !isQuestionExpanded && (displayedAyahText?.length || 0) > 130
                        ? 'max-h-36 overflow-y-auto'
                        : ''
                    }`}
                    style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                    dir="rtl"
                  >
                    <bdi dir="rtl" className="unicode-isolate">
                      «{displayedAyahText}»
                    </bdi>
                  </div>

                  {/* نمایش ترجمه آیه در صورت باز شدن آیه کامل */}
                  {isQuestionExpanded && currentQ.fullVerseTranslation && (
                    <div className="mt-3 pt-3 border-t border-teal-500/20 text-xs sm:text-sm text-slate-600 dark:text-slate-300 text-right leading-relaxed animate-fadeIn">
                      <span className="font-bold text-teal-700 dark:text-teal-400">ترجمه روان: </span>
                      {currentQ.fullVerseTranslation}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* گزینه‌های آزمون (۴ گزینه با متن کامل، فونت خوانا، بازخورد صوتی و گذار خودکار) */}
            <div className="space-y-2.5">
              {currentQ.options.map((optionRaw, optIndex) => {
                const optionText = sanitizeOptionText(optionRaw);
                const isSelected = selectedOption === optIndex;
                const isCorrectOption = optIndex === currentQ.correctIndex;
                const showCorrectHighlight = isAnswered && isCorrectOption;
                const showWrongHighlight = isAnswered && isSelected && !isCorrectOption;
                const isExpanded = expandedOptionIndex === optIndex;
                const isLongOption = optionText.length > 55;

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
                    onClick={() => handleSelectOption(optIndex)}
                    className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all flex items-start gap-3 cursor-pointer shadow-xs ${borderBgClass} ${
                      isAnswered ? 'cursor-default pointer-events-none' : 'active:scale-[0.99]'
                    }`}
                  >
                    {/* نشان الف، ب، ج، د */}
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-sm sm:text-base font-black shrink-0 transition-colors ${
                        showCorrectHighlight
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : showWrongHighlight
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {showCorrectHighlight ? (
                        <Check className="w-5 h-5" />
                      ) : showWrongHighlight ? (
                        <X className="w-5 h-5" />
                      ) : (
                        OPTION_LABELS[optIndex] || toPersianDigits(optIndex + 1)
                      )}
                    </div>

                    {/* متن گزینه به صورت کاملاً خوانا، با رعایت جهت‌گیری RTL برای پرانتزها و علائم */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div
                        className={`text-base sm:text-lg font-medium leading-relaxed text-right ${
                          !isExpanded && isLongOption ? 'line-clamp-2' : ''
                        }`}
                        dir="rtl"
                      >
                        <bdi dir="rtl" className="unicode-isolate">
                          {optionText}
                        </bdi>
                      </div>
                    </div>

                    {/* آیکون فلش اختصاصی کنار گزینه برای باز و بسته کردن گزینه‌های طولانی */}
                    {isLongOption && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedOptionIndex((prev) => (prev === optIndex ? null : optIndex));
                        }}
                        className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all shrink-0 cursor-pointer"
                        title={isExpanded ? 'بستن' : 'مشاهده کامل متن گزینه'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* توضیح و راهنما پس از پاسخ */}
            {isAnswered && currentQ.explanation && (
              <div className="p-3 sm:p-4 rounded-2xl bg-teal-500/10 border border-teal-500/25 text-teal-900 dark:text-teal-200 text-xs sm:text-sm leading-relaxed animate-fadeIn flex items-start gap-2 text-right">
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
          /* صفحه کارنامه و نتیجه نهایی آزمون */
          <div className="my-auto py-6 space-y-6 text-center animate-fadeIn max-w-lg mx-auto w-full">
            <div className="w-20 h-20 rounded-3xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center shadow-lg shadow-teal-500/10">
              <Trophy className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                آزمون حفظ با موفقیت به پایان رسید!
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                سوره مبارکه {currentQ?.surahName || 'انتخابی'}
              </p>
            </div>

            {/* کارت نمره و آمار */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-around">
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-teal-700 dark:text-teal-400">
                    {toPersianDigits(score)} از {toPersianDigits(questions.length)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">پاسخ‌های صحیح</div>
                </div>

                <div className="w-px h-12 bg-stone-200 dark:bg-slate-800" />

                <div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                    {toPersianDigits(Math.round((score / Math.max(1, questions.length)) * 100))}٪
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">درصد تسلط</div>
                </div>
              </div>

              {maxStreak > 1 && (
                <div className="pt-3 border-t border-stone-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>بیشترین تسلط پیاپی: {toPersianDigits(maxStreak)} سوال</span>
                </div>
              )}
            </div>

            {/* دکمه‌های اقدام */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={onRestart}
                className="w-full py-3.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تکرار آزمون</span>
              </button>

              <button
                onClick={onClose}
                className="w-full py-3.5 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all cursor-pointer active:scale-95"
              >
                بازگشت به منوی حفظ
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
