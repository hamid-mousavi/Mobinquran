import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BookOpen,
  FileText,
  Search,
  Sparkles,
  Bookmark,
  Calendar,
  Headphones,
  GraduationCap,
  Play,
  ChevronLeft,
  Settings,
  Moon,
  Sun,
  RefreshCw,
  Sparkle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Layers,
  Info,
  Trophy,
  X,
  ChevronRight,
} from 'lucide-react';
import { Surah, Verse, KhatmPlan, KhatmType } from '../types';
import { AyahEndMarker } from './QuranReader';
import { QuranLogo, QuranicCard } from './QuranicOrnament';
import { toPersianDigits } from '../utils/textNormalization';
import { getMemorizationStats, MemorizationStats } from '../services/memorizationStorage';
import { QuranService } from '../services/quranService';
import { buildKhatmSegments, KhatmSegment } from '../utils/khatmMath';
import { currentKhatmDay, localDateKey } from '../utils/date';
import { QURAN_STORIES, QuranStory } from '../data/quranStories';
import { FullscreenShortsQuiz, ShortsQuestion } from './FullscreenShortsQuiz';

interface QuranHomePageProps {
  surahs: Surah[];
  lastRead: { surahId: number; verseNumber: number; pageNumber?: number } | null;
  onContinueReading: () => void;
  onSelectSurah: (surah: Surah) => void;
  onNavigateToVerse: (surahId: number, verseNumber: number) => void;
  onNavigateToJuz: (juzNumber: number) => void;
  onNavigateToMushafPage: (pageNumber: number) => void;
  onOpenSurahSelector: () => void;
  onOpenMushafPage: () => void;
  onOpenSearch: (initialQuery?: string) => void;
  onOpenBookmarks: () => void;
  onOpenKhatm: () => void;
  onOpenAI: (verse?: Verse) => void;
  onOpenMemorization: () => void;
  onOpenOfflineDownloads: () => void;
  onOpenSettings: () => void;
  onOpenAbout?: () => void;
  onToggleDarkMode: () => void;
  onPlayVerseAudio: (surahId: number, verseNumber: number) => void;
  darkMode: boolean;
}

const POOL_OF_VERSES = [
  {
    surahId: 2,
    surahNameArabic: 'البَقَرَة',
    verseNumber: 255,
    textArabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ',
    translationPersian: 'هیچ معبودی جز خداوندِ یگانه زنده و پاینده نیست؛ نه چرت و خوابی او را فرا می‌گیرد، و هر آنچه در آسمان‌ها و زمین است از آنِ اوست.',
    theme: 'توحید و عظمت الهی (آیة الکرسی)',
  },
  {
    surahId: 24,
    surahNameArabic: 'النُّور',
    verseNumber: 35,
    textArabic: 'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ ۚ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ ۖ الْمِصْبَاحُ فِي زُجَاجَةٍ',
    translationPersian: 'خداوند نور آسمان‌ها و زمین است؛ مَثَل نور او چون چراغدانی است که در آن چراغی پرفروغ باشد...',
    theme: 'آیه نور و فیض معرفت',
  },
  {
    surahId: 94,
    surahNameArabic: 'الشَّرْح',
    verseNumber: 6,
    textArabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ فَإِذَا فَرَغْتَ فَانصَبْ',
    translationPersian: 'مسلّماً با هر دشواری و سختی، گشایش و آسانی است؛ پس هرگاه از کاری فراغت یافتی، به عبادت و کار مهم‌تر بکوش.',
    theme: 'امید و گشایش الهی',
  },
  {
    surahId: 13,
    surahNameArabic: 'الرَّعْد',
    verseNumber: 28,
    textArabic: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    translationPersian: 'همان کسانی که ایمان آورده‌اند و دل‌هایشان با یاد خدا آرام می‌گیرد؛ آگاه باشید که با یاد خدا دل‌ها آرامش می‌یابد.',
    theme: 'آرامش دل با یاد پروردگار',
  },
  {
    surahId: 65,
    surahNameArabic: 'الطَّلَاق',
    verseNumber: 3,
    textArabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ۚ إِنَّ اللَّهَ بَالِغُ أَمْرِهِ',
    translationPersian: 'و هر کس بر خداوند توکل کند، او برایش کافی است؛ بی‌تردید خداوند فرمان و کار خویش را به سرانجام می‌رساند.',
    theme: 'توکل و کفایت پروردگار',
  },
  {
    surahId: 2,
    surahNameArabic: 'البَقَرَة',
    verseNumber: 186,
    textArabic: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ',
    translationPersian: 'و هنگامی که بندگانم از تو درباره من بپرسند، بی‌تردید من نزدیکم؛ دعای دعا کننده را هنگامی که مرا می‌خواند، پاسخ می‌دهم.',
    theme: 'نزدیکی پروردگار و اجابت دعا',
  },
  {
    surahId: 39,
    surahNameArabic: 'الزُّمَر',
    verseNumber: 53,
    textArabic: 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا',
    translationPersian: 'بگو: ای بندگان من که بر خویشتن زیاده‌روی روا داشته‌اید! از رحمت خدا نومید نشوید؛ همانا خدا همه گناهان را می‌آمرزد.',
    theme: 'رحمت بی‌کران و امید به مغفرت',
  },
  {
    surahId: 55,
    surahNameArabic: 'الرَّحْمَٰن',
    verseNumber: 60,
    textArabic: 'هَلْ جَزَاءُ الْإِحْسَانِ إِلَّا الْإِحْسَانُ',
    translationPersian: 'آیا پاداش نیکی جز نیکی است؟',
    theme: 'قاعده احسان و پاداش نیکوکاران',
  },
];

export const QuranHomePage: React.FC<QuranHomePageProps> = ({
  surahs,
  lastRead,
  onContinueReading,
  onSelectSurah,
  onNavigateToVerse,
  onNavigateToJuz,
  onNavigateToMushafPage,
  onOpenSurahSelector,
  onOpenMushafPage,
  onOpenSearch,
  onOpenBookmarks,
  onOpenKhatm,
  onOpenAI,
  onOpenMemorization,
  onOpenOfflineDownloads,
  onOpenSettings,
  onOpenAbout,
  onToggleDarkMode,
  onPlayVerseAudio,
  darkMode,
}) => {
  const [memoStats, setMemoStats] = useState<MemorizationStats>(getMemorizationStats);
  const [khatmPlan, setKhatmPlan] = useState<KhatmPlan | null>(null);
  const [khatmSegments, setKhatmSegments] = useState<KhatmSegment[]>([]);
  const [activeFocusTab, setActiveFocusTab] = useState<'verse' | 'khatm' | 'memorization'>('verse');
  const [storyShuffleOffset, setStoryShuffleOffset] = useState(0);
  const [isStoryShortsOpen, setIsStoryShortsOpen] = useState(false);
  const [storyQuizQuestions, setStoryQuizQuestions] = useState<ShortsQuestion[]>([]);
  const [storyQuizTitle, setStoryQuizTitle] = useState('آزمون داستان روز قرآنی');
  const [selectedStoryModal, setSelectedStoryModal] = useState<QuranStory | null>(null);

  // داستان منتخب روز بر اساس روز سال
  const todayStory = useMemo<QuranStory>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const idx = Math.abs(dayOfYear + storyShuffleOffset) % QURAN_STORIES.length;
    return QURAN_STORIES[idx] || QURAN_STORIES[0];
  }, [storyShuffleOffset]);

  const handleStartTodayStoryQuiz = () => {
    const formatted: ShortsQuestion[] = todayStory.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      contextText: q.contextAyah,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      surahName: q.surahName,
      verseNumber: q.verseNumber,
      categoryBadge: `داستان ${todayStory.title}`,
    }));
    setStoryQuizQuestions(formatted);
    setStoryQuizTitle(`مسابقه داستان ${todayStory.title}`);
    setIsStoryShortsOpen(true);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const loadKhatmData = useCallback(async () => {
    try {
      const [starts, savedPlan] = await Promise.all([
        QuranService.getMushafStarts(),
        QuranService.getKhatmPlan(),
      ]);
      const target: KhatmPlan = savedPlan ?? {
        id: 'ramadan_30_default',
        title: 'ختم ۳۰ روزه قرآن کریم (جزء به جزء)',
        type: 'ramadan_30' as KhatmType,
        startDate: localDateKey(),
        targetDays: 30,
        totalPages: 604,
        completedPages: [],
        currentDay: 1,
        isActive: true,
      };
      setKhatmPlan(target);
      const result = buildKhatmSegments(
        target.type || 'custom',
        target.targetDays,
        starts.juzStartPages,
        starts.quarterStartPages
      );
      setKhatmSegments(result.segments);
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    loadKhatmData();
    window.addEventListener('mobin-khatm-updated', loadKhatmData);
    return () => window.removeEventListener('mobin-khatm-updated', loadKhatmData);
  }, [loadKhatmData]);

  const [randomVerseIndex, setRandomVerseIndex] = useState<number>(() =>
    Math.floor(Math.random() * POOL_OF_VERSES.length)
  );
  const selectedRandomVerse = POOL_OF_VERSES[randomVerseIndex] || POOL_OF_VERSES[0];

  const handleShuffleVerse = () => {
    setRandomVerseIndex((prev) => {
      let next = Math.floor(Math.random() * POOL_OF_VERSES.length);
      if (next === prev) next = (next + 1) % POOL_OF_VERSES.length;
      return next;
    });
  };

  useEffect(() => {
    const handleUpdate = () => {
      setMemoStats(getMemorizationStats());
    };
    window.addEventListener('mobin-memorization-updated', handleUpdate);
    return () => window.removeEventListener('mobin-memorization-updated', handleUpdate);
  }, []);

  // بارگذاری متن و ترجمه آیه آخرین موقعیت قرائت
  const [lastReadVerse, setLastReadVerse] = useState<Verse | null>(null);
  useEffect(() => {
    let isMounted = true;
    const fetchLastReadVerse = async () => {
      const sId = lastRead?.surahId || 1;
      const vNum = lastRead?.verseNumber || 1;
      try {
        const verses = await QuranService.getSurahVerses(sId);
        if (isMounted && verses && verses.length > 0) {
          const match = verses.find((v) => v.verseNumber === vNum) || verses[0];
          setLastReadVerse(match);
        }
      } catch (e) {
        // خطا در دریافت آیه
      }
    };
    fetchLastReadVerse();
    return () => {
      isMounted = false;
    };
  }, [lastRead?.surahId, lastRead?.verseNumber]);

  // بارگذاری آخرین جستجوهای کاربر
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    const loadSearches = () => {
      try {
        const stored = localStorage.getItem('mobin_recent_searches');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed.slice(0, 8));
            return;
          }
        }
      } catch (e) {
        // ignore
      }
      setRecentSearches([]);
    };
    loadSearches();
    window.addEventListener('mobin-searches-updated', loadSearches);
    return () => window.removeEventListener('mobin-searches-updated', loadSearches);
  }, []);

  const lastReadSurah = useMemo(() => {
    if (!lastRead) return surahs[0];
    return surahs.find((s) => s.id === lastRead.surahId) || surahs[0];
  }, [lastRead, surahs]);

  const khatmTargetDays = khatmPlan?.targetDays || 30;
  const khatmTotalPages = khatmPlan?.totalPages || 604;
  const khatmDerivedDay = khatmPlan ? currentKhatmDay(khatmPlan.startDate, khatmTargetDays) : 1;
  const khatmCurrentDay = Math.min(khatmDerivedDay, Math.max(1, khatmSegments.length || khatmTargetDays));
  const khatmTodaySegment: KhatmSegment | null = khatmSegments[khatmCurrentDay - 1] || null;
  const khatmCompletedCount = khatmPlan?.completedPages.length || 0;
  const khatmProgressPercent = Math.min(100, Math.round((khatmCompletedCount / khatmTotalPages) * 100));

  const isKhatmTodayCompleted =
    !!khatmTodaySegment &&
    (() => {
      const pages = khatmPlan?.completedPages || [];
      for (let p = khatmTodaySegment.startPage; p <= khatmTodaySegment.endPage; p++) {
        if (!pages.includes(p)) return false;
      }
      return true;
    })();

  const handleMarkTodayKhatmCompleted = async () => {
    if (!khatmTodaySegment || !khatmPlan) return;
    const newPages = new Set(khatmPlan.completedPages);
    for (let p = khatmTodaySegment.startPage; p <= khatmTodaySegment.endPage; p++) {
      newPages.add(p);
    }
    const updatedPlan: KhatmPlan = {
      ...khatmPlan,
      completedPages: Array.from(newPages).sort((a, b) => a - b),
      lastReadDate: localDateKey(),
    };
    await QuranService.saveKhatmPlan(updatedPlan);
    setKhatmPlan(updatedPlan);
    window.dispatchEvent(new CustomEvent('mobin-khatm-updated'));
  };

  return (
    <main
      id="quran-home-page"
      className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-4 sm:space-y-5 animate-fadeIn select-none"
      dir="rtl"
    >
      {/* سربرگ تمیز بالای صفحه اصلی */}
      <header
        id="home-top-header"
        className="flex items-center justify-between gap-3 pb-3 border-b border-stone-200/80 dark:border-slate-800/80"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenSettings}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-xs"
            title="تنظیمات قلم و ترجمه"
            aria-label="تنظیمات"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400" />
          </button>

          <button
            onClick={onToggleDarkMode}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-xs"
            title={darkMode ? 'حالت روز' : 'حالت شب'}
            aria-label="تغییر تم"
          >
            {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>

        {/* وسط: لوگوی قرآن مبین */}
        <div className="flex items-center justify-center min-w-0">
          <QuranLogo size="md" darkMode={darkMode} />
        </div>

        {/* سمت چپ: نشان‌شده‌ها */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenBookmarks}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-xs"
            title="نشان‌شده‌ها و یادداشت‌ها"
            aria-label="نشان‌شده‌ها"
          >
            <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
          </button>
        </div>
      </header>

      {/* نوار جستجوی اختصاصی و فوق‌العاده شکیل */}
      <section id="home-search-bar" className="space-y-2.5">
        <div
          onClick={() => onOpenSearch()}
          className="group relative flex items-center justify-between rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 sm:p-3.5 shadow-sm hover:border-teal-500/80 hover:shadow-md hover:shadow-teal-600/10 transition-all cursor-pointer backdrop-blur-md"
        >
          <div className="flex items-center gap-3 text-slate-400 dark:text-slate-400 min-w-0 flex-1 px-1">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
              <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 truncate">
              جستجو در متن آیات، ترجمه‌ها، سوره‌ها و موضوعات قرآن…
            </span>
          </div>

          <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-slate-800/80 border border-stone-200/60 dark:border-slate-700/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            <span>جستجو</span>
            <Search className="w-3 h-3 text-teal-600 dark:text-teal-400" />
          </div>
        </div>

        {/* لیست افقی آخرین جستجوها */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none no-scrollbar">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0 pl-1">
            <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span>آخرین جستجوها:</span>
          </div>

          {Array.from(new Set([...recentSearches, 'آیة الکرسی', 'سوره یس', 'سوره واقعه', 'سوره ملک', 'صبر و آرامش', 'نور و هدایت', 'توکل'])).slice(0, 10).map((term) => (
            <button
              key={term}
              onClick={() => onOpenSearch(term)}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 text-[11px] font-medium transition-all shrink-0 active:scale-95 shadow-2xs"
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      {/* کارت یکپارچه «آخرین موقعیت قرائت» (هدر: نام سوره، بدنه: آیه و ترجمه، ادامه با کلیک روی کارت بدون دکمه پایین) */}
      <div
        id="home-last-read-card"
        onClick={onContinueReading}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onContinueReading();
          }
        }}
        className="group relative rounded-2xl p-4 sm:p-5 border border-teal-600/30 dark:border-teal-500/25 bg-gradient-to-br from-white via-white to-stone-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/90 shadow-sm hover:border-teal-500 hover:shadow-md hover:shadow-teal-600/10 transition-all cursor-pointer space-y-3 overflow-hidden active:scale-[0.99]"
      >
        {/* هدر کارت: نام سوره و مشخصات آیه */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                آخرین موقعیت قرائت
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                سوره {lastReadSurah.nameArabic} ({lastReadSurah.namePersian})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold">
              آیه {toPersianDigits(lastRead ? lastRead.verseNumber : 1)}
            </span>
            <div className="w-6 h-6 rounded-full bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center transition-transform group-hover:-translate-x-1">
              <ChevronLeft className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* بدنه کارت: متن آیه و ترجمه (محدود با line-clamp جهت آیات طولانی با فونت بزرگ، خوانا و باوقار) */}
        <div className="space-y-2 text-right">
          <p
            className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-50 leading-loose line-clamp-2"
            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
            dir="rtl"
          >
            {lastReadVerse ? lastReadVerse.textArabic : 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'}
          </p>
          <p className="text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
            {lastReadVerse?.translationMakarem || lastReadVerse?.translationAnsarian || lastReadVerse?.translationFooladvand || 'برای ادامه قرائت از این آیه، روی این کارت کلیک کنید.'}
          </p>
        </div>
      </div>

      {/* بخش تب‌های روزانه: آیه روز / ختم قرآن / حفظ قرآن */}
      <div className="rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
        {/* هدر دسته‌بندی با طراحی مینیمال */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveFocusTab('verse')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFocusTab === 'verse'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              آیهٔ منتخب امروز
            </button>

            <button
              onClick={() => setActiveFocusTab('khatm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeFocusTab === 'khatm'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>برنامه ختم</span>
              {khatmProgressPercent > 0 && (
                <span className="text-[10px] opacity-90 font-mono font-normal">
                  ({toPersianDigits(khatmProgressPercent)}٪)
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveFocusTab('memorization')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFocusTab === 'memorization'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              پیشرفت حفظ
            </button>
          </div>

          {activeFocusTab === 'verse' && (
            <button
              onClick={handleShuffleVerse}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title="آیه تصادفی دیگر"
              aria-label="تغییر آیه تصادفی"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {activeFocusTab === 'khatm' && (
            <button
              onClick={onOpenKhatm}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-bold"
            >
              <span>تنظیمات ختم</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {activeFocusTab === 'memorization' && (
            <button
              onClick={onOpenMemorization}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-bold"
            >
              <span>بخش حفظ</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* محتوای تب ۱: آیه منتخب روز */}
        {activeFocusTab === 'verse' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <span className="font-bold text-teal-700 dark:text-teal-400">
                {selectedRandomVerse.theme}
              </span>
              <span className="font-medium">
                سوره {selectedRandomVerse.surahNameArabic} : آیه {toPersianDigits(selectedRandomVerse.verseNumber)}
              </span>
            </div>

            <p
              className="text-right text-2xl sm:text-3xl md:text-4xl font-normal leading-loose text-slate-900 dark:text-slate-50 my-3"
              style={{ fontFamily: "'Amiri', 'Amiri Quran', serif" }}
              dir="rtl"
            >
              {selectedRandomVerse.textArabic}
              <AyahEndMarker verseNumber={selectedRandomVerse.verseNumber} />
            </p>

            <p className="text-sm sm:text-base md:text-lg text-slate-700 dark:text-slate-200 leading-relaxed text-right font-medium" dir="rtl">
              «{selectedRandomVerse.translationPersian}»
            </p>

            <div className="pt-2 flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 border-t border-stone-100 dark:border-slate-800">
              <button
                onClick={() => onPlayVerseAudio(selectedRandomVerse.surahId, selectedRandomVerse.verseNumber)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current text-teal-600 dark:text-teal-400" />
                <span>استماع ترتیل</span>
              </button>

              <button
                onClick={() => onNavigateToVerse(selectedRandomVerse.surahId, selectedRandomVerse.verseNumber)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>مشاهده آیه در سوره</span>
              </button>
            </div>
          </div>
        )}

        {/* محتوای تب ۲: برنامه ختم قرآن */}
        {activeFocusTab === 'khatm' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-teal-500" />
                <span>
                  {toPersianDigits(khatmCompletedCount)} صفحه تلاوت شده از {toPersianDigits(khatmTotalPages)} صفحه کل
                </span>
              </span>
              <span className="font-extrabold text-teal-600 dark:text-teal-400 text-sm">
                {toPersianDigits(khatmProgressPercent)}٪
              </span>
            </div>

            <div className="w-full h-2.5 bg-stone-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, khatmProgressPercent)}%` }}
              />
            </div>

            {khatmTodaySegment && (
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {isKhatmTodayCompleted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>سهمیه امروز خوانده شد</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>سهمیه امروز (روز {toPersianDigits(khatmCurrentDay)})</span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    صفحه {toPersianDigits(khatmTodaySegment.startPage)} تا {toPersianDigits(khatmTodaySegment.endPage)}
                    {khatmTodaySegment.label ? ` • ${toPersianDigits(khatmTodaySegment.label)}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => onNavigateToMushafPage(khatmTodaySegment.startPage)}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all"
                  >
                    تلاوت سهمیه (ص {toPersianDigits(khatmTodaySegment.startPage)})
                  </button>

                  {!isKhatmTodayCompleted && (
                    <button
                      onClick={handleMarkTodayKhatmCompleted}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                    >
                      ثبت انجام
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* محتوای تب ۳: پیشرفت حفظ قرآن */}
        {activeFocusTab === 'memorization' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-teal-500" />
                <span>
                  {toPersianDigits(memoStats.totalMemorized)} آیه تثبیت شده
                </span>
              </span>
              <span className="font-extrabold text-teal-600 dark:text-teal-400 text-sm">
                {toPersianDigits(memoStats.percentage)}٪
              </span>
            </div>

            <div className="w-full h-2.5 bg-stone-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, memoStats.percentage)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-lg bg-stone-50 dark:bg-slate-800/60 border border-stone-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">آیات نشان‌شده</div>
                <div className="text-xs font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                  {toPersianDigits(memoStats.totalMemorized)}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-stone-50 dark:bg-slate-800/60 border border-stone-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">جلسات اخیر</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  {toPersianDigits(memoStats.recentSessions.length)} جلسه
                </div>
              </div>

              <div className="p-2 rounded-lg bg-stone-50 dark:bg-slate-800/60 border border-stone-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">هدف تثبیت</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  جزء ۳۰
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* بخش اختصاصی داستان روز قرآنی با دسترسی سریع به آزمون شورتز و مطالعه کامل */}
      <section id="home-daily-story" className="rounded-3xl border border-amber-500/30 dark:border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
        {/* هدر داستان روز */}
        <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 tracking-wider">
                  داستان روز قرآنی
                </span>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/20">
                  سوره {todayStory.surahName}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {todayStory.title}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setStoryShuffleOffset((prev) => prev + 1)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-amber-300/60 dark:border-slate-700 bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700 transition-all active:scale-95 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
            title="مشاهده داستان قرآنی دیگر"
            aria-label="داستان دیگر"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">داستان دیگر</span>
          </button>
        </div>

        {/* اطلاعات سوره و شخصیت‌ها */}
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            شخصیت‌ها:
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium">
            {todayStory.character}
          </span>
          <span className="text-slate-400 dark:text-slate-500">•</span>
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            {todayStory.versesRange}
          </span>
        </div>

        {/* خلاصه داستان با فونت خوانا */}
        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed text-right font-normal">
          {todayStory.summary}
        </p>

        {/* آیه کلیدی داستان با فونت باشکوه و درشت */}
        {todayStory.narrative[0]?.keyAyahText && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-right space-y-2">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 justify-end">
              <span>{todayStory.narrative[0].keyAyahRef}</span>
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <p
              className="text-xl sm:text-2xl md:text-3xl font-bold leading-loose text-slate-900 dark:text-amber-100"
              style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
              dir="rtl"
            >
              «{todayStory.narrative[0].keyAyahText}»
            </p>
          </div>
        )}

        {/* دکمه‌های عملیات */}
        <div className="pt-2 flex items-center justify-between gap-2.5 border-t border-amber-200/50 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedStoryModal(todayStory)}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-stone-300 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>مطالعه داستان</span>
            </button>

            <button
              onClick={handleStartTodayStoryQuiz}
              className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all cursor-pointer active:scale-95 shadow-xs shrink-0"
              title="آزمون تمام‌صفحه"
              aria-label="آزمون تمام‌صفحه"
            >
              <Trophy className="w-4 h-4 fill-current" />
            </button>
          </div>

          <button
            onClick={onOpenMemorization}
            className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 p-2"
          >
            <span>همه داستان‌ها</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* دسترسی سریع به بخش‌های اصلی - با کارت‌های تمیز و بدون بوردر شلوغ */}
      <section id="home-quick-actions" className="space-y-2.5">
        <h3 className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 px-1">
          بخش‌های تخصصی
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* قرائت آیه به آیه */}
          <button
            onClick={onContinueReading}
            className="p-3 sm:p-3.5 rounded-xl border border-stone-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-right transition-all hover:border-teal-500/50 shadow-xs flex flex-col justify-between active:scale-[0.99]"
          >
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 w-fit mb-2">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">قرائت آیه‌ای</div>
              <div className="text-xs text-slate-400 mt-1">۳ ترجمه + تفسیر</div>
            </div>
          </button>

          {/* مصحف صفحه‌ای */}
          <button
            onClick={onOpenMushafPage}
            className="p-3 sm:p-3.5 rounded-xl border border-stone-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-right transition-all hover:border-teal-500/50 shadow-xs flex flex-col justify-between active:scale-[0.99]"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit mb-2">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">مصحف صفحه‌ای</div>
              <div className="text-xs text-slate-400 mt-1">۶۰۴ صفحه عثمان طه</div>
            </div>
          </button>

          {/* ترتیل صوتی */}
          <button
            onClick={() => onPlayVerseAudio(lastReadSurah.id, lastRead ? lastRead.verseNumber : 1)}
            className="p-3 sm:p-3.5 rounded-xl border border-stone-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-right transition-all hover:border-teal-500/50 shadow-xs flex flex-col justify-between active:scale-[0.99]"
          >
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 w-fit mb-2">
              <Headphones className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">ترتیل صوتی</div>
              <div className="text-xs text-slate-400 mt-1">پرهیزگار، منشاوی و…</div>
            </div>
          </button>

          {/* دستیار تدبّر */}
          <button
            onClick={() => onOpenAI()}
            className="p-3 sm:p-3.5 rounded-xl border border-stone-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-right transition-all hover:border-teal-500/50 shadow-xs flex flex-col justify-between active:scale-[0.99]"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit mb-2">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">دستیار تدبّر</div>
              <div className="text-xs text-slate-400 mt-1">پاسخ هوشمند قرآنی</div>
            </div>
          </button>
        </div>
      </section>

      {/* بخش درباره قرآن مبین، پشتیبانی و ثبت نظر در مایکت */}
      {onOpenAbout && (
        <section id="home-about-section" className="pt-2 pb-6">
          <div className="p-4 rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                    قرآن مبین
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/20">
                    نسخه ۱.۰.۰
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  رایگان و بدون تبلیغات • پشتیبانی، حریم خصوصی و ثبت نظر در مایکت
                </div>
              </div>
            </div>

            <button
              onClick={onOpenAbout}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 text-center shrink-0"
            >
              درباره و تماس با ما
            </button>
          </div>
        </section>
      )}
      {/* آزمون شورتز تمام‌صفحه ویدیویی برای داستان روز */}
      {isStoryShortsOpen && (
        <FullscreenShortsQuiz
          isOpen={isStoryShortsOpen}
          title={storyQuizTitle}
          questions={storyQuizQuestions}
          onClose={() => setIsStoryShortsOpen(false)}
        />
      )}

      {/* مدال مطالعه تفصیلی داستان و عبرت‌های قرآنی */}
      {selectedStoryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/30 text-slate-800 dark:text-slate-100 shadow-2xl p-5 sm:p-7 space-y-6">
            {/* سربرگ مدال داستان */}
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    {selectedStoryModal.title}
                  </h3>
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                    سوره {selectedStoryModal.surahName} • {selectedStoryModal.versesRange}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedStoryModal(null)}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* شخصیت‌ها و زیرعنوان */}
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {selectedStoryModal.subtitle}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-600 dark:text-slate-300">شخصیت‌های ماجرا: </span>
                {selectedStoryModal.character}
              </div>
            </div>

            {/* فرازهای سرگذشت */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                فرازهای داستان
              </h4>
              <div className="space-y-4">
                {selectedStoryModal.narrative.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-stone-50/80 dark:bg-slate-800/40 border border-stone-200/60 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400">
                      <div className="w-5 h-5 rounded-full bg-teal-500/15 flex items-center justify-center text-[10px]">
                        {toPersianDigits(idx + 1)}
                      </div>
                      <span>{item.sectionTitle}</span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed text-right">
                      {item.text}
                    </p>

                    {item.keyAyahText && (
                      <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-right space-y-1 mt-2">
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                          {item.keyAyahRef}
                        </div>
                        <p
                          className="text-base sm:text-lg font-bold leading-loose text-slate-900 dark:text-amber-100"
                          style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                          dir="rtl"
                        >
                          «{item.keyAyahText}»
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* حکمت‌ها و عبرت‌ها */}
            {selectedStoryModal.wisdoms && selectedStoryModal.wisdoms.length > 0 && (
              <div className="space-y-2.5 p-4 rounded-2xl bg-teal-500/10 dark:bg-teal-500/5 border border-teal-500/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                  <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>عبرت‌ها و پیام‌های زندگی‌ساز</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside">
                  {selectedStoryModal.wisdoms.map((w, i) => (
                    <li key={i} className="leading-relaxed">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* دکمه‌های انتهای مدال */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setSelectedStoryModal(null);
                  handleStartTodayStoryQuiz();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Trophy className="w-4 h-4 fill-current" />
                <span>شروع آزمون</span>
              </button>

              <button
                onClick={() => setSelectedStoryModal(null)}
                className="px-4 py-2 rounded-xl border border-stone-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-stone-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
