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
  Maximize2,
  Play,
  Languages,
  Compass,
  CheckSquare,
  Square,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { Surah, Verse } from '../types';
import { toPersianDigits } from '../utils/textNormalization';
import { QuranService } from '../services/quranService';
import { getAudioSourceUrl, ReciterId, RECITER_NAMES } from '../services/audioSources';
import { QURAN_STORIES } from '../data/quranStories';
import { ALL_SURAHS } from '../data/surahs';
import { FullscreenShortsQuiz, ShortsQuestion } from './FullscreenShortsQuiz';

interface MemorizationQuizStudioProps {
  currentSurah: Surah;
  surahs: Surah[];
  verses: Verse[];
  darkMode: boolean;
  onSelectSurah?: (surah: Surah) => void;
}

export type QuizType =
  | 'next_verse'
  | 'prev_verse'
  | 'fill_blank'
  | 'mutashabihat'
  | 'translation_match'
  | 'verse_number'
  | 'surah_identity'
  | 'quran_stories';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

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

// کوتاه‌سازی هوشمند فرازهای طولانی جهت حفظ خوانایی فونت و عدم سرریز در گزینه‌ها
const getVerseSnippet = (text: string, maxWords: number = 7): string => {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + ' ...';
};

const ALL_QUIZ_STYLES: { id: QuizType; title: string; desc: string; icon: React.ElementType }[] = [
  {
    id: 'next_verse',
    title: 'اکمال آیه (آیهٔ بعدی)',
    desc: 'تشخیص فراز بعدی جهت سنجش توالی و زنجیره پیوسته آیات',
    icon: ChevronRight,
  },
  {
    id: 'prev_verse',
    title: 'السابق (آیهٔ ماقبل)',
    desc: 'تشخیص آیه قبل از فراز فعلی برای تسلط بر پیوند معکوس',
    icon: ArrowRight,
  },
  {
    id: 'fill_blank',
    title: 'تکمیل کلمهٔ مخفی',
    desc: 'شناسایی واژهٔ پنهان‌شده در جای خالی متن آیه',
    icon: FileQuestion,
  },
  {
    id: 'mutashabihat',
    title: 'مشابهات و پایان‌بندی‌ها',
    desc: 'تمایز فواصل و پایان‌بندی‌های مشتبه در مسابقات حفظ',
    icon: Layers,
  },
  {
    id: 'translation_match',
    title: 'تطبیق ترجمه و مفاهیم',
    desc: 'ارتباط آیه با ترجمه روان و پیام مفهومی فارسی',
    icon: Languages,
  },
  {
    id: 'verse_number',
    title: 'تشخیص شماره آیه',
    desc: 'تسلط بر جایگاه عددی و موقعیت آیه در مصحف',
    icon: ListOrdered,
  },
  {
    id: 'surah_identity',
    title: 'تشخیص نام سوره',
    desc: 'شناخت سوره مربوط به فراز قرآنی از بین سوره‌ها',
    icon: Compass,
  },
  {
    id: 'quran_stories',
    title: 'داستان‌ها و حکمت‌ها',
    desc: 'سنجش معرفت و حفظ آیات سرگذشت پیامبران الهی',
    icon: BookOpen,
  },
];

export const MemorizationQuizStudio: React.FC<MemorizationQuizStudioProps> = ({
  currentSurah,
  surahs,
  verses,
  darkMode,
  onSelectSurah,
}) => {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'result'>('setup');
  
  // سطح دشواری آزمون (آسان، متوسط، سخت)
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');
  
  // انتخاب سبک‌ها به حالت چک‌باکس چندگانه و سبک ترکیبی
  const [isCombinedMode, setIsCombinedMode] = useState<boolean>(true);
  const [selectedStyles, setSelectedStyles] = useState<QuizType[]>([
    'next_verse',
    'prev_verse',
    'fill_blank',
    'mutashabihat',
    'translation_match',
  ]);

  const [questionCount, setQuestionCount] = useState<number>(5);
  const [activeVerses, setActiveVerses] = useState<Verse[]>(verses);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // محدوده آزمون: بر اساس آیات یا صفحات مصحف
  const [rangeMode, setRangeMode] = useState<'verses' | 'pages'>('verses');
  const [isRangeCustom, setIsRangeCustom] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(currentSurah.versesCount || 10);

  // صفحات سوره
  const surahPages = useMemo(() => {
    const pageSet = new Set<number>();
    verses.forEach((v) => {
      if (v.pageNumber) pageSet.add(v.pageNumber);
    });
    if (pageSet.size === 0 && currentSurah.startPage) {
      pageSet.add(currentSurah.startPage);
    }
    return Array.from(pageSet).sort((a, b) => a - b);
  }, [verses, currentSurah.startPage]);

  const [selectedStartPage, setSelectedStartPage] = useState<number>(
    surahPages[0] || currentSurah.startPage || 1
  );
  const [selectedEndPage, setSelectedEndPage] = useState<number>(
    surahPages[surahPages.length - 1] || currentSurah.startPage || 1
  );

  // تایمر سرعت پاسخگویی
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const [selectedReciterId, setSelectedReciterId] = useState<ReciterId>('parhizgar');

  // وضعیت جلسه آزمون
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ isCorrect: boolean; selected: number; question: QuizQuestion }[]>([]);
  const [isShortsFullscreenOpen, setIsShortsFullscreenOpen] = useState(false);

  // تاریخچه نتایج آزمون
  const [quizHistory, setQuizHistory] = useState<SavedQuizResult[]>(() => {
    try {
      const saved = localStorage.getItem('mobin_memorization_quiz_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeSurah = currentSurah;

  // همگام‌سازی آیات و محدوده هنگام تغییر سوره فعال
  useEffect(() => {
    setActiveVerses(verses);
    setRangeStart(1);
    setRangeEnd(currentSurah.versesCount || 10);
    if (surahPages.length > 0) {
      setSelectedStartPage(surahPages[0]);
      setSelectedEndPage(surahPages[surahPages.length - 1]);
    }
  }, [currentSurah, verses, surahPages]);

  // زمان هر سوال متناسب با درجه سختی
  const timePerQuestionSeconds = useMemo(() => {
    if (!isTimerEnabled) return 0;
    if (difficulty === 'easy') return 25;
    if (difficulty === 'medium') return 15;
    return 10; // سخت
  }, [isTimerEnabled, difficulty]);

  // تاگل چک‌باکس سبک‌ها
  const toggleStyle = (styleId: QuizType) => {
    if (isCombinedMode) {
      setIsCombinedMode(false);
    }
    setSelectedStyles((prev) => {
      if (prev.includes(styleId)) {
        if (prev.length === 1) return prev; // حداقل یک سبک باید انتخاب باشد
        return prev.filter((s) => s !== styleId);
      }
      return [...prev, styleId];
    });
  };

  // فعال‌سازی سبک ترکیبی (شامل تمام سبک‌ها)
  const toggleCombinedMode = () => {
    if (!isCombinedMode) {
      setIsCombinedMode(true);
      setSelectedStyles(ALL_QUIZ_STYLES.map((s) => s.id));
    } else {
      setIsCombinedMode(false);
      setSelectedStyles(['next_verse', 'fill_blank']);
    }
  };

  // تولید هوشمند سوالات آزمون بر اساس آیات سوره
  const generateQuestions = (openInShorts: boolean = true) => {
    setErrorMessage(null);

    // فیلتر کردن آیات بر اساس بازه انتخابی
    let pool = [...activeVerses];
    if (isRangeCustom) {
      if (rangeMode === 'verses') {
        pool = pool.filter((v) => v.verseNumber >= rangeStart && v.verseNumber <= rangeEnd);
      } else {
        pool = pool.filter(
          (v) => v.pageNumber >= selectedStartPage && v.pageNumber <= selectedEndPage
        );
      }
    }

    if (pool.length < 3) {
      setErrorMessage(
        'تعداد آیات در این محدوده برای آزمون کافی نیست. لطفاً بازه را گسترش دهید یا محدوده صفحات بیشتری را برگزینید.'
      );
      return;
    }

    const availableStyles = isCombinedMode ? ALL_QUIZ_STYLES.map((s) => s.id) : selectedStyles;
    if (availableStyles.length === 0) {
      setErrorMessage('لطفاً حداقل یک سبک آزمون را انتخاب فرمایید.');
      return;
    }

    const generated: QuizQuestion[] = [];
    const totalToGenerate = Math.min(questionCount, pool.length);
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    for (let i = 0; i < totalToGenerate; i++) {
      const v = shuffledPool[i];
      const vIndex = activeVerses.findIndex((x) => x.verseNumber === v.verseNumber);
      const audioUrl = getAudioSourceUrl(selectedReciterId, activeSurah.id, v.verseNumber, 0);

      // در حالت ترکیبی یا چندچک‌باکس، سبک به صورت تصادفی از بین سبک‌های انتخابی تخصیص می‌یابد
      const currentStyle = availableStyles[i % availableStyles.length];

      if (currentStyle === 'quran_stories') {
        const storyMatches = QURAN_STORIES.filter((s) => s.surahId === activeSurah.id);
        const storiesToUse = storyMatches.length > 0 ? storyMatches : QURAN_STORIES;
        const allStoryQuestions = storiesToUse.flatMap((s) => s.questions);
        if (allStoryQuestions.length > 0) {
          const sq = allStoryQuestions[Math.floor(Math.random() * allStoryQuestions.length)];
          generated.push({
            id: `q_story_${i}_${sq.id}`,
            type: 'quran_stories',
            prompt: sq.prompt,
            contextText: sq.contextAyah ? getVerseSnippet(sq.contextAyah, 9) : undefined,
            options: sq.options.map((opt) => getVerseSnippet(opt, 7)),
            correctIndex: sq.correctIndex,
            explanation: sq.explanation,
            surahId: activeSurah.id,
            surahName: sq.surahName,
            verseNumber: sq.verseNumber,
            verseAudioUrl: audioUrl,
          });
          continue;
        }
      }

      if (currentStyle === 'next_verse') {
        let nextVerse = activeVerses[vIndex + 1];
        if (!nextVerse) nextVerse = activeVerses[vIndex - 1];
        if (!nextVerse) continue;

        const wrongVerses = activeVerses
          .filter((x) => x.verseNumber !== nextVerse.verseNumber && x.verseNumber !== v.verseNumber)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        if (wrongVerses.length < 3) continue;

        const rawOptions = [nextVerse.textArabic, ...wrongVerses.map((x) => x.textArabic)].sort(
          () => Math.random() - 0.5
        );
        const options = rawOptions.map((text) => getVerseSnippet(text, 7));
        const correctIndex = rawOptions.indexOf(nextVerse.textArabic);

        generated.push({
          id: `q_next_${i}_${v.verseNumber}`,
          type: 'next_verse',
          prompt: 'آیهٔ بعدی این فراز شریف را از میان گزینه‌ها برگزینید:',
          contextText: getVerseSnippet(v.textArabic, 10),
          options,
          correctIndex,
          explanation: `آیه بعدی (آیه ${toPersianDigits(nextVerse.verseNumber)}): «${nextVerse.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (currentStyle === 'prev_verse') {
        let prevVerse = activeVerses[vIndex - 1];
        if (!prevVerse) prevVerse = activeVerses[vIndex + 1];
        if (!prevVerse) continue;

        const wrongVerses = activeVerses
          .filter((x) => x.verseNumber !== prevVerse.verseNumber && x.verseNumber !== v.verseNumber)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        if (wrongVerses.length < 3) continue;

        const rawOptions = [prevVerse.textArabic, ...wrongVerses.map((x) => x.textArabic)].sort(
          () => Math.random() - 0.5
        );
        const options = rawOptions.map((text) => getVerseSnippet(text, 7));
        const correctIndex = rawOptions.indexOf(prevVerse.textArabic);

        generated.push({
          id: `q_prev_${i}_${v.verseNumber}`,
          type: 'prev_verse',
          prompt: 'آیهٔ ماقبل (السابق) این فراز شریف کدام است؟',
          contextText: getVerseSnippet(v.textArabic, 10),
          options,
          correctIndex,
          explanation: `آیه قبل (آیه ${toPersianDigits(prevVerse.verseNumber)}): «${prevVerse.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (currentStyle === 'fill_blank') {
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
        // خلاصه کلمات جهت عدم پر شدن بیش از حد صفحه
        const displayWords = words.length > 12 ? words.slice(0, 11) : words;
        const blankedText =
          displayWords.map((w, idx) => (idx === targetItem.idx ? '【 ... 】' : w)).join(' ') +
          (words.length > 12 ? ' ...' : '');

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
          id: `q_blank_${i}_${v.verseNumber}`,
          type: 'fill_blank',
          prompt: 'کلمهٔ مخفی‌شده در جای خالی 【 ... 】 کدام است؟',
          contextText: blankedText,
          options,
          correctIndex,
          explanation: `متن آیه ${toPersianDigits(v.verseNumber)}: «${v.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (currentStyle === 'mutashabihat') {
        const words = v.textArabic.trim().split(/\s+/);
        if (words.length < 4) continue;

        const endingLength = Math.min(3, Math.max(2, Math.floor(words.length / 3)));
        const headWords = words.slice(0, words.length - endingLength).join(' ');
        const endingText = words.slice(words.length - endingLength).join(' ');

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
          id: `q_mutashab_${i}_${v.verseNumber}`,
          type: 'mutashabihat',
          prompt: 'پایان‌بندی صحیح این آیه شریفه کدام عبارت است؟',
          contextText: getVerseSnippet(headWords, 8) + ' ...',
          options,
          correctIndex,
          explanation: `پایان‌بندی آیه ${toPersianDigits(v.verseNumber)}: «${v.textArabic}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (currentStyle === 'translation_match') {
        const trans = v.translationMakarem || v.translationFooladvand;
        if (!trans) continue;

        const otherVerses = activeVerses
          .filter((x) => x.verseNumber !== v.verseNumber && (x.translationMakarem || x.translationFooladvand))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        if (otherVerses.length < 3) continue;

        const correctTransSnippet = getVerseSnippet(trans, 8);
        const wrongSnippets = otherVerses.map((ov) =>
          getVerseSnippet(ov.translationMakarem || ov.translationFooladvand || '', 8)
        );

        const options = [correctTransSnippet, ...wrongSnippets].sort(() => Math.random() - 0.5);
        const correctIndex = options.indexOf(correctTransSnippet);

        generated.push({
          id: `q_trans_${i}_${v.verseNumber}`,
          type: 'translation_match',
          prompt: 'کدام ترجمه با این فراز نورانی همخوانی دارد؟',
          contextText: getVerseSnippet(v.textArabic, 9),
          options,
          correctIndex,
          explanation: `ترجمه آیه ${toPersianDigits(v.verseNumber)}: «${trans}»`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else if (currentStyle === 'surah_identity') {
        const otherSurahs = ALL_SURAHS.filter((s) => s.id !== activeSurah.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        const options = [
          `سوره ${activeSurah.nameArabic}`,
          ...otherSurahs.map((s) => `سوره ${s.nameArabic}`),
        ].sort(() => Math.random() - 0.5);
        const correctIndex = options.indexOf(`سوره ${activeSurah.nameArabic}`);

        generated.push({
          id: `q_surahid_${i}_${v.verseNumber}`,
          type: 'surah_identity',
          prompt: 'این فراز شریف متعلق به کدام سورهٔ مبارکه است؟',
          contextText: getVerseSnippet(v.textArabic, 9),
          options,
          correctIndex,
          explanation: `این آیه در سوره مبارکه ${activeSurah.nameArabic} (${activeSurah.namePersian})، آیه ${toPersianDigits(v.verseNumber)} قرار دارد.`,
          surahId: activeSurah.id,
          surahName: activeSurah.nameArabic,
          verseNumber: v.verseNumber,
          verseAudioUrl: audioUrl,
        });
      } else {
        // verse_number
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
          id: `q_num_${i}_${v.verseNumber}`,
          type: 'verse_number',
          prompt: 'این فراز نورانی چندمین آیهٔ سوره است؟',
          contextText: getVerseSnippet(v.textArabic, 9),
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
      setErrorMessage('آیات کافی برای ایجاد آزمون یافت نشد. لطفاً سبک‌های بیشتری را فعال کنید.');
      return;
    }

    setQuestions(generated);
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setUserAnswers([]);

    // شروع آزمون در حالت تمام‌صفحه ریلز/شورتز
    setIsShortsFullscreenOpen(true);
  };

  return (
    <div className="space-y-4 select-none" dir="rtl">
      {/* مرحله ۱: تنظیمات پیشرفته استودیوی آزمون */}
      <div className="space-y-4">
        {/* کارت سوره فعال هماهنگ با سربرگ (بدون ایجاد لیست کشویی دوم و تکراری) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-sm shrink-0">
              {toPersianDigits(activeSurah.id)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  سوره {activeSurah.nameArabic} ({activeSurah.namePersian})
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold">
                  {activeSurah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                جزء {toPersianDigits(activeSurah.juzNumber)} • صفحه {toPersianDigits(activeSurah.startPage)} • {toPersianDigits(activeSurah.versesCount)} آیه
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>سوره فعال جهت سنجش و آزمون هوشمند</span>
          </div>
        </div>

        {/* پیام خطا در صورت وجود */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* انتخاب سطح سختی آزمون: آسان، متوسط، سخت */}
        <div className="rounded-3xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-teal-600" />
            <span>سطح دشواری آزمون حفظ:</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* آسان */}
            <button
              type="button"
              onClick={() => setDifficulty('easy')}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                difficulty === 'easy'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-xs'
                  : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs text-emerald-700 dark:text-emerald-400">
                <span>سطح آسان (آرامش‌بخش)</span>
                {difficulty === 'easy' && <Check className="w-4 h-4" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                زمان آسوده (۲۵ ثانیه)، گزینه‌های متمایزتر و راهنمایی همراه
              </p>
            </button>

            {/* متوسط */}
            <button
              type="button"
              onClick={() => setDifficulty('medium')}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                difficulty === 'medium'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/30 shadow-xs'
                  : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs text-amber-700 dark:text-amber-400">
                <span>سطح متوسط (استاندارد)</span>
                {difficulty === 'medium' && <Check className="w-4 h-4" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                زمان ۱۵ ثانیه، گزینه‌های تراز مسابقات و فواصل معمول
              </p>
            </button>

            {/* سخت */}
            <button
              type="button"
              onClick={() => setDifficulty('hard')}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                difficulty === 'hard'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/30 shadow-xs'
                  : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs text-rose-700 dark:text-rose-400">
                <span>سطح سخت (حرفه‌ای / مسابقات)</span>
                {difficulty === 'hard' && <Check className="w-4 h-4" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                زمان ۱۰ ثانیه، متشابهات دقیق و گزینه‌های فوق‌العاده نزدیک
              </p>
            </button>
          </div>
        </div>

        {/* تنوع سبک آزمون به صورت چک‌باکس و گزینه ترکیبی */}
        <div className="rounded-3xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-stone-100 dark:border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>سبک‌های آزمون (امکان انتخاب همزمان یا ترکیبی):</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                سبک‌های دلخواه را تیک بزنید تا سوالات به صورت هوشمند از بین آن‌ها تولید شوند.
              </p>
            </div>

            {/* دکمه برجسته گزینه ترکیبی */}
            <button
              type="button"
              onClick={toggleCombinedMode}
              className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                isCombinedMode
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm'
                  : 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-200'
              }`}
            >
              {isCombinedMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              <span>گزینه ترکیبی و جامع مسابقاتی</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {ALL_QUIZ_STYLES.map((style) => {
              const isChecked = isCombinedMode || selectedStyles.includes(style.id);
              const Icon = style.icon;

              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => toggleStyle(style.id)}
                  className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1.5 cursor-pointer ${
                    isChecked
                      ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/20 text-slate-800 dark:text-slate-100'
                      : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/50 text-slate-500 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
                      <Icon className="w-4 h-4 text-teal-600" />
                      <span>{style.title}</span>
                    </span>
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {style.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* تعیین محدوده (آیات یا صفحات مصحف شریف) و تعداد سوالات */}
        <div className="rounded-3xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* تعداد سوالات */}
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
                    {toPersianDigits(cnt)} سوال
                  </button>
                ))}
              </div>
            </div>

            {/* قاری برای تلاوت آیات سوالات */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                قاری صوت ترتیل (۱۲ قاری برجسته جهان اسلام):
              </label>
              <select
                value={selectedReciterId}
                onChange={(e) => setSelectedReciterId(e.target.value as ReciterId)}
                className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs font-bold text-teal-700 dark:text-teal-300 focus:outline-hidden"
              >
                {(Object.keys(RECITER_NAMES) as ReciterId[]).map((rid) => (
                  <option key={rid} value={rid}>
                    {RECITER_NAMES[rid].name} ({RECITER_NAMES[rid].title})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* تعیین محدوده بر اساس آیات یا صفحات مصحف */}
          <div className="pt-3 border-t border-stone-100 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom-range-toggle-studio"
                  checked={isRangeCustom}
                  onChange={(e) => setIsRangeCustom(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <label
                  htmlFor="custom-range-toggle-studio"
                  className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  تعیین محدوده مشخص (تمرین صفحه به صفحه یا بازه آیات)
                </label>
              </div>

              {isRangeCustom && (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-slate-800 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setRangeMode('verses')}
                    className={`py-1 px-3 rounded-lg transition-all ${
                      rangeMode === 'verses'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    بر اساس شماره آیات
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangeMode('pages')}
                    className={`py-1 px-3 rounded-lg transition-all ${
                      rangeMode === 'pages'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    بر اساس صفحات مصحف
                  </button>
                </div>
              )}
            </div>

            {/* کنترل‌های محدوده آیات یا صفحات */}
            {isRangeCustom && (
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                {rangeMode === 'verses' ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600 dark:text-slate-300">از آیه:</span>
                    <input
                      type="number"
                      min={1}
                      max={rangeEnd}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(Math.max(1, Number(e.target.value)))}
                      className="w-20 p-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold"
                    />
                    <span className="font-bold text-slate-600 dark:text-slate-300">تا آیه:</span>
                    <input
                      type="number"
                      min={rangeStart}
                      max={activeSurah.versesCount || 286}
                      value={rangeEnd}
                      onChange={(e) =>
                        setRangeEnd(Math.min(activeSurah.versesCount || 286, Number(e.target.value)))
                      }
                      className="w-20 p-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold"
                    />
                    <span className="text-slate-400">
                      (شامل {toPersianDigits(Math.max(1, rangeEnd - rangeStart + 1))} آیه)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600 dark:text-slate-300">از صفحه:</span>
                    <select
                      value={selectedStartPage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSelectedStartPage(val);
                        if (val > selectedEndPage) setSelectedEndPage(val);
                      }}
                      className="p-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                    >
                      {surahPages.map((p) => (
                        <option key={p} value={p}>
                          صفحه {toPersianDigits(p)}
                        </option>
                      ))}
                    </select>

                    <span className="font-bold text-slate-600 dark:text-slate-300">تا صفحه:</span>
                    <select
                      value={selectedEndPage}
                      onChange={(e) => setSelectedEndPage(Number(e.target.value))}
                      className="p-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                    >
                      {surahPages
                        .filter((p) => p >= selectedStartPage)
                        .map((p) => (
                          <option key={p} value={p}>
                            صفحه {toPersianDigits(p)}
                          </option>
                        ))}
                    </select>
                    <span className="text-slate-400">مصحف عثمان‌طه مدینه منوره</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* سوییچ تایمر سرعت پاسخگویی */}
          <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                تایمر سنجش سرعت پاسخگویی ({toPersianDigits(timePerQuestionSeconds)} ثانیه برای هر سوال)
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

        {/* دکمه شروع آزمون (فقط در حالت تمام‌صفحه ریلز و شورتز باز می‌شود با آیکون ساده) */}
        <div className="pt-1">
          <button
            onClick={() => generateQuestions(true)}
            disabled={isLoadingVerses}
            className="w-full py-4 px-6 rounded-3xl bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-[0.99] text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-teal-900/20 disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>
              {isLoadingVerses
                ? 'در حال آماده‌سازی...'
                : `شروع آزمون (${toPersianDigits(questionCount)} سوال)`}
            </span>
          </button>
        </div>

        {/* تاریخچه آخرین آزمون‌ها */}
        {quizHistory.length > 0 && (
          <div className="rounded-3xl p-4 sm:p-5 border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-teal-600" />
              <span>سوابق آخرین آزمون‌های حفظ شما:</span>
            </h3>
            <div className="space-y-2">
              {quizHistory.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      سوره {item.surahName}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {item.typeLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden xs:inline">{item.date}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-teal-700 dark:text-teal-400">
                      {toPersianDigits(item.score)} از {toPersianDigits(item.total)}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold">
                      {toPersianDigits(item.percent)}٪
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* آزمون شورتز تمام‌صفحه ریلز با اسلاید عمودی */}
      <FullscreenShortsQuiz
        isOpen={isShortsFullscreenOpen}
        onClose={() => setIsShortsFullscreenOpen(false)}
        questions={questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          contextText: q.contextText,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          surahName: q.surahName,
          verseNumber: q.verseNumber,
          verseAudioUrl: q.verseAudioUrl,
          categoryBadge:
            q.type === 'quran_stories'
              ? 'قصص قرآنی'
              : q.type === 'next_verse'
              ? 'آیه بعدی'
              : q.type === 'prev_verse'
              ? 'آیه قبلی'
              : q.type === 'fill_blank'
              ? 'کلمه مخفی'
              : q.type === 'mutashabihat'
              ? 'مشابهات'
              : q.type === 'translation_match'
              ? 'ترجمه و مفاهیم'
              : q.type === 'surah_identity'
              ? 'تشخیص سوره'
              : 'شماره آیه',
        }))}
        title={`آزمون حفظ سوره ${activeSurah.nameArabic}`}
        timePerQuestion={timePerQuestionSeconds}
        difficulty={difficulty}
        onRestart={() => {
          generateQuestions(true);
        }}
      />
    </div>
  );
};
