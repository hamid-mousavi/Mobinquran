import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Sparkles,
  Award,
  Check,
  RotateCcw,
  Volume2,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  BookmarkCheck,
  ChevronRight,
  ChevronLeft,
  Filter,
  Layers,
  ChevronDown,
  Mic,
} from 'lucide-react';
import { Surah, Verse, AppSettings } from '../types';
import { ReciterId, RECITER_NAMES, getAudioSourceUrl } from '../services/audioSources';
import { getArabicFontFamily } from '../utils/fontHelper';
import { toPersianDigits } from '../utils/textNormalization';
import { QuranicCard } from './QuranicOrnament';
import { MemorizationQuizStudio } from './MemorizationQuizStudio';
import { QuranStoriesExplorer } from './QuranStoriesExplorer';
import { VoiceDiscussionStudio } from './VoiceDiscussionStudio';
import { ReciterSelectorDropdown } from './ReciterSelectorDropdown';
import { SurahSelectorModal } from './SurahSelectorModal';
import {
  getMemorizationProgress,
  getSurahMemorizationStats,
  setAyahMemorizationStatus,
  isVerseMemorized,
  MemorizationStatus,
  MemorizationProgress,
} from '../services/memorizationStorage';
import {
  createMemoState,
  buildAyahNumbers,
  advanceAfterAyahEnded,
  shouldMaskAyah,
  shouldMaskTranslation,
  isSessionDone,
  MemoMode,
  MemoRange,
  MemoSession,
} from '../services/memorizationEngine';

interface MemorizationPageProps {
  surahs: Surah[];
  currentSurah: Surah;
  verses: Verse[];
  onSelectSurah: (surah: Surah) => void;
  settings: AppSettings;
  darkMode: boolean;
  onBack: () => void;
}

type MemorizationView = 'menu' | 'practice' | 'quiz' | 'discussion' | 'stories' | 'progress';

const MEMO_RECITERS: { id: ReciterId; name: string }[] = (
  Object.keys(RECITER_NAMES) as ReciterId[]
).map((id) => ({
  id,
  name: RECITER_NAMES[id].name,
}));

const REPEAT_OPTIONS = [1, 2, 3, 5, 10];
const GAP_OPTIONS = [0, 1, 2, 3, 5];

export const MemorizationPage: React.FC<MemorizationPageProps> = ({
  surahs,
  currentSurah,
  verses,
  onSelectSurah,
  settings,
  darkMode,
  onBack,
}) => {
  // مدیریت صفحات داخلی: منوی اصلی، تمرین، آزمون، داستان‌ها و کارنامه
  const [currentView, setCurrentView] = useState<MemorizationView>('menu');

  // داده‌های پیشرفت حفظ
  const [overallProgress, setOverallProgress] = useState<MemorizationProgress>(getMemorizationProgress());
  const [surahStats, setSurahStats] = useState(getSurahMemorizationStats(currentSurah.id, currentSurah.versesCount));

  // تنظیمات جلسه تمرین
  const [practiceMode, setPracticeMode] = useState<MemoMode>('review');
  const [range, setRange] = useState<MemoRange>({ start: 1, end: Math.min(10, verses.length || 7) });
  const [repeats, setRepeats] = useState(3);
  const [gapSec, setGapSec] = useState(2);
  const [reciterId, setReciterId] = useState<ReciterId>('parhizgar');
  const [session, setSession] = useState<MemoSession | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // حالت انتخاب محدوده: بر اساس آیات یا صفحات مصحف
  const [rangeMode, setRangeMode] = useState<'verses' | 'pages'>('verses');
  const [isSurahPickerOpen, setIsSurahPickerOpen] = useState(false);

  // فیلتر صفحه کارنامه
  const [progressFilter, setProgressFilter] = useState<'all' | 'memorized' | 'review_needed' | 'unstarted'>('all');

  // تغییر صفحه بدون باقی ماندن وضعیت مودال انتخاب سوره
  const navigateToView = (view: MemorizationView) => {
    setIsSurahPickerOpen(false);
    setCurrentView(view);
  };

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gapTimerRef = useRef<number | null>(null);

  // به‌روزرسانی آمار هنگام تغییر سوره یا رویداد تغییر حافظه
  const refreshStats = useCallback(() => {
    setOverallProgress(getMemorizationProgress());
    setSurahStats(getSurahMemorizationStats(currentSurah.id, currentSurah.versesCount));
  }, [currentSurah.id, currentSurah.versesCount]);

  useEffect(() => {
    refreshStats();
    setRange({ start: 1, end: Math.min(10, verses.length || 7) });

    const handleUpdate = () => refreshStats();
    window.addEventListener('mobin-memorization-updated', handleUpdate);
    return () => window.removeEventListener('mobin-memorization-updated', handleUpdate);
  }, [currentSurah.id, verses.length, refreshStats]);

  const ayahNumbers = buildAyahNumbers(range, verses.length);

  const currentVerse = session
    ? verses.find((v) => v.verseNumber === session.state.currentAyah)
    : undefined;

  const startSession = () => {
    if (ayahNumbers.length === 0) return;
    const state = createMemoState(practiceMode, range, repeats, gapSec * 1000);
    setSession({ surahId: currentSurah.id, state: { ...state, phase: 'playing' as const }, ayahNumbers });
    setAudioError(false);
  };

  const stopSession = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
    if (gapTimerRef.current) window.clearTimeout(gapTimerRef.current);
    setSession(null);
  }, []);

  // پخش صوت آیه جاری در جلسه تمرین
  useEffect(() => {
    if (!session || isSessionDone(session.state)) return;

    if (session.state.phase === 'playing') {
      const url = getAudioSourceUrl(reciterId, currentSurah.id, session.state.currentAyah, 0);
      if (url && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current
          .play()
          .then(() => {
            setIsAudioPlaying(true);
            setAudioError(false);
          })
          .catch(() => {
            setIsAudioPlaying(false);
            setAudioError(true);
          });
      } else {
        setAudioError(true);
      }
    }
  }, [session, reciterId, currentSurah.id]);

  const handleAudioEnded = () => {
    if (!session) return;
    setIsAudioPlaying(false);

    if (session.state.mode === 'test') {
      setSession((prev) => (prev ? { ...prev, state: { ...prev.state, phase: 'reveal' } } : prev));
      return;
    }

    const next = advanceAfterAyahEnded(session.state, session.ayahNumbers);
    if (isSessionDone(next)) {
      setSession((prev) => (prev ? { ...prev, state: next } : prev));
      return;
    }

    const delay = session.state.gapMs;
    gapTimerRef.current = window.setTimeout(() => {
      setSession((prev) => (prev ? { ...prev, state: { ...next, phase: 'playing' } } : prev));
    }, delay);
  };

  const handleToggleAyahStatus = (verseNumber: number, nextStatus: MemorizationStatus) => {
    setAyahMemorizationStatus(currentSurah.id, verseNumber, nextStatus);
    refreshStats();
  };

  const arabicFontFamily = getArabicFontFamily(settings.arabicFont);

  // فیلتر کردن آیات در بخش کارنامه
  const filteredVerses = useMemo(() => {
    if (progressFilter === 'all') return verses;
    return verses.filter((verse) => {
      const isMemorized = isVerseMemorized(currentSurah.id, verse.verseNumber);
      if (progressFilter === 'memorized') return isMemorized;
      if (progressFilter === 'unstarted') return !isMemorized;
      return true;
    });
  }, [verses, currentSurah.id, progressFilter]);

  // -------------------------------------------------------------
  // ۱. صفحه منوی اصلی حفظ قرآن (صفحه خلوت، منوهای بزرگ و نمودار پایین صفحه)
  // -------------------------------------------------------------
  if (currentView === 'menu') {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-6" dir="rtl">
        {/* سربرگ اصلی صفحه حفظ - بهینه‌سازی شده برای موبایل */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
              title="بازگشت"
              aria-label="بازگشت"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              حفظ قرآن کریم
            </h1>
          </div>

          {/* دکمه انتخاب سوره با استایل کشویی شیک */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSurahPickerOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 shadow-2xs hover:border-teal-500 transition-all cursor-pointer active:scale-95"
            >
              <span>سوره {currentSurah.nameArabic}</span>
              <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            </button>
          </div>
        </div>

        {/* منوهای اصلی حفظ قرآن - بهینه‌سازی شده و جمع‌وجور برای موبایل */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* کارت ۱: تمرین و خط‌بر حفظ */}
          <div
            onClick={() => navigateToView('practice')}
            className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-white to-white dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-teal-500 transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform shrink-0">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  تمرین و خط‌بر حفظ
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  تکرار، پنهان‌سازی کلمات و ترتیل
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 group-hover:-translate-x-1 transition-transform" />
          </div>

          {/* کارت ۲: آزمون‌ساز تخصصی */}
          <div
            onClick={() => navigateToView('quiz')}
            className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-amber-500 transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  آزمون‌ساز تخصصی
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  سنجش اکمال، کلمات مخفی و مفاهیم
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 group-hover:-translate-x-1 transition-transform" />
          </div>

          {/* کارت ۳: مباحثه صوتی هوشمند */}
          <div
            onClick={() => navigateToView('discussion')}
            className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-white to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0">
                <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    مباحثه صوتی هوشمند
                  </h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                    جدید
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  هم‌مباحثه صوتی آیه به آیه، اکمال و مسابقه
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:-translate-x-1 transition-transform" />
          </div>

          {/* کارت ۴: داستان‌ها و حکمت‌های قرآنی */}
          <div
            onClick={() => navigateToView('stories')}
            className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-white to-white dark:from-purple-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-purple-500 transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 group-hover:scale-105 transition-transform shrink-0">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  داستان‌ها و حکمت‌ها
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  سرگذشت و آیات محوری پیامبران
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 group-hover:-translate-x-1 transition-transform" />
          </div>

          {/* کارت ۵: کارنامه و پایش وضعیت آیات */}
          <div
            onClick={() => navigateToView('progress')}
            className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-white to-white dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-sky-500 transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform shrink-0">
                <Award className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  کارنامه و وضعیت آیات
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  ثبت و پایش وضعیت تک‌تک آیات
                </p>
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* پایین صفحه: نمودار و آمار پیشرفت حفظ جامع و زیبا */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                نمودار و شاخص‌های پیشرفت حفظ
              </h3>
            </div>
            <span className="text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full">
              آمار زنده
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* بخش کل قرآن */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  پیشرفت حفظ کل قرآن مجید
                </span>
                <span className="font-black text-teal-700 dark:text-teal-300 text-base">
                  {toPersianDigits(overallProgress.percentage)}٪
                </span>
              </div>

              <div className="w-full bg-stone-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{toPersianDigits(overallProgress.totalMemorized)} آیه حفظ‌شده</span>
                <span>از {toPersianDigits(overallProgress.totalVerses || 6236)} آیه کل مصحف</span>
              </div>
            </div>

            {/* بخش سوره فعال */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  پیشرفت در سوره {currentSurah.nameArabic}
                </span>
                <span className="font-black text-amber-600 dark:text-amber-400 text-base">
                  {toPersianDigits(surahStats.percentage)}٪
                </span>
              </div>

              <div className="w-full bg-stone-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${surahStats.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400">
                <span>{toPersianDigits(surahStats.memorizedCount)} آیه حفظ‌شده</span>
                <span>{toPersianDigits(Math.max(0, currentSurah.versesCount - surahStats.memorizedCount))} آیه باقی‌مانده</span>
              </div>
            </div>
          </div>
        </div>

        {/* مودال انتخاب سوره در منوی اصلی */}
        <SurahSelectorModal
          isOpen={isSurahPickerOpen}
          onClose={() => setIsSurahPickerOpen(false)}
          surahs={surahs}
          currentSurahId={currentSurah.id}
          onSelectSurah={(surah) => {
            stopSession();
            onSelectSurah(surah);
            setIsSurahPickerOpen(false);
          }}
          darkMode={darkMode}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // ۲. صفحه اختصاصی آزمون‌ساز (آزمون واقعی شبیه Quiz با بازخورد صوتی و گذار خودکار)
  // -------------------------------------------------------------
  if (currentView === 'quiz') {
    return (
      <div className="max-w-4xl mx-auto px-2 sm:px-6 py-4 sm:py-5 pb-28 space-y-6 w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
        <MemorizationQuizStudio
          currentSurah={currentSurah}
          surahs={surahs}
          verses={verses}
          darkMode={darkMode}
          onSelectSurah={onSelectSurah}
          onBack={() => navigateToView('menu')}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // ۳. صفحه اختصاصی مباحثه صوتی هوشمند (هم‌مباحثه حفظ)
  // -------------------------------------------------------------
  if (currentView === 'discussion') {
    return (
      <div className="max-w-4xl mx-auto px-2 sm:px-6 py-4 sm:py-5 pb-28 space-y-6 w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
        <VoiceDiscussionStudio
          currentSurah={currentSurah}
          surahs={surahs}
          verses={verses}
          darkMode={darkMode}
          onSelectSurah={onSelectSurah}
          onBack={() => navigateToView('menu')}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // ۴. صفحه اختصاصی داستان‌ها و حکمت‌های قرآنی
  // -------------------------------------------------------------
  if (currentView === 'stories') {
    return (
      <div className="max-w-4xl mx-auto px-2 sm:px-6 py-4 sm:py-5 pb-28 space-y-6 w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateToView('menu')}
              className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
              title="بازگشت به منوی حفظ"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              گنجینه داستان‌ها و حکمت‌های قرآنی
            </h2>
          </div>
        </div>

        <QuranStoriesExplorer
          darkMode={darkMode}
          onNavigateToSurah={(sId) => {
            const target = surahs.find((s) => s.id === sId);
            if (target) onSelectSurah(target);
          }}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // ۵. صفحه اختصاصی کارنامه و وضعیت آیات سوره
  // -------------------------------------------------------------
  if (currentView === 'progress') {
    return (
      <div className="max-w-4xl mx-auto px-2 sm:px-6 py-4 sm:py-5 pb-28 space-y-5 w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
        {/* سربرگ کارنامه */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateToView('menu')}
              className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
              title="بازگشت به منوی حفظ"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                کارنامه و وضعیت آیات سوره {currentSurah.nameArabic}
              </h2>
              <p className="text-xs text-slate-400">
                {toPersianDigits(surahStats.memorizedCount)} آیه از {toPersianDigits(currentSurah.versesCount)} آیه حفظ شده است ({toPersianDigits(surahStats.percentage)}٪)
              </p>
            </div>
          </div>

          {/* فیلترها */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setProgressFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                progressFilter === 'all'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              همه ({toPersianDigits(verses.length)})
            </button>
            <button
              onClick={() => setProgressFilter('memorized')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                progressFilter === 'memorized'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              حفظ‌شده ({toPersianDigits(surahStats.memorizedCount)})
            </button>
            <button
              onClick={() => setProgressFilter('unstarted')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                progressFilter === 'unstarted'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              باقی‌مانده ({toPersianDigits(Math.max(0, currentSurah.versesCount - surahStats.memorizedCount))})
            </button>
          </div>
        </div>

        {/* لیست آیات */}
        <div className="space-y-3">
          {filteredVerses.map((verse) => {
            const isMemorized = isVerseMemorized(currentSurah.id, verse.verseNumber);

            return (
              <div
                key={verse.id}
                className={`p-4 rounded-3xl border transition-all flex items-start justify-between gap-4 ${
                  isMemorized
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-stone-200'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <span className="w-9 h-9 rounded-2xl bg-stone-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {toPersianDigits(verse.verseNumber)}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed"
                      style={{ fontFamily: arabicFontFamily }}
                      dir="rtl"
                    >
                      {verse.textArabic}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                      {verse.translationMakarem || verse.translationFooladvand}
                    </div>
                  </div>
                </div>

                {/* دکمه وضعیت حفظ */}
                <button
                  onClick={() =>
                    handleToggleAyahStatus(
                      verse.verseNumber,
                      isMemorized ? 'unstarted' : 'memorized'
                    )
                  }
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 ${
                    isMemorized
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  title={isMemorized ? 'علامت‌گذاری به عنوان خوانده‌نشده' : 'ثبت به عنوان حفظ کامل'}
                >
                  <Check className="w-4 h-4" />
                  <span>{isMemorized ? 'حفظ‌شده' : 'حفظ'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ۶. صفحه اختصاصی تمرین و خط‌بر حفظ
  // -------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-6 py-4 sm:py-5 pb-28 space-y-6 w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
      {/* المان صوتی */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={() => {
          setIsAudioPlaying(false);
          setAudioError(true);
        }}
        preload="auto"
      />

      {/* سربرگ تمرین حفظ */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (session) stopSession();
              navigateToView('menu');
            }}
            className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
            title="بازگشت به منوی حفظ"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              جلسه تمرین و خط‌بر حفظ
            </h2>
            <p className="text-xs text-slate-400">
              سوره {currentSurah.nameArabic} ({toPersianDigits(currentSurah.versesCount)} آیه)
            </p>
          </div>
        </div>

        {session ? (
          <button
            onClick={stopSession}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 font-bold text-xs hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            خروج از جلسه
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsSurahPickerOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 shadow-2xs hover:border-teal-500 transition-all cursor-pointer active:scale-95"
          >
            <span>سوره {currentSurah.nameArabic}</span>
            <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          </button>
        )}
      </div>

      {!session ? (
        /* فرم تنظیمات تمرین (ساده، خلوت و خوانا) */
        <QuranicCard darkMode={darkMode} className="p-5 sm:p-7 space-y-6">
          <div className="border-b border-stone-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
              تنظیمات جلسه تمرین
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              شیوه تمرین، محدوده آیات و قاری ترتیل را برگزینید.
            </p>
          </div>

          {/* شیوه تمرین */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              شیوه تمرین حفظ:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPracticeMode('review')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                  practiceMode === 'review'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-950 dark:text-teal-100 ring-2 ring-teal-500/30 shadow-xs'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-bold text-sm text-teal-700 dark:text-teal-300">
                  مرور تدریجی (پنهان‌سازی کلمات)
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  در تکرار اول متن کامل است و در تکرارهای بعدی کلمات پنهان می‌شوند تا ملکه ذهن شوند.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPracticeMode('test')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                  practiceMode === 'test'
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-950 dark:text-teal-100 ring-2 ring-teal-500/30 shadow-xs'
                    : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="font-bold text-sm text-teal-700 dark:text-teal-300">
                  خودآزمایی و سنجش
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  صوت آیه بدون متن پخش می‌شود؛ سپس متن آشکار می‌شود تا توانایی خود را بسنجید.
                </p>
              </button>
            </div>
          </div>

          {/* قاری ترتیل با لیست کشویی شیک */}
          <div className="space-y-1">
            <ReciterSelectorDropdown
              selectedId={reciterId}
              onSelect={(id) => setReciterId(id)}
              darkMode={darkMode}
              label="قاری ترتیل آموزشی:"
            />
          </div>

          {/* محدوده و تکرار */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* محدوده آیات */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-800 space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                محدوده تمرین سوره {currentSurah.nameArabic}:
              </label>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-[11px] text-slate-400 block mb-1">از آیه</span>
                  <input
                    type="number"
                    min={1}
                    max={verses.length || currentSurah.versesCount}
                    value={range.start}
                    onChange={(e) =>
                      setRange((r) => ({ ...r, start: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[11px] text-slate-400 block mb-1">تا آیه</span>
                  <input
                    type="number"
                    min={1}
                    max={verses.length || currentSurah.versesCount}
                    value={range.end}
                    onChange={(e) =>
                      setRange((r) => ({ ...r, end: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="text-xs text-teal-700 dark:text-teal-400 font-bold">
                تعداد آیات منتخب: {toPersianDigits(ayahNumbers.length)} آیه
              </div>
            </div>

            {/* تکرار و مکث */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  تعداد تکرار هر آیه:
                </label>
                <div className="flex items-center gap-1.5">
                  {REPEAT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRepeats(n)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        repeats === n
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-700'
                      }`}
                    >
                      {toPersianDigits(n)} بار
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  مکث بین تکرارها:
                </label>
                <div className="flex items-center gap-1.5">
                  {GAP_OPTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setGapSec(sec)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        gapSec === sec
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-700'
                      }`}
                    >
                      {toPersianDigits(sec)} ثانیه
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* دکمه شروع تمرین */}
          <button
            onClick={startSession}
            disabled={ayahNumbers.length === 0}
            className="w-full py-4 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-md"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>شروع جلسه تمرین ({toPersianDigits(ayahNumbers.length)} آیه)</span>
          </button>
        </QuranicCard>
      ) : (
        /* صحنه فعال جلسه تمرین */
        <div className="space-y-4 animate-fadeIn">
          {/* نوار وضعیت جلسه */}
          <div className="p-4 rounded-3xl bg-teal-600 text-white shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-bold text-sm sm:text-base">
                آیه {toPersianDigits(session.state.currentAyah)} از {toPersianDigits(range.end)}
              </div>
              <span className="text-xs opacity-90">
                (تکرار {toPersianDigits(session.state.repetition)} از {toPersianDigits(session.state.repeats)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isAudioPlaying && (
                <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-3 py-1 rounded-xl">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  در حال تلاوت
                </span>
              )}
              <button
                onClick={stopSession}
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition-all cursor-pointer"
              >
                پایان جلسه
              </button>
            </div>
          </div>

          {/* کارت نمایش آیه جاری */}
          <QuranicCard darkMode={darkMode} className="p-6 sm:p-10 text-center space-y-5">
            {currentVerse ? (
              <>
                <div className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">
                  سوره {currentSurah.nameArabic} • آیه {toPersianDigits(currentVerse.verseNumber)}
                </div>

                {/* متن عربی با قابلیت ماسک / پنهان‌سازی */}
                <div
                  className={`text-2xl sm:text-4xl font-medium leading-[2.5] py-4 transition-all ${
                    shouldMaskAyah(session.state)
                      ? 'opacity-20 blur-sm select-none'
                      : darkMode
                      ? 'text-slate-100'
                      : 'text-slate-900'
                  }`}
                  style={{ fontFamily: arabicFontFamily }}
                  dir="rtl"
                >
                  {currentVerse.textArabic}
                </div>

                {/* ترجمه آیه */}
                <div
                  className={`text-sm sm:text-base text-slate-500 leading-relaxed max-w-xl mx-auto transition-all ${
                    shouldMaskTranslation(session.state) ? 'opacity-0 select-none' : 'opacity-100'
                  }`}
                >
                  {currentVerse.translationMakarem || currentVerse.translationFooladvand}
                </div>

                {/* دکمه‌های ثبت وضعیت پس از خودآزمایی */}
                {session.state.mode === 'test' && session.state.phase === 'reveal' && (
                  <div className="pt-4 border-t border-stone-200 dark:border-slate-800 flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        handleToggleAyahStatus(currentVerse.verseNumber, 'memorized');
                        handleAudioEnded();
                      }}
                      className="px-4 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ کامل بودم</span>
                    </button>
                    <button
                      onClick={() => {
                        handleToggleAyahStatus(currentVerse.verseNumber, 'review_needed');
                        handleAudioEnded();
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>نیاز به مرور دارم</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12">
                <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                  جلسه تمرین به پایان رسید!
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  آیات {toPersianDigits(range.start)} تا {toPersianDigits(range.end)} سوره {currentSurah.nameArabic} با موفقیت مرور شد.
                </p>
                <button
                  onClick={startSession}
                  className="mt-4 px-5 py-2.5 rounded-2xl bg-teal-600 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-4 h-4" />
                  تکرار مجدد جلسه
                </button>
              </div>
            )}
          </QuranicCard>
        </div>
      )}

      {/* مودال انتخاب سوره زیبا و کامل */}
      <SurahSelectorModal
        isOpen={isSurahPickerOpen}
        onClose={() => setIsSurahPickerOpen(false)}
        surahs={surahs}
        currentSurahId={currentSurah.id}
        onSelectSurah={(surah) => {
          stopSession();
          onSelectSurah(surah);
          setIsSurahPickerOpen(false);
        }}
        darkMode={darkMode}
      />
    </div>
  );
};
