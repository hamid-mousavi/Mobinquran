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
  Menu,
} from 'lucide-react';
import { Surah, Verse, KhatmPlan, KhatmType } from '../types';
import { AyahEndMarker } from './QuranReader';
import { QuranLogo, QuranicCard } from './QuranicOrnament';
import { StarBadge } from './StarBadge';
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
  onOpenSurahSelector: (tab?: 'surahs' | 'juz') => void;
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
  onOpenMenu?: () => void;
  onToggleDarkMode: () => void;
  onPlayVerseAudio: (surahId: number, verseNumber: number) => void;
  darkMode: boolean;
}

const QURAN_FONT = "'Amiri Quran', 'UthmanTaha', serif";
const RECENT_SURAHS_KEY = 'mobin_recent_surahs';
const DEFAULT_QUICK_SURAHS = [36, 55, 56, 67, 18];

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
  onOpenMenu,
  onToggleDarkMode,
  onPlayVerseAudio,
  darkMode,
}) => {
  const [memoStats, setMemoStats] = useState<MemorizationStats>(getMemorizationStats);
  const [khatmPlan, setKhatmPlan] = useState<KhatmPlan | null>(null);
  const [khatmSegments, setKhatmSegments] = useState<KhatmSegment[]>([]);
  const [activeFocusTab, setActiveFocusTab] = useState<'verse' | 'story'>('verse');
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

  // سوره‌های اخیر/پرمصرف (آخرین ۶ سوره‌ای که قرائت شده؛ با پیش‌فرض‌های پرمصرف تکمیل می‌شود)
  const [recentSurahIds, setRecentSurahIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SURAHS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)).slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (!lastRead?.surahId) return;
    setRecentSurahIds((prev) => {
      const next = [lastRead.surahId, ...prev.filter((id) => id !== lastRead.surahId)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SURAHS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [lastRead?.surahId]);
  const quickSurahs = useMemo(() => {
    const ids = [...recentSurahIds];
    for (const id of DEFAULT_QUICK_SURAHS) {
      if (ids.length < 6 && !ids.includes(id)) ids.push(id);
    }
    return ids.map((id) => surahs.find((x) => x.id === id)).filter((x): x is Surah => !!x);
  }, [recentSurahIds, surahs]);

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
  const [prayerModalTab, setPrayerModalTab] = useState<'times' | 'qibla' | 'cities'>('times');

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
      className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-12 space-y-4 sm:space-y-5 animate-fadeIn select-none"
      dir="rtl"
    >
      {/* سربرگ تمیز بالای صفحه اصلی */}
      <header
        id="home-top-header"
        className="flex items-center justify-between gap-2.5 pb-3 border-b border-stone-200/80 dark:border-slate-800/80"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenMenu}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-stone-300 dark:border-slate-800 bg-stone-50 dark:bg-slate-900 text-teal-800 dark:text-teal-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            title="منو"
            aria-label="باز کردن منو"
          >
            <Menu className="w-5 h-5" />
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

        <div className="w-11 shrink-0" aria-hidden="true" />
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

      {/* کارت اصلی: ادامه قرائت (محراب‌گونه با کادر دوخطهٔ طلایی) */}
      <div
        id="home-last-read-card"
        className="relative overflow-hidden rounded-3xl bg-teal-800 text-white px-5 pt-6 pb-5 text-center"
      >
        <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
          <defs>
            <pattern id="home-star-pattern" width="34" height="34" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="#e8d9a8" strokeWidth="1">
                <rect x="7" y="7" width="20" height="20" />
                <rect x="7" y="7" width="20" height="20" transform="rotate(45 17 17)" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#home-star-pattern)" />
        </svg>
        <div className="absolute inset-[6px] rounded-[20px] border-[1.5px] border-amber-300 pointer-events-none" />
        <div className="absolute inset-[11px] rounded-2xl border border-amber-300/45 pointer-events-none" />

        <div className="relative flex flex-col items-center gap-2.5">
          <div className="text-xs font-bold text-amber-300 mt-1">ادامه قرائت</div>
          <div className="text-[32px] leading-[1.4]" style={{ fontFamily: QURAN_FONT }}>
            سُورَةُ {lastReadSurah.nameArabic}
          </div>
          <div className="flex items-center gap-2 text-[13px] text-teal-50/90">
            <StarBadge size={30} onDark>
              {toPersianDigits(lastRead ? lastRead.verseNumber : 1)}
            </StarBadge>
            <span>
              آیه {toPersianDigits(lastRead ? lastRead.verseNumber : 1)} · صفحه{' '}
              {toPersianDigits(lastRead?.pageNumber ?? lastReadSurah.startPage)}
            </span>
          </div>
          <div className="self-stretch mx-3 h-[5px] rounded-full bg-teal-700">
            <div
              className="h-[5px] rounded-full bg-amber-300"
              style={{
                width: `${Math.min(100, Math.round(((lastRead?.pageNumber ?? lastReadSurah.startPage) / 604) * 100))}%`,
              }}
            />
          </div>
          <div className="self-stretch flex gap-2.5 px-2 pt-1">
            <button
              type="button"
              onClick={onContinueReading}
              className="flex-1 h-[46px] rounded-2xl bg-amber-300 text-teal-800 text-[15px] font-extrabold cursor-pointer active:scale-[0.98] transition-transform"
            >
              ادامه
            </button>
            <button
              type="button"
              onClick={() => onOpenSurahSelector('surahs')}
              className="flex-1 h-[46px] rounded-2xl border border-teal-500 text-white text-[15px] font-bold cursor-pointer active:scale-[0.98] transition-transform"
            >
              فهرست
            </button>
          </div>
        </div>
      </div>

      {/* میانبرها: سوره‌ها، جزءها، صفحه، نشان‌شده‌ها */}
      <section id="home-shortcuts" aria-label="میانبرهای قرائت" className="grid grid-cols-4 gap-2">
        {[
          { label: 'سوره‌ها', icon: BookOpen, onClick: () => onOpenSurahSelector('surahs') },
          { label: 'جزءها', icon: Layers, onClick: () => onOpenSurahSelector('juz') },
          { label: 'صفحه', icon: FileText, onClick: onOpenMushafPage },
          { label: 'نشانک‌ها', icon: Bookmark, onClick: onOpenBookmarks },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="min-h-[64px] flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-300/70 dark:border-slate-700 bg-stone-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer active:scale-[0.97] transition-transform hover:border-teal-600/60"
            >
              <Icon className="w-[22px] h-[22px] text-teal-600 dark:text-teal-400" />
              {item.label}
            </button>
          );
        })}
      </section>

      {/* اخیر و پرمصرف */}
      {quickSurahs.length > 0 && (
        <section id="home-quick-surahs" aria-label="سوره‌های اخیر و پرمصرف" className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8802c" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" />
              <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
            </svg>
            اخیر و پرمصرف
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {quickSurahs.map((sr) => (
              <button
                key={sr.id}
                type="button"
                onClick={() => onSelectSurah(sr)}
                className="shrink-0 min-h-[44px] flex items-center gap-2 pr-3 pl-4 rounded-full border border-amber-300/70 dark:border-slate-700 bg-stone-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-[17px] cursor-pointer active:scale-[0.97] transition-transform hover:border-teal-600/60"
                style={{ fontFamily: QURAN_FONT }}
              >
                <StarBadge size={28}>{toPersianDigits(sr.id)}</StarBadge>
                {sr.nameArabic}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ویجت اوقات شرعی و قبله‌نما */}
      <PrayerTimesCard
        onOpenModal={(tab = 'times') => {
          setPrayerModalTab(tab);
          setIsPrayerModalOpen(true);
        }}
        darkMode={darkMode}
      />

      {/* ویجت همراهی و استمرار روزانه با قرآن (Daily Streak & Spaced Repetition) */}
      <DailyCompanionCard
        streakData={streakData}
        weekStatus={weekStatus}
        dueReviewAyahs={dueReviewAyahs}
        onOpenStreakModal={() => setIsStreakModalOpen(true)}
        onOpenReviewModal={() => setIsStreakModalOpen(true)}
        darkMode={darkMode}
      />

      {/* بخش تب‌های روزانه: آیه روز / ختم قرآن / حفظ قرآن */}
      <div className="rounded-2xl sm:rounded-3xl border-2 border-amber-600/70 dark:border-amber-500/40 bg-amber-50/60 dark:bg-slate-900 p-4 sm:p-6 space-y-4">
        {/* تب‌ها: آیهٔ منتخب | داستان روز (ختم و حفظ از این کارت حذف شدند) */}
        <div className="flex items-center justify-between border-b border-amber-300/50 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2.5" role="tablist" aria-label="محتوای روزانه">
            <button
              role="tab"
              aria-selected={activeFocusTab === 'verse'}
              onClick={() => setActiveFocusTab('verse')}
              className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeFocusTab === 'verse'
                  ? 'bg-teal-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              آیهٔ منتخب امروز
            </button>
            <button
              role="tab"
              aria-selected={activeFocusTab === 'story'}
              onClick={() => setActiveFocusTab('story')}
              className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeFocusTab === 'story'
                  ? 'bg-teal-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
              }`}
            >
              داستان روز
            </button>
          </div>

          <button
            onClick={() => (activeFocusTab === 'verse' ? handleShuffleVerse() : setStoryShuffleOffset((prev) => prev + 1))}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title={activeFocusTab === 'verse' ? 'آیه تصادفی دیگر' : 'داستان قرآنی دیگر'}
            aria-label={activeFocusTab === 'verse' ? 'تغییر آیه تصادفی' : 'داستان دیگر'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

        {/* محتوای تب ۲: داستان روز قرآنی */}
        {activeFocusTab === 'story' && (
          <div id="home-daily-story" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">{todayStory.title}</h2>
              <span className="shrink-0 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/20">
                سوره {todayStory.surahName}
              </span>
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
          </div>
        )}

      </div>

      {/* ختم قرآن: ردیف فشرده زیر کارت روزانه */}
      {khatmPlan && khatmTodaySegment ? (
        <section
          id="home-khatm-row"
          className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/20 p-3.5 space-y-2.5"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenKhatm}
              className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="برنامه ختم قرآن"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ختم قرآن · {toPersianDigits(khatmProgressPercent)}٪
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                {isKhatmTodayCompleted
                  ? 'سهمیه امروز خوانده شد'
                  : `امروز: صفحه ${toPersianDigits(khatmTodaySegment.startPage)} تا ${toPersianDigits(khatmTodaySegment.endPage)}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => (isKhatmTodayCompleted ? onOpenKhatm() : onNavigateToMushafPage(khatmTodaySegment.startPage))}
              className="min-h-[44px] px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer active:scale-[0.97] transition-transform"
            >
              {isKhatmTodayCompleted ? 'جزئیات' : 'تلاوت'}
            </button>
          </div>
          <div className="w-full h-1.5 bg-indigo-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${Math.max(1, khatmProgressPercent)}%` }} />
          </div>
        </section>
      ) : (
        <button
          type="button"
          id="home-khatm-row"
          onClick={onOpenKhatm}
          className="w-full min-h-[56px] flex items-center gap-3 px-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/20 text-right cursor-pointer active:scale-[0.99] transition-transform"
        >
          <span className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-extrabold text-slate-900 dark:text-slate-100">ختم قرآن</span>
            <span className="block text-[11px] text-slate-600 dark:text-slate-400">برنامهٔ روزانه بسازید و پیشرفتتان را پایش کنید</span>
          </span>
          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      )}


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
