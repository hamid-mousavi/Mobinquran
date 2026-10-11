import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  HelpCircle,
  X,
  ChevronRight,
  Mic,
  MicOff,
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
import { RealisticQuizView, QuizQuestionItem } from './RealisticQuizView';
import { QuranStoryDetailModal } from './QuranStoryDetailModal';
import { DailyCompanionCard } from './DailyCompanionCard';
import { DailyStreakModal } from './DailyStreakModal';
import { PrayerTimesCard } from './PrayerTimesCard';
import { PrayerTimesModal } from './PrayerTimesModal';
import {
  getStreakData,
  getCurrentWeekStatus,
  getDueReviewAyahs,
  recordUserActivity,
  StreakData,
  WeekDayStatus,
  ReviewAyahItem,
} from '../services/activityTracker';

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
  onOpenStories?: () => void;
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
  onOpenStories,
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
  const [storyQuizQuestions, setStoryQuizQuestions] = useState<QuizQuestionItem[]>([]);
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
    const formatted: QuizQuestionItem[] = todayStory.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      contextText: q.contextAyah,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      surahName: q.surahName,
      verseNumber: q.verseNumber,
      categoryBadge: `داستان ${todayStory.title}`,
      fullVerseText: q.contextAyah || undefined,
      fullVerseTranslation: q.explanation,
      isBlankFill: false,
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
    recordUserActivity('khatm');
    window.dispatchEvent(new CustomEvent('mobin-khatm-updated'));
  };

  // پیگیری همراهی و زنجیره پیوستگی روزانه و آیات نیازمند مرور (لایتنر)
  const [streakData, setStreakData] = useState<StreakData>(getStreakData());
  const [weekStatus, setWeekStatus] = useState<WeekDayStatus[]>(getCurrentWeekStatus());
  const [dueReviewAyahs, setDueReviewAyahs] = useState<ReviewAyahItem[]>(getDueReviewAyahs());
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [prayerModalTab, setPrayerModalTab] = useState<'times' | 'azan' | 'qibla' | 'cities'>('times');

  useEffect(() => {
    const handleOpenPrayer = (e: any) => {
      if (e?.detail?.tab) {
        setPrayerModalTab(e.detail.tab);
      }
      setIsPrayerModalOpen(true);
    };
    window.addEventListener('mobin-open-prayer-times', handleOpenPrayer);
    return () => window.removeEventListener('mobin-open-prayer-times', handleOpenPrayer);
  }, []);

  useEffect(() => {
    const refreshActivity = () => {
      setStreakData(getStreakData());
      setWeekStatus(getCurrentWeekStatus());
      setDueReviewAyahs(getDueReviewAyahs());
    };
    refreshActivity();
    window.addEventListener('mobin-activity-updated', refreshActivity);
    window.addEventListener('mobin-review-deck-updated', refreshActivity);
    return () => {
      window.removeEventListener('mobin-activity-updated', refreshActivity);
      window.removeEventListener('mobin-review-deck-updated', refreshActivity);
    };
  }, []);

  // وضعیت و منطق جستجوی صوتی در صفحه نخست
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const voiceRecognitionRef = useRef<any>(null);

  const handleToggleVoiceSearch = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        onOpenSearch();
        return;
      }

      if (isVoiceListening) {
        try {
          voiceRecognitionRef.current?.stop();
        } catch {}
        setIsVoiceListening(false);
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'fa-IR';

        recognition.onstart = () => {
          setIsVoiceListening(true);
          setVoiceTranscript('');
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = 0; i < event.results.length; i++) {
            interim += event.results[i][0].transcript;
          }
          setVoiceTranscript(interim);
          if (event.results[0]?.isFinal) {
            const finalQuery = event.results[0][0].transcript.trim();
            setIsVoiceListening(false);
            if (finalQuery) {
              onOpenSearch(finalQuery);
            }
          }
        };

        recognition.onerror = () => {
          setIsVoiceListening(false);
        };

        recognition.onend = () => {
          setIsVoiceListening(false);
          setVoiceTranscript((prev) => {
            const queryToSearch = prev.trim();
            if (queryToSearch) {
              setTimeout(() => onOpenSearch(queryToSearch), 50);
            }
            return '';
          });
        };

        voiceRecognitionRef.current = recognition;
        recognition.start();
      } catch {
        setIsVoiceListening(false);
        onOpenSearch();
      }
    },
    [isVoiceListening, onOpenSearch]
  );

  return (
    <main
      id="quran-home-page"
      className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-4 sm:space-y-5 animate-fadeIn select-none"
      dir="rtl"
    >
      {/* سربرگ تمیز بالای صفحه اصلی */}
      <header
        id="home-top-header"
        className="flex items-center justify-between gap-2.5 pb-3 border-b border-stone-200/80 dark:border-slate-800/80"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenSettings}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-xs cursor-pointer"
            title="تنظیمات قلم و ترجمه"
            aria-label="تنظیمات"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400" />
          </button>

          <button
            onClick={onToggleDarkMode}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-xs cursor-pointer"
            title={darkMode ? 'حالت روز' : 'حالت شب'}
            aria-label="تغییر تم"
          >
            {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>

        {/* وسط: لوگوی قرآن مبین و نشان متبرک موکب حضرت فاطمه‌الزهرا (سلام‌الله‌علیها) */}
        <div className="flex items-center justify-center gap-2.5 min-w-0">
          <QuranLogo size="md" darkMode={darkMode} />
          {onOpenAbout && (
            <button
              onClick={onOpenAbout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-amber-500/20 border border-amber-400/40 transition-all cursor-pointer group active:scale-95 shadow-2xs"
              title="موکب حضرت فاطمه‌الزهرا (سلام‌الله‌علیها)"
            >
              <img
                src="/mokeb-logo.jpg"
                alt="موکب فاطمه الزهرا (س)"
                className="w-7 h-7 sm:w-8 sm:h-8 object-cover rounded-xl border border-amber-400/60 group-hover:scale-105 transition-transform"
              />
              <div className="text-right hidden xs:block">
                <span className="block text-xs font-black text-slate-800 dark:text-slate-100 leading-tight">
                  موکب فاطمه‌الزهرا (س)
                </span>
              </div>
            </button>
          )}
        </div>

        {/* سمت چپ: نشان‌شده‌ها */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenBookmarks}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-xs cursor-pointer"
            title="نشان‌شده‌ها و یادداشت‌ها"
            aria-label="نشان‌شده‌ها"
          >
            <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
          </button>
        </div>
      </header>

      {/* نوار جستجوی اختصاصی و فوق‌العاده شکیل با قابلیت جستجوی صوتی */}
      <section id="home-search-bar" className="space-y-2.5">
        <div
          onClick={() => {
            if (isVoiceListening) {
              try {
                voiceRecognitionRef.current?.stop();
              } catch {}
              setIsVoiceListening(false);
            }
            onOpenSearch();
          }}
          className={`group relative flex items-center justify-between rounded-2xl border transition-all cursor-pointer backdrop-blur-md p-3 sm:p-3.5 shadow-sm ${
            isVoiceListening
              ? 'border-teal-500 bg-teal-500/10 dark:bg-teal-950/30 ring-2 ring-teal-500/30 shadow-md shadow-teal-500/10'
              : 'border-stone-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 hover:border-teal-500/80 hover:shadow-md hover:shadow-teal-600/10'
          }`}
        >
          <div className="flex items-center gap-3 text-slate-400 dark:text-slate-400 min-w-0 flex-1 px-1">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                isVoiceListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 group-hover:scale-110'
              }`}
            >
              <Search className="w-4.5 h-4.5" />
            </div>
            {isVoiceListening ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300 animate-pulse truncate">
                  {voiceTranscript
                    ? `در حال شنیدن: "${voiceTranscript}"`
                    : 'در حال شنیدن صدای شما... (مثلاً بگویید: سوره یس)'}
                </span>
              </div>
            ) : (
              <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-700 dark:text-slate-200 truncate">
                جستجو در متن آیات، ترجمه‌ها، سوره‌ها و موضوعات قرآن…
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* دکمه اختصاصی جستجوی صوتی فقط با آیکون */}
            <button
              type="button"
              onClick={handleToggleVoiceSearch}
              title={isVoiceListening ? 'توقف شنیدن صدا' : 'جستجوی صوتی قرآن'}
              aria-label="جستجوی صوتی"
              className={`p-2.5 sm:p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                isVoiceListening
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse ring-2 ring-rose-300'
                  : 'bg-stone-100 hover:bg-teal-50 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 border border-stone-200/60 dark:border-slate-700/60 active:scale-95'
              }`}
            >
              {isVoiceListening ? (
                <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ویجت همراهی و استمرار روزانه با قرآن (Daily Streak & Spaced Repetition) */}
      <DailyCompanionCard
        streakData={streakData}
        weekStatus={weekStatus}
        dueReviewAyahs={dueReviewAyahs}
        onOpenStreakModal={() => setIsStreakModalOpen(true)}
        onOpenReviewModal={() => setIsStreakModalOpen(true)}
        darkMode={darkMode}
      />

      {/* ویجت اوقات شرعی و قبله‌نما */}
      <PrayerTimesCard
        onOpenModal={(tab = 'times') => {
          setPrayerModalTab(tab);
          setIsPrayerModalOpen(true);
        }}
        darkMode={darkMode}
      />

      {/* چهار کارت اصلی دسترسی سریع درست زیر نوار جستجو با طراحی برجسته، شکیل و فونت درشت */}
      <section id="home-main-shortcuts" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* ۱. قرآن کریم */}
        <div
          onClick={onContinueReading}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-teal-500/35 bg-gradient-to-br from-teal-500/15 via-white to-white dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-teal-500 transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/25 group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              قرآن کریم
            </h3>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-300 mt-1 font-semibold">
              قرائت، ترتیل و ترجمه
            </p>
          </div>
        </div>

        {/* ۲. حفظ قرآن */}
        <div
          onClick={onOpenMemorization}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-white to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/25 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              حفظ قرآن
            </h3>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-300 mt-1 font-semibold">
              تمرین، آزمون و کارنامه
            </p>
          </div>
        </div>

        {/* ۳. ختم قرآن */}
        <div
          onClick={onOpenKhatm}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-indigo-500/35 bg-gradient-to-br from-indigo-500/15 via-white to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-indigo-500 transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25 group-hover:scale-105 transition-transform">
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              ختم قرآن
            </h3>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-300 mt-1 font-semibold">
              برنامه روزانه و پایش
            </p>
          </div>
        </div>

        {/* ۴. دستیار هوشمند */}
        <div
          onClick={() => onOpenAI()}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-500/35 bg-gradient-to-br from-purple-500/15 via-white to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900 shadow-xs hover:shadow-md hover:border-purple-500 transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/25 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              دستیار هوشمند
            </h3>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-300 mt-1 font-semibold">
              تدبّر، مفاهیم و پاسخ
            </p>
          </div>
        </div>
      </section>

      {/* کارت یکپارچه «آخرین موقعیت قرائت» در زیر کارت‌های اصلی با فونت درشت و خوانا */}
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
        className="group relative rounded-3xl p-5 sm:p-7 border border-teal-600/35 dark:border-teal-500/30 bg-white dark:bg-slate-900 shadow-xs hover:border-teal-500 hover:shadow-md hover:shadow-teal-600/10 transition-all cursor-pointer space-y-4 overflow-hidden active:scale-[0.99]"
      >
        {/* هدر کارت: نام سوره و مشخصات آیه */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-teal-700 dark:text-teal-400">
                ادامه آخرین موقعیت مطالعه
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-50 truncate mt-0.5">
                سوره {lastReadSurah.nameArabic} ({lastReadSurah.namePersian})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs sm:text-base px-3.5 py-1.5 rounded-xl bg-teal-500/15 dark:bg-teal-500/25 text-teal-800 dark:text-teal-200 font-black">
              آیه {toPersianDigits(lastRead ? lastRead.verseNumber : 1)}
            </span>
            <div className="w-9 h-9 rounded-full bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center transition-transform group-hover:-translate-x-1">
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* بدنه کارت: متن آیه و ترجمه با فونت بسیار درشت، خوانا و باوقار */}
        <div className="space-y-3.5 text-right">
          <p
            className="text-2xl sm:text-4xl md:text-5xl font-normal text-slate-900 dark:text-slate-50 leading-[2.4] line-clamp-2"
            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
            dir="rtl"
          >
            {lastReadVerse ? lastReadVerse.textArabic : 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'}
          </p>
          <p className="text-sm sm:text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-2">
            {lastReadVerse?.translationMakarem || lastReadVerse?.translationAnsarian || lastReadVerse?.translationFooladvand || 'برای ادامه قرائت از این آیه، روی این کارت کلیک کنید.'}
          </p>
        </div>
      </div>

      {/* بخش تب‌های روزانه: آیه روز / ختم قرآن / حفظ قرآن */}
      <div className="rounded-2xl sm:rounded-3xl border border-stone-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs space-y-4">
        {/* هدر دسته‌بندی با طراحی مینیمال */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              onClick={() => setActiveFocusTab('verse')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeFocusTab === 'verse'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              آیهٔ منتخب امروز
            </button>

            <button
              onClick={() => setActiveFocusTab('khatm')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeFocusTab === 'khatm'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>برنامه ختم</span>
              {khatmProgressPercent > 0 && (
                <span className="text-[11px] opacity-90 font-mono font-bold">
                  ({toPersianDigits(khatmProgressPercent)}٪)
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveFocusTab('memorization')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeFocusTab === 'memorization'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
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
              title="آزمون داستان"
              aria-label="آزمون داستان"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              if (onOpenStories) {
                onOpenStories();
              } else {
                onOpenMemorization();
              }
            }}
            className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 p-2 cursor-pointer"
          >
            <span>همه داستان‌ها ({toPersianDigits(QURAN_STORIES.length)})</span>
            <ChevronLeft className="w-3.5 h-3.5" />
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
      {/* آزمون واقعی و استاندارد برای داستان روز قرآنی با بازخورد صوتی و گذار خودکار */}
      {isStoryShortsOpen && (
        <RealisticQuizView
          title={storyQuizTitle}
          questions={storyQuizQuestions}
          onClose={() => setIsStoryShortsOpen(false)}
          onRestart={handleStartTodayStoryQuiz}
        />
      )}

      {/* مدال مطالعه تفصیلی داستان و عبرت‌های قرآنی با جزئیات کامل */}
      {selectedStoryModal && (
        <QuranStoryDetailModal
          story={selectedStoryModal}
          onClose={() => setSelectedStoryModal(null)}
          onStartQuiz={(story) => {
            setSelectedStoryModal(null);
            handleStartTodayStoryQuiz();
          }}
          onNavigateToSurah={(surahId) => {
            const targetSurah = surahs.find((s) => s.id === surahId);
            if (targetSurah) {
              onSelectSurah(targetSurah);
            }
          }}
        />
      )}

      {/* مدال تقویم همراهی و استمرار قرآنی و لایتنر */}
      <DailyStreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streakData={streakData}
        weekStatus={weekStatus}
        dueReviewAyahs={dueReviewAyahs}
        onNavigateToVerse={onNavigateToVerse}
        darkMode={darkMode}
      />

      {/* مدال جامع اوقات شرعی، قبله‌نما و انتخاب شهر */}
      <PrayerTimesModal
        isOpen={isPrayerModalOpen}
        onClose={() => setIsPrayerModalOpen(false)}
        initialTab={prayerModalTab}
        darkMode={darkMode}
      />
    </main>
  );
};
