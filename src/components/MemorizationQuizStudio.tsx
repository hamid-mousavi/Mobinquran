import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Brain,
  ListOrdered,
  FileQuestion,
  Volume2,
  Clock,
  ArrowRight,
  Layers,
  HelpCircle,
  Sliders,
  Filter,
} from 'lucide-react';
import { Surah, Verse } from '../types';
import { toPersianDigits } from '../utils/textNormalization';
import { QuranService } from '../services/quranService';
import { getAudioSourceUrl, ReciterId } from '../services/audioSources';

interface MemorizationQuizStudioProps {
  currentSurah: Surah;
  surahs: Surah[];
  verses: Verse[];
  darkMode: boolean;
  onSelectSurah?: (surah: Surah) => void;
}

export type QuizType = 'next_verse' | 'prev_verse' | 'fill_blank' | 'verse_number' | 'mutashabihat';

interface QuizQuestion {
  id: string;
  type: QuizType;
  prompt: string;
  contextText?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  surahId: number;
  surahName: string;
  verseNumber: number;
  verseAudioUrl?: string | null;
}

interface SavedQuizResult {
  id: string;
  date: string;
  surahName: string;
  score: number;
  total: number;
  percent: number;
  typeLabel: string;
}

export const MemorizationQuizStudio: React.FC<MemorizationQuizStudioProps> = ({
  currentSurah,
  surahs,
  verses,
  darkMode,
  onSelectSurah,
}) => {
  // مراحل: 'setup' | 'playing' | 'result'
  const [phase, setPhase] = useState<'setup' | 'playing' | 'result'>('setup');
  const [quizType, setQuizType] = useState<QuizType>('next_verse');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedSurahId, setSelectedSurahId] = useState<number>(currentSurah.id);
  const [activeVerses, setActiveVerses] = useState<Verse[]>(verses);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // محدوده آیات
  const [isRangeCustom, setIsRangeCustom] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(currentSurah.versesCount || 10);

  // تایمر سنجش سرعت
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(30);

  // صوت آیه
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // وضعیت جلسه آزمون
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ isCorrect: boolean; selected: number; question: QuizQuestion }[]>([]);

  // تاریخچه نتایج آزمون در حافظه مرورگر
  const [quizHistory, setQuizHistory] = useState<SavedQuizResult[]>(() => {
    try {
      const saved = localStorage.getItem('mobin_memorization_quiz_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeSurah = useMemo(() => {
    return surahs.find((s) => s.id === selectedSurahId) || currentSurah;
  }, [selectedSurahId, surahs, currentSurah]);

  // به‌روزرسانی محدوده پیش‌فرض هنگام تغییر سوره
  useEffect(() => {
    setRangeStart(1);
    setRangeEnd(activeSurah.versesCount || 10);
  }, [activeSurah]);

  // بارگذاری آیات سوره در صورت انتخاب سوره دیگر
  useEffect(() => {
    if (selectedSurahId === currentSurah.id) {
      setActiveVerses(verses);
    } else {
      setIsLoadingVerses(true);
      QuranService.getSurahVerses(selectedSurahId)
        .then((res) => {
          if (res && res.length > 0) setActiveVerses(res);
        })
        .finally(() => setIsLoadingVerses(false));
    }
  }, [selectedSurahId, currentSurah.id, verses]);

  // قاری فعال برای پخش صوت
  const currentReciterId = useMemo<ReciterId>(() => {
    try {
      const saved = localStorage.getItem('mobin_selected_reciter') || localStorage.getItem('quran_reciter');
      return (saved as ReciterId) || 'parhizgar';
    } catch {
      return 'parhizgar';
    }
  }, []);

  // تایمر آزمون در حین پاسخگویی
  useEffect(() => {
    if (phase !== 'playing' || !isTimerEnabled || isAnswerSubmitted) return;

    setTimeLeft(30);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // زمان تمام شد، ثبت پاسخ منفی
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, currentQuestionIndex, isTimerEnabled, isAnswerSubmitted]);

  const handleTimeExpired = () => {
    if (isAnswerSubmitted) return;
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return;
    setUserAnswers((prev) => [
      ...prev,
      { isCorrect: false, selected: -1, question: currentQ },
    ]);
    setIsAnswerSubmitted(true);
  };

  // تولید هوشمند سوالات آزمون بر اساس آیات سوره
  const generateQuestions = () => {
    setErrorMessage(null);

    // فیلتر کردن بر اساس محدوده آیات در صورت فعال بودن
    let pool = [...activeVerses];
    if (isRangeCustom) {
      pool = pool.filter((v) => v.verseNumber >= rangeStart && v.verseNumber <= rangeEnd);
    }

    if (pool.length < 3) {
      setErrorMessage('تعداد آیات در این محدوده برای ایجاد آزمون کافی نیست. لطفاً بازه را گسترش دهید یا سوره دیگری را برگزینید.');
      return;
    }

    const generated: QuizQuestion[] = [];
    const totalToGenerate = Math.min(questionCount, pool.length);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    for (let i = 0; i < totalToGenerate; i++) {
      const v = shuffled[i];
      const vIndex = activeVerses.findIndex((x) => x.verseNumber === v.verseNumber);
      const audioUrl = getAudioSourceUrl(currentReciterId, activeSurah.id, v.verseNumber, 0);

      if (quizType === 'next_verse') {
        // سوال: آیه بعدی چیست؟
        let nextVerse = activeVerses[vIndex + 1];
        if (!nextVerse) {
          nextVerse = activeVerses[vIndex - 1];
        }
        if (!nextVerse) continue;

        const wrongVerses = activeVerses
          .filter((x) => x.verseNumber !== nextVerse.verseNumber && x.verseNumber !== v.verseNumber)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        if (wrongVerses.length < 3) continue;

        const options = [nextVerse.textArabic, ...wrongVerses.map((x) => x.textArabic)].sort(
          () => Math.random() - 0.5
        );
        const correctIndex = options.indexOf(nextVerse.textArabic);

        generated.push({
          id: `q_${i}_${v.verseNumber}`,
          type: 'next_verse',
          prompt: 'آیهٔ بعدی این فراز شریف را از میان گزینه‌ها برگزینید:',
          contextText: v.textArabic,
          options,
          correctIndex,
          explanation: `آیه ${toPersianDigits(nextVerse.verseNumber)} سوره ${activeSurah.nameArabic}: «${nextVerse.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (quizType === 'prev_verse') {
        // سوال: آیه قبلی چیست؟ (السابق)
        let prevVerse = activeVerses[vIndex - 1];
        if (!prevVerse) {
          prevVerse = activeVerses[vIndex + 1];
        }
        if (!prevVerse) continue;

        const wrongVerses = activeVerses
          .filter((x) => x.verseNumber !== prevVerse.verseNumber && x.verseNumber !== v.verseNumber)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        if (wrongVerses.length < 3) continue;

        const options = [prevVerse.textArabic, ...wrongVerses.map((x) => x.textArabic)].sort(
          () => Math.random() - 0.5
        );
        const correctIndex = options.indexOf(prevVerse.textArabic);

        generated.push({
          id: `q_${i}_${v.verseNumber}`,
          type: 'prev_verse',
          prompt: 'آیهٔ ماقبل (السابق) این فراز شریف کدام است؟',
          contextText: v.textArabic,
          options,
          correctIndex,
          explanation: `آیهٔ قبل (آیه ${toPersianDigits(prevVerse.verseNumber)}): «${prevVerse.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (quizType === 'fill_blank') {
        // سوال: جای خالی کلمه آیه را پر کنید
        const words = v.textArabic.trim().split(/\s+/);
        if (words.length < 4) continue;

        const candidateIndices = words
          .map((w, idx) => ({ w, idx }))
          .filter((item) => item.w.length > 2 && item.idx > 0 && item.idx < words.length - 1);

        const targetItem =
          candidateIndices.length > 0
            ? candidateIndices[Math.floor(Math.random() * candidateIndices.length)]
            : { w: words[1], idx: 1 };

        const targetWord = targetItem.w;
        const blankedText = words
          .map((w, idx) => (idx === targetItem.idx ? '【 ... 】' : w))
          .join(' ');

        const otherWords: string[] = [];
        for (const ov of activeVerses) {
          if (ov.verseNumber !== v.verseNumber) {
            const ow = ov.textArabic.split(/\s+/).filter((w) => w.length > 2 && w !== targetWord);
            otherWords.push(...ow);
          }
        }
        const wrongWords = Array.from(new Set(otherWords))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        if (wrongWords.length < 3) continue;

        const options = [targetWord, ...wrongWords].sort(() => Math.random() - 0.5);
        const correctIndex = options.indexOf(targetWord);

        generated.push({
          id: `q_${i}_${v.verseNumber}`,
          type: 'fill_blank',
          prompt: 'کلمهٔ مخفی‌شده در جای خالی 【 ... 】 را مشخص فرمایید:',
          contextText: blankedText,
          options,
          correctIndex,
          explanation: `متن کامل آیه ${toPersianDigits(v.verseNumber)}: «${v.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (quizType === 'mutashabihat') {
        // سوال: آزمون مشابهات و پایان‌بندی آیات
        const words = v.textArabic.trim().split(/\s+/);
        if (words.length < 5) continue;

        // دو الی سه کلمه پایانی آیه را به عنوان خاتمه برمی‌داریم
        const endingLength = Math.min(3, Math.floor(words.length / 2));
        const headWords = words.slice(0, words.length - endingLength).join(' ');
        const endingText = words.slice(words.length - endingLength).join(' ');

        // پایان‌بندی‌های مشهور قرآنی برای گزینه‌های جایگزین
        const commonEndings = [
          'إِنَّ اللَّهَ غَفُورٌ رَّحِيمٌ',
          'وَاللَّهُ عَلِيمٌ حَكِيمٌ',
          'إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
          'وَاللَّهُ بِمَا تَعْمَلُونَ بَصِيرٌ',
          'إِنَّ فِي ذَٰلِكَ لَآيَاتٍ لِّقَوْمٍ يَعْقِلُونَ',
          'وَكَانَ اللَّهُ عَزِيزًا حَكِيمًا',
          'إِنَّ اللَّهَ شَدِيدُ الْعِقَابِ',
          'وَإِلَيْهِ الْمَصِيرُ',
        ].filter((e) => e !== endingText);

        const wrongEndings = commonEndings.sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [endingText, ...wrongEndings].sort(() => Math.random() - 0.5);
        const correctIndex = options.indexOf(endingText);

        generated.push({
          id: `q_${i}_${v.verseNumber}`,
          type: 'mutashabihat',
          prompt: 'پایان‌بندی صحیح این آیه شریفه کدام عبارت است؟',
          contextText: `${headWords} ...`,
          options,
          correctIndex,
          explanation: `پایان‌بندی آیه ${toPersianDigits(v.verseNumber)}: «${v.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else {
        // سوال: شماره آیه چیست؟
        const correctNum = v.verseNumber;
        const maxV = activeSurah.versesCount;
        const wrongSet = new Set<number>();
        while (wrongSet.size < 3) {
          const delta = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 4) + 1);
          const candidate = Math.max(1, Math.min(maxV, correctNum + delta));
          if (candidate !== correctNum) wrongSet.add(candidate);
        }

        const options = [correctNum, ...Array.from(wrongSet)]
          .sort(() => Math.random() - 0.5)
          .map((n) => `آیه ${toPersianDigits(n)}`);

        const correctText = `آیه ${toPersianDigits(correctNum)}`;
        const correctIndex = options.indexOf(correctText);

        generated.push({
          id: `q_${i}_${v.verseNumber}`,
          type: 'verse_number',
          prompt: 'این آیه شریفه چندمین آیهٔ سوره است؟',
          contextText: v.textArabic,
          options,
          correctIndex,
          explanation: `این فراز مربوط به آیه ${toPersianDigits(v.verseNumber)} سوره ${activeSurah.nameArabic} است.`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      }
    }

    if (generated.length === 0) {
      setErrorMessage('تعداد آیات سوره برای ایجاد این نوع آزمون کافی نیست. لطفاً سبک دیگری را انتخاب فرمایید.');
      return;
    }

    setQuestions(generated);
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setUserAnswers([]);
    setPhase('playing');
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    setSelectedAnswerIndex(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswerIndex === null || isAnswerSubmitted) return;

    const currentQ = questions[currentQuestionIndex];
    const isCorrect = selectedAnswerIndex === currentQ.correctIndex;

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    setUserAnswers((prev) => [
      ...prev,
      { isCorrect, selected: selectedAnswerIndex, question: currentQ },
    ]);
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    // قطع صوت در صورت پخش
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingAudioUrl(null);
    }

    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswerIndex(null);
      setIsAnswerSubmitted(false);
    } else {
      // ذخیره نتیجه آزمون در تاریخچه
      const finalScore = score + (selectedAnswerIndex === questions[currentQuestionIndex]?.correctIndex ? 1 : 0);
      const percent = questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0;
      const typeLabels: Record<QuizType, string> = {
        next_verse: 'آیه بعدی',
        prev_verse: 'آیه قبلی',
        fill_blank: 'کلمه مخفی',
        verse_number: 'شماره آیه',
        mutashabihat: 'مشابهات',
      };

      const resultEntry: SavedQuizResult = {
        id: `quiz_${Date.now()}`,
        date: new Date().toLocaleDateString('fa-IR'),
        surahName: activeSurah.nameArabic,
        score: finalScore,
        total: questions.length,
        percent,
        typeLabel: typeLabels[quizType],
      };

      const updatedHistory = [resultEntry, ...quizHistory].slice(0, 20);
      setQuizHistory(updatedHistory);
      try {
        localStorage.setItem('mobin_memorization_quiz_history', JSON.stringify(updatedHistory));
      } catch {}

      setPhase('result');
    }
  };

  const handlePlayVerseAudio = (url?: string | null) => {
    if (!url) return;
    if (playingAudioUrl === url) {
      audioPlayerRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      setPlayingAudioUrl(url);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play().catch(() => {});
      }
    }
  };

  const currentQ = questions[currentQuestionIndex];
  const percentScore = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="space-y-4 select-none" dir="rtl">
      {/* مرحله ۱: تنظیمات و استودیوی ساخت آزمون */}
      {phase === 'setup' && (
        <div className="space-y-4">
          {/* کارت خوش‌آمد و معرفی آزمون‌ساز */}
          <div className="rounded-2xl p-5 border border-teal-600/30 bg-gradient-to-br from-teal-900/10 via-teal-600/5 to-transparent dark:from-teal-950/40 dark:via-slate-900 border-stone-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                  استودیوی حرفه‌ای آزمون و سنجش حفظ قرآن
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ۵ سبک تخصصی ارزیابی: توالی آیات، اتصال از عقب، متشابهات و تسلط کلمه‌به‌کلمه
                </p>
              </div>
            </div>
          </div>

          {/* پیام خطا در صورت ناکافی بودن آیات */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* انتخاب سبک آزمون از بین ۵ سبک حرفه‌ای */}
          <div className="rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>سبک آزمون حفظ:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {/* ۱. آیه بعدی */}
              <button
                type="button"
                onClick={() => setQuizType('next_verse')}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer ${
                  quizType === 'next_verse'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 ring-2 ring-teal-500/30 text-teal-950 dark:text-teal-100 shadow-xs'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <ChevronRight className="w-4 h-4 text-teal-600" />
                    اکمال آیه (آیهٔ بعدی)
                  </span>
                  {quizType === 'next_verse' && <Check className="w-4 h-4 text-teal-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  توالی و اتصال زنجیره‌ای آیه به آیه بعد را می‌سنجد.
                </p>
              </button>

              {/* ۲. آیه قبلی */}
              <button
                type="button"
                onClick={() => setQuizType('prev_verse')}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer ${
                  quizType === 'prev_verse'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 ring-2 ring-teal-500/30 text-teal-950 dark:text-teal-100 shadow-xs'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-teal-600" />
                    السابق (آیهٔ ماقبل)
                  </span>
                  {quizType === 'prev_verse' && <Check className="w-4 h-4 text-teal-600" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  سنجش فوق‌العاده حرفه‌ای اتصال آیات از عقب به جلو.
                </p>
              </button>

              {/* ۳. جای خالی کلمه */}
              <button
                type="button"
                onClick={() => setQuizType('fill_blank')}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer ${
                  quizType === 'fill_blank'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 ring-2 ring-teal-500/30 text-teal-950 dark:text-teal-100 shadow-xs'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <FileQuestion className="w-4 h-4 text-amber-500" />
                    تکمیل کلمهٔ مخفی
                  </span>
                  {quizType === 'fill_blank' && <Check className="w-4 h-4 text-amber-500" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  تشخیص کلمهٔ پنهان‌شده در جای خالی متن آیه.
                </p>
              </button>

              {/* ۴. مشابهات و پایان‌بندی‌ها */}
              <button
                type="button"
                onClick={() => setQuizType('mutashabihat')}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer ${
                  quizType === 'mutashabihat'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 ring-2 ring-teal-500/30 text-teal-950 dark:text-teal-100 shadow-xs'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    مشابهات و پایان‌بندی‌ها
                  </span>
                  {quizType === 'mutashabihat' && <Check className="w-4 h-4 text-emerald-500" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  تمایز بین فواصل و آیات مشتبه در مسابقات حفظ.
                </p>
              </button>

              {/* ۵. شماره آیه */}
              <button
                type="button"
                onClick={() => setQuizType('verse_number')}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer ${
                  quizType === 'verse_number'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 ring-2 ring-teal-500/30 text-teal-950 dark:text-teal-100 shadow-xs'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-indigo-500" />
                    تشخیص شماره آیه
                  </span>
                  {quizType === 'verse_number' && <Check className="w-4 h-4 text-indigo-500" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  تسلط بر جایگاه و شمارهٔ دقیق آیه در سوره.
                </p>
              </button>
            </div>
          </div>

          {/* تنظیمات سوره، محدوده و تعداد سوالات */}
          <div className="rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  سوره مورد نظر:
                </label>
                <select
                  value={selectedSurahId}
                  onChange={(e) => setSelectedSurahId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
                >
                  {surahs.map((s) => (
                    <option key={s.id} value={s.id}>
                      سوره {toPersianDigits(s.id)}. {s.nameArabic} ({s.namePersian}) - {toPersianDigits(s.versesCount)} آیه
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  تعداد سوالات آزمون:
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setQuestionCount(cnt)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        questionCount === cnt
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {toPersianDigits(cnt)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* تعیین محدوده آیات (اختیاری) */}
            <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom-range-toggle"
                  checked={isRangeCustom}
                  onChange={(e) => setIsRangeCustom(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="custom-range-toggle" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  محدود کردن آزمون به بازهٔ مشخصی از آیات (تمرین حزب یا صفحه)
                </label>
              </div>

              {isRangeCustom && (
                <div className="flex items-center gap-2">
                  <span>از آیه</span>
                  <input
                    type="number"
                    min={1}
                    max={rangeEnd}
                    value={rangeStart}
                    onChange={(e) => setRangeStart(Math.max(1, Number(e.target.value)))}
                    className="w-16 p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-center font-bold"
                  />
                  <span>تا آیه</span>
                  <input
                    type="number"
                    min={rangeStart}
                    max={activeSurah.versesCount || 286}
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(Math.min(activeSurah.versesCount || 286, Number(e.target.value)))}
                    className="w-16 p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-center font-bold"
                  />
                </div>
              )}
            </div>

            {/* سوییچ تایمر سرعت پاسخگویی */}
            <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  تایمر سرعت پاسخگویی (۳۰ ثانیه برای هر سوال)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTimerEnabled(!isTimerEnabled)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isTimerEnabled ? 'bg-teal-600 text-white shadow-xs' : 'bg-stone-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {isTimerEnabled ? 'فعال' : 'غیرفعال'}
              </button>
            </div>
          </div>

          {/* دکمه شروع آزمون */}
          <button
            onClick={generateQuestions}
            disabled={isLoadingVerses}
            className="w-full py-4 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Trophy className="w-5 h-5 text-amber-300" />
            <span>{isLoadingVerses ? 'در حال آماده‌سازی آیات سوره...' : 'شروع آزمون حرفه‌ای حفظ'}</span>
          </button>

          {/* تاریخچه آخرین آزمون‌ها */}
          {quizHistory.length > 0 && (
            <div className="rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-teal-600" />
                <span>سوابق آخرین آزمون‌های حفظ شما:</span>
              </h3>
              <div className="space-y-2">
                {quizHistory.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-100">سوره {item.surahName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {item.typeLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden xs:inline">{item.date}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-teal-600 dark:text-teal-400">{toPersianDigits(item.percent)}٪</span>
                      <span className="text-[11px] text-slate-400">({toPersianDigits(item.score)}/{toPersianDigits(item.total)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* مرحله ۲: محیط اجرای آزمون */}
      {phase === 'playing' && currentQ && (
        <div className="space-y-4">
          {/* نوار وضعیت پیشرفت سوالات، تایمر و امتیاز */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-lg bg-teal-500/10">
                سوال {toPersianDigits(currentQuestionIndex + 1)} از {toPersianDigits(questions.length)}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                سوره {currentQ.surahName}
              </span>
            </div>

            {/* تایمر معکوس در صورت فعال بودن */}
            {isTimerEnabled && !isAnswerSubmitted && (
              <div className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg ${
                timeLeft <= 5
                  ? 'bg-red-500/15 text-red-600 animate-pulse'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{toPersianDigits(timeLeft)} ثانیه</span>
              </div>
            )}

            <div className="flex items-center gap-2 font-bold text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {toPersianDigits(score)} درست
              </span>
              <button
                onClick={() => setPhase('setup')}
                className="text-slate-400 hover:text-slate-600 text-[11px] mr-2 cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>

          {/* کادر متن سوال و ترتیل صوتی */}
          <div className="p-5 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {currentQ.prompt}
              </div>

              {currentQ.verseAudioUrl && (
                <button
                  type="button"
                  onClick={() => handlePlayVerseAudio(currentQ.verseAudioUrl)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    playingAudioUrl === currentQ.verseAudioUrl
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100'
                  }`}
                  title="شنیدن تلاوت این فراز"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{playingAudioUrl === currentQ.verseAudioUrl ? 'توقف صوت' : 'استماع ترتیل'}</span>
                </button>
              )}
            </div>

            {currentQ.contextText && (
              <div
                className="p-4 rounded-xl bg-stone-50 dark:bg-slate-800/80 text-center font-bold text-base sm:text-lg text-slate-800 dark:text-slate-100 leading-loose border border-stone-100 dark:border-slate-800"
                style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                dir="rtl"
              >
                {currentQ.contextText}
              </div>
            )}
          </div>

          {/* گزینه‌ها */}
          <div className="space-y-2.5">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedAnswerIndex === idx;
              const isCorrect = idx === currentQ.correctIndex;

              let btnStyle = 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-teal-500';

              if (isAnswerSubmitted) {
                if (isCorrect) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/40 font-bold';
                } else if (isSelected && !isCorrect) {
                  btnStyle = 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100 ring-2 ring-red-500/40';
                } else {
                  btnStyle = 'border-stone-200 dark:border-slate-800 opacity-50 bg-white dark:bg-slate-900';
                }
              } else if (isSelected) {
                btnStyle = 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 ring-2 ring-teal-500/30 font-bold';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isAnswerSubmitted}
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full p-3.5 sm:p-4 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 cursor-pointer ${btnStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-stone-100 dark:bg-slate-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <span
                      className="text-sm font-semibold leading-relaxed"
                      style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                    >
                      {opt}
                    </span>
                  </div>

                  {isAnswerSubmitted && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {isAnswerSubmitted && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* بازخورد و دکمه ادامه */}
          {isAnswerSubmitted ? (
            <div className="space-y-3 p-4 rounded-2xl bg-stone-100 dark:bg-slate-800/80 border border-stone-200 dark:border-slate-700 animate-fadeIn">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                {currentQ.explanation}
              </div>
              <button
                onClick={handleNextQuestion}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-98"
              >
                <span>{currentQuestionIndex + 1 < questions.length ? 'سوال بعدی' : 'مشاهده کارنامه جامع پایانی'}</span>
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswerIndex === null}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                selectedAnswerIndex !== null
                  ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer active:scale-98'
                  : 'bg-stone-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>ثبت پاسخ</span>
            </button>
          )}
        </div>
      )}

      {/* مرحله ۳: کارنامه تحلیلی جامع و نتایج آزمون */}
      {phase === 'result' && (
        <div className="space-y-4 animate-fadeIn">
          {/* کارت تندیس و نمره */}
          <div className="rounded-3xl p-6 border border-teal-600/30 bg-gradient-to-b from-white to-stone-50 dark:from-slate-900 dark:to-slate-900/90 text-center space-y-3.5 shadow-md">
            <div className="w-16 h-16 rounded-full bg-amber-400/20 text-amber-500 mx-auto flex items-center justify-center shadow-inner">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {percentScore >= 90
                  ? 'رتبه ممتاز قرآنی! تبریک'
                  : percentScore >= 75
                  ? 'بسیار عالی و با تسلط خوب'
                  : percentScore >= 50
                  ? 'تلاش قابل قبول؛ نیاز به تثبیت'
                  : 'نیاز به دوره و تمرین بیشتر'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                کارنامه سنجش تسلط حفظ سوره {activeSurah.nameArabic}
              </p>
            </div>

            <div className="flex items-center justify-center gap-6 py-2">
              <div className="text-center">
                <div className="text-3xl font-black text-teal-600 dark:text-teal-400">
                  {toPersianDigits(percentScore)}٪
                </div>
                <div className="text-[11px] text-slate-400 font-medium">درصد تسلط</div>
              </div>
              <div className="h-10 w-px bg-stone-200 dark:bg-slate-800" />
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {toPersianDigits(score)} از {toPersianDigits(questions.length)}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">پاسخ‌های صحیح</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={generateQuestions}
                className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <RotateCcw className="w-4 h-4" />
                <span>آزمون مجدد با سوالات نو</span>
              </button>
              <button
                onClick={() => setPhase('setup')}
                className="py-3 px-4 rounded-xl border border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                تغییر سوره یا سبک
              </button>
            </div>
          </div>

          {/* مرور اشتباهات آزمون جهت تثبیت در حافظه بلندمدت */}
          {userAnswers.filter((a) => !a.isCorrect).length > 0 && (
            <div className="rounded-2xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                <span>مرور سوالات اشتباه جهت تثبیت در ذهن:</span>
              </h3>

              <div className="space-y-2.5">
                {userAnswers
                  .filter((a) => !a.isCorrect)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 text-xs space-y-1.5"
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {item.question.prompt}
                      </div>
                      {item.question.contextText && (
                        <div
                          className="font-bold text-teal-800 dark:text-teal-300 py-1"
                          style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                        >
                          «{item.question.contextText}»
                        </div>
                      )}
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                        ✓ پاسخ صحیح: {item.question.options[item.question.correctIndex]}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* المان صوتی مخفی */}
      <audio ref={audioPlayerRef} onEnded={() => setPlayingAudioUrl(null)} className="hidden" />
    </div>
  );
};
