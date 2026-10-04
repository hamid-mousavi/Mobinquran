import React, { useState, useMemo, useEffect } from 'react';
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
  Play,
  Languages,
  Compass,
  History,
  Trash2,
  Settings2,
  Sliders,
  Shuffle,
  AlignJustify,
  Link2,
  Keyboard,
} from 'lucide-react';
import { Surah, Verse } from '../types';
import { toPersianDigits } from '../utils/textNormalization';
import { getAudioSourceUrl, ReciterId } from '../services/audioSources';
import { QURAN_STORIES } from '../data/quranStories';
import { RealisticQuizView, QuizQuestionItem } from './RealisticQuizView';
import { ReciterSelectorDropdown } from './ReciterSelectorDropdown';
import { SurahSelectorModal } from './SurahSelectorModal';
import { QuranService } from '../services/quranService';

interface MemorizationQuizStudioProps {
  currentSurah: Surah;
  surahs: Surah[];
  verses: Verse[];
  darkMode: boolean;
  onSelectSurah?: (surah: Surah) => void;
  onBack?: () => void;
}

export type QuizType =
  | 'next_verse'
  | 'prev_verse'
  | 'fill_blank'
  | 'mutashabihat'
  | 'translation_match'
  | 'verse_number'
  | 'surah_identity'
  | 'quran_stories'
  | 'ordering'
  | 'matching'
  | 'typing';

export type BlankPosition = 'start' | 'middle' | 'end';

interface SavedQuizResult {
  id: string;
  date: string;
  surahName: string;
  score: number;
  total: number;
  percent: number;
  typeLabel: string;
  durationSeconds?: number;
}

// کوتاه‌سازی هوشمند فرازهای طولانی
const getVerseSnippet = (text: string, maxWords: number = 24): string => {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
};

export const MemorizationQuizStudio: React.FC<MemorizationQuizStudioProps> = ({
  currentSurah,
  surahs,
  verses,
  darkMode,
  onSelectSurah,
  onBack,
}) => {
  // تب‌های استودیو: آزمون‌ساز / تاریخچه آزمون‌ها
  const [activeTab, setActiveTab] = useState<'creator' | 'history'>('creator');

  // دسته‌بندی سبک‌های انتخاب شده
  const [selectedStyles, setSelectedStyles] = useState<QuizType[]>([
    'next_verse',
    'fill_blank',
    'mutashabihat',
  ]);

  // محدوده آزمون: سوره انتخابی / کل قرآن کریم
  const [quizScope, setQuizScope] = useState<'surah' | 'all_quran'>('surah');

  // موقعیت‌های کلمه مخفی در ۴ گزینه‌ای (چک‌باکس‌های چندگانه)
  const [blankPositions, setBlankPositions] = useState<BlankPosition[]>(['start', 'middle', 'end']);

  const [questionCount, setQuestionCount] = useState<number>(10);
  const [activeVerses, setActiveVerses] = useState<Verse[]>(verses);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // محدوده آزمون: بر اساس آیات یا صفحات مصحف
  const [rangeMode, setRangeMode] = useState<'verses' | 'pages'>('verses');
  const [isRangeCustom, setIsRangeCustom] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(currentSurah.versesCount || 10);

  // تایمر کل آزمون (برای ۲۰ سوال ۱۵ دقیقه = ۴۵ ثانیه به ازای هر سوال)
  const [isTimerEnabled, setIsTimerEnabled] = useState<boolean>(true);
  const totalQuizDurationSeconds = useMemo(() => {
    return Math.round(questionCount * 45); // 20 سوال = 900 ثانیه (15 دقیقه)
  }, [questionCount]);

  // قاری ترتیل
  const [selectedReciterId, setSelectedReciterId] = useState<ReciterId>('parhizgar');

  // مودال انتخاب سوره
  const [isSurahPickerOpen, setIsSurahPickerOpen] = useState(false);

  // صفحات سوره
  const surahPages = useMemo(() => {
    const pageSet = new Set<number>();
    verses.forEach((v) => {
      if (v.pageNumber) pageSet.add(v.pageNumber);
    });
    return Array.from(pageSet).sort((a, b) => a - b);
  }, [verses]);

  const [selectedStartPage, setSelectedStartPage] = useState<number>(
    surahPages[0] || currentSurah.startPage || 1
  );
  const [selectedEndPage, setSelectedEndPage] = useState<number>(
    surahPages[surahPages.length - 1] || currentSurah.startPage || 1
  );

  // وضعیت جلسه آزمون
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestionItem[]>([]);
  const [isQuizActive, setIsQuizActive] = useState(false);

  // تاریخچه نتایج آزمون از حافظه محلی
  const [quizHistory, setQuizHistory] = useState<SavedQuizResult[]>(() => {
    try {
      const saved = localStorage.getItem('mobin_memorization_quiz_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeSurah = currentSurah;

  useEffect(() => {
    setActiveVerses(verses);
    setRangeStart(1);
    setRangeEnd(currentSurah.versesCount || 10);
    if (surahPages.length > 0) {
      setSelectedStartPage(surahPages[0]);
      setSelectedEndPage(surahPages[surahPages.length - 1]);
    }
  }, [currentSurah, verses, surahPages]);

  // محاسبه سطح دشواری به صورت خودکار بر اساس سبک‌های انتخابی
  const calculatedDifficultyLevel = useMemo(() => {
    if (
      selectedStyles.includes('mutashabihat') ||
      selectedStyles.includes('ordering') ||
      selectedStyles.includes('typing')
    ) {
      return { label: 'پیشرفته و چالشی', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
    }
    if (selectedStyles.includes('fill_blank') || selectedStyles.includes('prev_verse')) {
      return { label: 'متوسط و استاندارد', color: 'text-teal-700 bg-teal-500/10 border-teal-500/20' };
    }
    return { label: 'مقدماتی و روان', color: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20' };
  }, [selectedStyles]);

  // تاگل چک‌باکس سبک‌ها
  const toggleStyle = (styleId: QuizType) => {
    setSelectedStyles((prev) => {
      if (prev.includes(styleId)) {
        if (prev.length === 1) return prev; // حداقل یک سبک
        return prev.filter((s) => s !== styleId);
      }
      return [...prev, styleId];
    });
  };

  // تولید هوشمند سوالات آزمون
  const generateQuestions = async () => {
    setErrorMessage(null);

    // آماده‌سازی مخزن آیات بر اساس محدوده (تک‌سوره یا کل قرآن)
    type PoolItem = { verse: Verse; surah: Surah };
    let pool: PoolItem[] = [];

    if (quizScope === 'all_quran') {
      // آزمون کل قرآن: انتخاب تصادفی سوره‌ها از ۱۱۴ سوره
      const candidateSurahs = [...surahs].sort(() => Math.random() - 0.5).slice(0, 10);
      for (const s of candidateSurahs) {
        try {
          const sVerses = await QuranService.getVersesBySurah(s.id);
          if (sVerses && sVerses.length > 0) {
            const sampled = [...sVerses].sort(() => Math.random() - 0.5).slice(0, 4);
            sampled.forEach((v) => pool.push({ verse: v, surah: s }));
          }
        } catch {}
      }
      if (pool.length === 0) {
        activeVerses.forEach((v) => pool.push({ verse: v, surah: activeSurah }));
      }
    } else {
      let filteredVerses = [...activeVerses];
      if (isRangeCustom) {
        if (rangeMode === 'verses') {
          filteredVerses = filteredVerses.filter((v) => v.verseNumber >= rangeStart && v.verseNumber <= rangeEnd);
        } else {
          filteredVerses = filteredVerses.filter(
            (v) => v.pageNumber >= selectedStartPage && v.pageNumber <= selectedEndPage
          );
        }
      }
      filteredVerses.forEach((v) => pool.push({ verse: v, surah: activeSurah }));
    }

    if (pool.length < 2) {
      setErrorMessage('تعداد آیات در این محدوده برای آزمون کافی نیست. لطفاً بازه را گسترش دهید.');
      return;
    }

    // فیلتر سبک‌ها: در آزمون تک‌سوره تشخیص سوره بی‌معنی است
    const effectiveStyles = selectedStyles.filter((s) => {
      if (quizScope === 'surah' && s === 'surah_identity') return false;
      return true;
    });

    if (effectiveStyles.length === 0) {
      setErrorMessage('لطفاً حداقل یک سبک آزمون متناسب با این محدوده را انتخاب فرمایید.');
      return;
    }

    const generated: QuizQuestionItem[] = [];
    const totalToGenerate = Math.min(questionCount, Math.max(pool.length, 30));
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

    for (let i = 0; i < totalToGenerate; i++) {
      const item = shuffledPool[i % shuffledPool.length];
      const v = item.verse;
      const itemSurah = item.surah;
      const vIndex = activeVerses.findIndex((x) => x.verseNumber === v.verseNumber);
      const audioUrl = getAudioSourceUrl(selectedReciterId, itemSurah.id, v.verseNumber, 0);
      const currentStyle = effectiveStyles[i % effectiveStyles.length];

      // ۱. سبک چینشی (Ordering)
      if (currentStyle === 'ordering') {
        const words = v.textArabic.trim().split(/\s+/);
        if (words.length >= 3) {
          const sliceWords = words.length > 9 ? words.slice(0, 7) : words;
          const shuffledTokens = [...sliceWords].sort(() => Math.random() - 0.5);
          generated.push({
            id: `q_order_${i}_${v.verseNumber}`,
            prompt: `کلمات این فراز از سوره مبارکه ${itemSurah.nameArabic} را به ترتیب صحیح مرتب کنید:`,
            contextText: `فراز ${toPersianDigits(sliceWords.length)} کلمه‌ای از آیه شریفه`,
            options: [sliceWords.join(' ')],
            correctIndex: 0,
            explanation: `ترتیب کامل آیه ${toPersianDigits(v.verseNumber)}: «${v.textArabic}»`,
            surahName: itemSurah.nameArabic,
            verseNumber: v.verseNumber,
            verseAudioUrl: audioUrl,
            categoryBadge: 'چینشی و مرتب‌سازی',
            questionMode: 'ordering',
            orderingTokens: shuffledTokens,
          });
          continue;
        }
      }

      // ۲. سبک تایپی (Typing)
      if (currentStyle === 'typing') {
        const words = v.textArabic.trim().split(/\s+/);
        if (words.length >= 3) {
          const targetIdx = Math.min(words.length - 1, Math.max(1, Math.floor(words.length / 2)));
          const targetWord = words[targetIdx];
          const previewText = words
            .map((w, idx) => (idx === targetIdx ? '( • • • )' : w))
            .slice(Math.max(0, targetIdx - 3), Math.min(words.length, targetIdx + 4))
            .join(' ');

          const otherWords = activeVerses
            .filter((ov) => ov.verseNumber !== v.verseNumber)
            .flatMap((ov) => ov.textArabic.trim().split(/\s+/))
            .filter((w) => w && w.length > 2 && w !== targetWord)
            .slice(0, 3);

          generated.push({
            id: `q_type_${i}_${v.verseNumber}`,
            prompt: 'کلمه مخفی در پرانتز ( • • • ) را بنویسید یا انتخاب کنید:',
            contextText: previewText,
            options: [targetWord, ...otherWords].sort(() => Math.random() - 0.5),
            correctIndex: 0,
            explanation: `کلمه صحیح: «${targetWord}» • آیه کامل: «${v.textArabic}»`,
            surahName: itemSurah.nameArabic,
            verseNumber: v.verseNumber,
            verseAudioUrl: audioUrl,
            categoryBadge: 'تایپی و نوشتاری',
            questionMode: 'typing',
            targetWord,
            isBlankFill: true,
          });
          continue;
        }
      }

      // ۳. سبک تکمیل کلمه مخفی با انتخاب موقعیت از چک‌باکس‌ها (ابتدای آیه، انتهای آیه، وسط آیات)
      if (currentStyle === 'fill_blank') {
        const words = v.textArabic.trim().split(/\s+/);
        if (words.length >= 3) {
          const allowedPositions = blankPositions.length > 0 ? blankPositions : (['start', 'middle', 'end'] as BlankPosition[]);
          const pos = allowedPositions[i % allowedPositions.length];

          let targetWord = '';
          let blankedText = '';

          if (pos === 'start') {
            targetWord = words[0];
            const rest = words.slice(1, 9).join(' ');
            blankedText = `( • • • ) ${rest}`;
          } else if (pos === 'end') {
            targetWord = words[words.length - 1];
            const leading = words.slice(Math.max(0, words.length - 9), words.length - 1).join(' ');
            blankedText = `${leading} ( • • • )`;
          } else {
            const midIndex = Math.floor(words.length / 2);
            targetWord = words[midIndex];
            const startIdx = Math.max(0, midIndex - 3);
            const endIdx = Math.min(words.length, midIndex + 4);
            blankedText = words
              .slice(startIdx, endIdx)
              .map((w, idx) => (startIdx + idx === midIndex ? '( • • • )' : w))
              .join(' ');
          }

          // جمع‌آوری گزینه‌های غلط
          const wrongCandidates = activeVerses
            .filter((ov) => ov.verseNumber !== v.verseNumber)
            .map((ov) => {
              const ws = ov.textArabic.trim().split(/\s+/);
              if (pos === 'start') return ws[0];
              if (pos === 'end') return ws[ws.length - 1];
              return ws[Math.floor(ws.length / 2)];
            })
            .filter((w) => w && w !== targetWord && w.length > 1);

          const defaultFallbacks = ['الَّذِينَ', 'عَلِيمٌ', 'حَكِيمٌ', 'قَدِيرٌ', 'رَحِيمٌ'];
          const wrongOptions = Array.from(new Set([...wrongCandidates, ...defaultFallbacks]))
            .filter((w) => w !== targetWord)
            .slice(0, 3);

          const options = [targetWord, ...wrongOptions].sort(() => Math.random() - 0.5);
          const correctIndex = options.indexOf(targetWord);

          generated.push({
            id: `q_blank_${i}_${v.verseNumber}`,
            prompt: 'کلمه مخفی در پرانتز ( • • • ) کدام است؟',
            contextText: blankedText,
            options,
            correctIndex,
            explanation: `متن کامل آیه ${toPersianDigits(v.verseNumber)}: «${v.textArabic}»`,
            surahName: activeSurah.nameArabic,
            verseNumber: v.verseNumber,
            verseAudioUrl: audioUrl,
            fullVerseText: v.textArabic,
            categoryBadge:
              pos === 'start'
                ? 'کلمه مخفی (ابتدای آیه)'
                : pos === 'end'
                ? 'کلمه مخفی (انتهای آیه)'
                : 'کلمه مخفی (وسط آیه)',
            isBlankFill: true,
          });
          continue;
        }
      }

      // ۴. سبک اکمال آیه بعدی (next_verse)
      if (currentStyle === 'next_verse') {
        let nextVerse = activeVerses[vIndex + 1];
        if (!nextVerse) nextVerse = activeVerses[vIndex - 1];
        if (nextVerse) {
          const wrongVerses = activeVerses
            .filter((x) => x.verseNumber !== nextVerse.verseNumber && x.verseNumber !== v.verseNumber)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

          if (wrongVerses.length >= 2) {
            const rawOptions = [nextVerse.textArabic, ...wrongVerses.map((x) => x.textArabic)].sort(
              () => Math.random() - 0.5
            );
            const options = rawOptions.map((text) => getVerseSnippet(text, 22));
            const correctIndex = rawOptions.indexOf(nextVerse.textArabic);

            generated.push({
              id: `q_next_${i}_${v.verseNumber}`,
              prompt: 'آیهٔ بعدی این فراز نورانی را برگزینید:',
              contextText: getVerseSnippet(v.textArabic, 12),
              options,
              correctIndex,
              explanation: `آیه بعدی آیه ${toPersianDigits(nextVerse.verseNumber)}: «${nextVerse.textArabic}»`,
              surahName: activeSurah.nameArabic,
              verseNumber: v.verseNumber,
              verseAudioUrl: audioUrl,
              fullVerseText: v.textArabic,
              categoryBadge: 'اکمال آیه بعدی',
            });
            continue;
          }
        }
      }

      // ۵. سبک آیه قبلی (prev_verse)
      if (currentStyle === 'prev_verse') {
        let prevVerse = activeVerses[vIndex - 1];
        if (!prevVerse) prevVerse = activeVerses[vIndex + 1];
        if (prevVerse) {
          const wrongVerses = activeVerses
            .filter((x) => x.verseNumber !== prevVerse.verseNumber && x.verseNumber !== v.verseNumber)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

          if (wrongVerses.length >= 2) {
            const rawOptions = [prevVerse.textArabic, ...wrongVerses.map((x) => x.textArabic)].sort(
              () => Math.random() - 0.5
            );
            const options = rawOptions.map((text) => getVerseSnippet(text, 22));
            const correctIndex = rawOptions.indexOf(prevVerse.textArabic);

            generated.push({
              id: `q_prev_${i}_${v.verseNumber}`,
              prompt: 'آیهٔ ماقبل (السابق) این فراز شریف کدام است؟',
              contextText: getVerseSnippet(v.textArabic, 12),
              options,
              correctIndex,
              explanation: `آیه قبل آیه ${toPersianDigits(prevVerse.verseNumber)}: «${prevVerse.textArabic}»`,
              surahName: activeSurah.nameArabic,
              verseNumber: v.verseNumber,
              verseAudioUrl: audioUrl,
              fullVerseText: v.textArabic,
              categoryBadge: 'آیه قبلی (السابق)',
            });
            continue;
          }
        }
      }

      // ۶. سبک مشابهات و پایان‌بندی‌ها (mutashabihat)
      if (currentStyle === 'mutashabihat') {
        const words = v.textArabic.trim().split(/\s+/);
        if (words.length >= 4) {
          const endingLength = Math.min(3, Math.max(2, Math.floor(words.length / 3)));
          const headWords = words.slice(0, words.length - endingLength).join(' ');
          const endingText = words.slice(words.length - endingLength).join(' ');

          const commonEndings = [
            'إِنَّ اللَّهَ غَفُورٌ رَّحِيمٌ',
            'وَاللَّهُ عَلِيمٌ حَكِيمٌ',
            'إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
            'وَاللَّهُ بِمَا تَعْمَلُونَ بَصِيرٌ',
            'وَكَانَ اللَّهُ عَزِيزًا حَكِيمًا',
            'إِنَّ اللَّهَ شَدِيدُ الْعِقَابِ',
            'وَإِلَيْهِ الْمَصِيرُ',
          ].filter((e) => e !== endingText);

          const wrongEndings = commonEndings.sort(() => Math.random() - 0.5).slice(0, 3);
          const options = [endingText, ...wrongEndings].sort(() => Math.random() - 0.5);
          const correctIndex = options.indexOf(endingText);

          generated.push({
            id: `q_mutashab_${i}_${v.verseNumber}`,
            prompt: 'پایان‌بندی صحیح این آیه شریفه کدام است؟',
            contextText: `${getVerseSnippet(headWords, 12)} ( • • • )`,
            options,
            correctIndex,
            explanation: `پایان‌بندی آیه ${toPersianDigits(v.verseNumber)}: «${v.textArabic}»`,
            surahName: activeSurah.nameArabic,
            verseNumber: v.verseNumber,
            verseAudioUrl: audioUrl,
            fullVerseText: v.textArabic,
            categoryBadge: 'مشابهات و فواصل',
            isBlankFill: true,
          });
          continue;
        }
      }

      // ۷. سبک تطبیق ترجمه و مفاهیم (translation_match)
      if (currentStyle === 'translation_match') {
        const trans = v.translationMakarem || v.translationFooladvand;
        if (trans) {
          const otherVerses = activeVerses
            .filter((x) => x.verseNumber !== v.verseNumber && (x.translationMakarem || x.translationFooladvand))
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

          if (otherVerses.length >= 2) {
            const correctTrans = getVerseSnippet(trans, 9);
            const wrongSnippets = otherVerses.map((ov) =>
              getVerseSnippet(ov.translationMakarem || ov.translationFooladvand || '', 9)
            );
            const options = [correctTrans, ...wrongSnippets].sort(() => Math.random() - 0.5);
            const correctIndex = options.indexOf(correctTrans);

            generated.push({
              id: `q_trans_${i}_${v.verseNumber}`,
              prompt: 'کدام ترجمه با این فراز نورانی منطبق است؟',
              contextText: getVerseSnippet(v.textArabic, 11),
              options,
              correctIndex,
              explanation: `ترجمه آیه ${toPersianDigits(v.verseNumber)}: «${trans}»`,
              surahName: itemSurah.nameArabic,
              verseNumber: v.verseNumber,
              verseAudioUrl: audioUrl,
              fullVerseText: v.textArabic,
              categoryBadge: 'تطبیق ترجمه و مفاهیم',
            });
            continue;
          }
        }
      }

      // ۸. پیش‌فرض یا سبک تشخیص نام سوره (مختص آزمون کل قرآن)
      const targetSurahObj = itemSurah || activeSurah;
      const wrongSurahs = surahs
        .filter((s) => s.id !== targetSurahObj.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const options = [targetSurahObj.nameArabic, ...wrongSurahs.map((s) => s.nameArabic)].sort(
        () => Math.random() - 0.5
      );
      const correctIndex = options.indexOf(targetSurahObj.nameArabic);

      generated.push({
        id: `q_identity_${i}_${v.verseNumber}`,
        prompt: 'این فراز نورانی متعلق به کدام سوره مبارکه است؟',
        contextText: getVerseSnippet(v.textArabic, 12),
        options,
        correctIndex,
        explanation: `این فراز مربوط به آیه ${toPersianDigits(v.verseNumber)} سوره مبارکه «${targetSurahObj.nameArabic}» است.`,
        surahName: targetSurahObj.nameArabic,
        verseNumber: v.verseNumber,
        verseAudioUrl: audioUrl,
        fullVerseText: v.textArabic,
        categoryBadge: 'تشخیص نام سوره',
      });
    }

    if (generated.length === 0) {
      setErrorMessage('تولید سوال برای این محدوده مقدور نشد. لطفاً سبک‌های دیگری را انتخاب کنید.');
      return;
    }

    setGeneratedQuestions(generated);
    setIsQuizActive(true);
  };

  const handleFinishQuiz = (finalScore: number, totalQ: number) => {
    const percent = Math.round((finalScore / Math.max(1, totalQ)) * 100);
    const newRecord: SavedQuizResult = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('fa-IR'),
      surahName: activeSurah.nameArabic,
      score: finalScore,
      total: totalQ,
      percent,
      typeLabel: selectedStyles.length > 2 ? 'جامع ترکیبی' : 'تخصصی',
      durationSeconds: totalQuizDurationSeconds,
    };
    setQuizHistory((prev) => {
      const updated = [newRecord, ...prev].slice(0, 15);
      try {
        localStorage.setItem('mobin_memorization_quiz_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearHistory = () => {
    if (confirm('آیا از حذف تمام تاریخچه آزمون‌ها اطمینان دارید؟')) {
      setQuizHistory([]);
      try {
        localStorage.removeItem('mobin_memorization_quiz_history');
      } catch {}
    }
  };

  // میانگین درصد پیشرفت در تاریخچه
  const averageHistoryPercent = useMemo(() => {
    if (quizHistory.length === 0) return 0;
    const sum = quizHistory.reduce((acc, curr) => acc + curr.percent, 0);
    return Math.round(sum / quizHistory.length);
  }, [quizHistory]);

  return (
    <div className="space-y-4 select-none max-w-2xl mx-auto w-full" dir="rtl">
      {/* سربرگ خلوت و تب‌های اصلی */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
              title="بازگشت"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>آزمون‌ساز حفظ قرآن</span>
          </h2>
        </div>

        {/* سوییچ بین آزمون‌ساز و تاریخچه */}
        <div className="flex items-center p-1 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('creator')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'creator'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            طراحی آزمون
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>تاریخچه</span>
            {quizHistory.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center">
                {toPersianDigits(quizHistory.length)}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'creator' ? (
        /* تب طراحی آزمون (فشرده و تک‌صفحه‌ای) */
        <div className="space-y-3.5">
          {/* کارت انتخاب محدوده آزمون: سوره فعلی یا کل قرآن */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-teal-600" />
                <span>محدوده آزمون:</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {quizScope === 'all_quran' ? 'سراسر ۱۱۴ سوره' : `سوره ${activeSurah.nameArabic}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuizScope('surah');
                  setSelectedStyles((prev) => prev.filter((s) => s !== 'surah_identity'));
                }}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                  quizScope === 'surah'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold ring-1 ring-teal-500/30'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">سوره انتخابی</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    {activeSurah.nameArabic} ({toPersianDigits(activeSurah.versesCount)} آیه)
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    quizScope === 'surah'
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-stone-300 dark:border-slate-600'
                  }`}
                >
                  {quizScope === 'surah' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuizScope('all_quran');
                  setSelectedStyles((prev) => (prev.includes('surah_identity') ? prev : [...prev, 'surah_identity']));
                }}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                  quizScope === 'all_quran'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold ring-1 ring-teal-500/30'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">کل قرآن کریم</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    ۱۱۴ سوره • جامع و تصادفی
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    quizScope === 'all_quran'
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-stone-300 dark:border-slate-600'
                  }`}
                >
                  {quizScope === 'all_quran' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            </div>

            {/* در صورت انتخاب تک‌سوره، دکمه تغییر سوره نمایش داده شود */}
            {quizScope === 'surah' && (
              <div className="pt-1 flex items-center justify-between border-t border-stone-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500">
                  سوره فعال: <strong className="text-teal-700 dark:text-teal-300">سوره {activeSurah.nameArabic}</strong> (جزء {toPersianDigits(activeSurah.juzNumber)})
                </span>
                <button
                  type="button"
                  onClick={() => setIsSurahPickerOpen(true)}
                  className="px-2.5 py-1 rounded-lg border border-teal-500/30 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 font-bold text-[11px] hover:bg-teal-100 transition-all cursor-pointer active:scale-95"
                >
                  تغییر سوره
                </button>
              </div>
            )}
          </div>

          {/* پیام خطا در صورت وجود */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* دسته‌بندی سبک‌های آزمون (۴ گزینه‌ای، چینشی، وصلی، تایپی) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                <span>سبک‌ها و قالب‌های آزمون:</span>
              </label>

              {/* نشان خودکار سطح سختی */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${calculatedDifficultyLevel.color}`}>
                سطح تخمینی: {calculatedDifficultyLevel.label}
              </span>
            </div>

            {/* دسته‌بندی ۱: چهارگزینه‌ای‌ها */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 block">قالب ۴ گزینه‌ای:</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'next_verse' as QuizType, title: 'اکمال آیه بعدی' },
                  { id: 'prev_verse' as QuizType, title: 'آیه ماقبل (السابق)' },
                  { id: 'fill_blank' as QuizType, title: 'تکمیل کلمه مخفی ( • • • )' },
                  { id: 'mutashabihat' as QuizType, title: 'مشابهات و فواصل' },
                  { id: 'translation_match' as QuizType, title: 'تطبیق ترجمه و مفاهیم' },
                  { id: 'surah_identity' as QuizType, title: 'تشخیص نام سوره' },
                ].map((item) => {
                  const isSurahIdentityDisabled = item.id === 'surah_identity' && quizScope === 'surah';
                  const isChecked = selectedStyles.includes(item.id) && !isSurahIdentityDisabled;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isSurahIdentityDisabled}
                      onClick={() => {
                        if (!isSurahIdentityDisabled) toggleStyle(item.id);
                      }}
                      className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between text-xs font-bold ${
                        isSurahIdentityDisabled
                          ? 'border-dashed border-stone-300 dark:border-slate-700 bg-stone-100/60 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed opacity-75'
                          : isChecked
                          ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 ring-1 ring-teal-500/30 cursor-pointer'
                          : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 text-slate-600 dark:text-slate-400 cursor-pointer'
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{item.title}</span>
                        {isSurahIdentityDisabled && (
                          <span className="text-[9px] font-normal text-amber-600 dark:text-amber-400 mt-0.5">
                            (مختص آزمون کل قرآن)
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mr-1 ${
                          isSurahIdentityDisabled
                            ? 'border-stone-300 bg-stone-200/50 dark:bg-slate-700/50'
                            : isChecked
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-stone-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* زیرگزینه هوشمند موقعیت کلمه مخفی با چک‌باکس‌های چندگانه */}
              {selectedStyles.includes('fill_blank') && (
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-2 animate-fadeIn">
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200 block">
                    موقعیت کلمه مخفی در آیات (انتخاب با چک‌باکس):
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                    {[
                      { id: 'start' as BlankPosition, title: 'ابتدای آیات' },
                      { id: 'middle' as BlankPosition, title: 'وسط آیات' },
                      { id: 'end' as BlankPosition, title: 'انتهای آیات' },
                    ].map((pos) => {
                      const isChecked = blankPositions.includes(pos.id);
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => {
                            if (isChecked && blankPositions.length === 1) return; // حداقل یکی فعال بماند
                            setBlankPositions((prev) =>
                              isChecked ? prev.filter((p) => p !== pos.id) : [...prev, pos.id]
                            );
                          }}
                          className={`py-2 px-2.5 rounded-lg border text-right transition-all flex items-center justify-between cursor-pointer ${
                            isChecked
                              ? 'bg-teal-600/15 border-teal-600 text-teal-900 dark:text-teal-200 font-bold shadow-2xs'
                              : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span className="text-[11px]">{pos.title}</span>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isChecked
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'border-stone-300 dark:border-slate-600 bg-transparent'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* دسته‌بندی ۲ و ۳ و ۴: قالب‌های تعاملی نوین (چینشی، تایپی) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-500 block">قالب‌های تعاملی و مهارتی:</span>
              <div className="grid grid-cols-2 gap-2">
                {/* سبک چینشی */}
                <button
                  type="button"
                  onClick={() => toggleStyle('ordering')}
                  className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between text-xs font-bold cursor-pointer ${
                    selectedStyles.includes('ordering')
                      ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 ring-1 ring-teal-500/30'
                      : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlignJustify className="w-3.5 h-3.5 text-teal-600" />
                    <span className="truncate">چینشی (مرتب‌سازی)</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                      selectedStyles.includes('ordering') ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-300'
                    }`}
                  >
                    {selectedStyles.includes('ordering') && <Check className="w-3 h-3" />}
                  </div>
                </button>

                {/* سبک تایپی */}
                <button
                  type="button"
                  onClick={() => toggleStyle('typing')}
                  className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between text-xs font-bold cursor-pointer ${
                    selectedStyles.includes('typing')
                      ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 ring-1 ring-teal-500/30'
                      : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Keyboard className="w-3.5 h-3.5 text-teal-600" />
                    <span className="truncate">تایپی و نوشتاری</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                      selectedStyles.includes('typing') ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-300'
                    }`}
                  >
                    {selectedStyles.includes('typing') && <Check className="w-3 h-3" />}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* تعداد سوالات و زمان‌بندی کل آزمون */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-teal-600" />
                <span>تعداد سوالات:</span>
              </label>

              <div className="flex items-center gap-1.5">
                {[5, 10, 15, 20, 30].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionCount(num)}
                    className={`w-8 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      questionCount === num
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-stone-200'
                    }`}
                  >
                    {toPersianDigits(num)}
                  </button>
                ))}
              </div>
            </div>

            {/* زمان کل آزمون با قابلیت فعال/غیرفعال‌سازی */}
            <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                  زمان کل آزمون:
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {isTimerEnabled
                    ? `${toPersianDigits(Math.round(totalQuizDurationSeconds / 60))} دقیقه برای کل سوالات (محاسبه هوشمند)`
                    : 'بدون محدودیت زمانی'}
                </span>
              </div>

              {/* سوییچ تاگل زمان */}
              <button
                type="button"
                onClick={() => setIsTimerEnabled((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isTimerEnabled ? 'bg-teal-600' : 'bg-stone-300 dark:bg-slate-700'
                }`}
                role="switch"
                aria-checked={isTimerEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isTimerEnabled ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* قاری ترتیل با لیست کشویی شیک */}
            <div className="pt-2 border-t border-stone-100 dark:border-slate-800">
              <ReciterSelectorDropdown
                selectedId={selectedReciterId}
                onSelect={(id) => setSelectedReciterId(id)}
                darkMode={darkMode}
                label="قاری ترتیل برای پخش صوتی سوالات:"
              />
            </div>
          </div>

          {/* دکمه شروع آزمون */}
          <button
            type="button"
            onClick={generateQuestions}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {quizScope === 'all_quran'
                ? 'شروع آزمون جامع حفظ کل قرآن کریم'
                : `شروع آزمون حفظ سوره ${activeSurah.nameArabic}`}
            </span>
          </button>
        </div>
      ) : (
        /* تب تاریخچه و پیشرفت آزمون‌ها */
        <div className="space-y-4 animate-fadeIn">
          {/* کارت خلاصه آمار */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 flex items-center justify-around text-center shadow-2xs">
            <div>
              <span className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-400 block">
                {toPersianDigits(quizHistory.length)}
              </span>
              <span className="text-xs text-slate-400">آزمون‌های انجام‌شده</span>
            </div>
            <div className="w-px h-8 bg-stone-200 dark:bg-slate-800" />
            <div>
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 block">
                {toPersianDigits(averageHistoryPercent)}٪
              </span>
              <span className="text-xs text-slate-400">میانگین تسلط</span>
            </div>
          </div>

          {/* لیست تاریخچه */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
              <span>سوابق آزمون‌ها ({toPersianDigits(quizHistory.length)})</span>
              {quizHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>پاک‌سازی تاریخچه</span>
                </button>
              )}
            </div>

            {quizHistory.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-xs text-slate-400">
                هنوز آزمونی ثبت نشده است. با تکمیل اولین آزمون، سوابق و درصد پیشرفت شما در اینجا نمایش داده می‌شود.
              </div>
            ) : (
              quizHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        سوره {item.surahName}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-slate-800 text-slate-500">
                        {item.typeLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{item.date}</span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {toPersianDigits(item.score)} از {toPersianDigits(item.total)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg font-black text-xs ${
                        item.percent >= 80
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : item.percent >= 50
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {toPersianDigits(item.percent)}٪
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* مودال انتخاب سوره زیبا و کامل */}
      <SurahSelectorModal
        isOpen={isSurahPickerOpen}
        onClose={() => setIsSurahPickerOpen(false)}
        surahs={surahs}
        currentSurahId={activeSurah.id}
        onSelectSurah={(surah) => {
          if (onSelectSurah) onSelectSurah(surah);
          setIsSurahPickerOpen(false);
        }}
        darkMode={darkMode}
      />

      {/* کامپوننت آزمون سنجش واقعی با تایمر کل و حالت Review */}
      {isQuizActive && (
        <RealisticQuizView
          questions={generatedQuestions}
          title={`آزمون حفظ سوره ${activeSurah.nameArabic}`}
          totalQuizTimeSeconds={totalQuizDurationSeconds}
          isTimerEnabled={isTimerEnabled}
          onClose={() => setIsQuizActive(false)}
          onRestart={() => {
            generateQuestions();
          }}
          onFinish={handleFinishQuiz}
        />
      )}
    </div>
  );
};
