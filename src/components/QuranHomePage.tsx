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
  Circle,
  Clock,
  Layers,
} from 'lucide-react';
import { Surah, Verse, KhatmPlan, KhatmType } from '../types';
import { AyahEndMarker } from './QuranReader';
import { QuranLogo, QuranicCard } from './QuranicOrnament';
import { toPersianDigits } from '../utils/textNormalization';
import { getMemorizationStats, MemorizationStats } from '../services/memorizationStorage';
import { QuranService } from '../services/quranService';
import { buildKhatmSegments, KhatmSegment } from '../utils/khatmMath';
import { currentKhatmDay, localDateKey } from '../utils/date';

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
  onToggleDarkMode: () => void;
  onPlayVerseAudio: (surahId: number, verseNumber: number) => void;
  darkMode: boolean;
}

// گنجینه آیات برگزیده قرآن برای انتخاب تصادفی
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
  {
    surahId: 3,
    surahNameArabic: 'آل عِمْرَان',
    verseNumber: 139,
    textArabic: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
    translationPersian: 'و سست نشوید و اندوهگین مباشید، و شما برترید اگر مؤمن باشید.',
    theme: 'عزت و ایستادگی مؤمنان',
  },
  {
    surahId: 59,
    surahNameArabic: 'الحَشْر',
    verseNumber: 22,
    textArabic: 'هُوَ اللَّهُ الَّذِي لَا إِلَٰهَ إِلَّا هُوَ ۖ عَالِمُ الْغَيْبِ وَالشَّهَادَةِ ۖ هُوَ الرَّحْمَٰنُ الرَّحِيمُ',
    translationPersian: 'او خدایی است که معبودی جز او نیست؛ دانای نهان و آشکار است، اوست بخشنده و مهربان.',
    theme: 'اسماء حسنی و علم الهی',
  },
];

// ۳۰ جزء قرآن و آغاز هر جزء
const JUZ_STARTS = [
  { juz: 1, surahId: 1, surahName: 'حمد', ayah: 1, page: 1 },
  { juz: 2, surahId: 2, surahName: 'بقره', ayah: 142, page: 22 },
  { juz: 3, surahId: 2, surahName: 'بقره', ayah: 253, page: 42 },
  { juz: 4, surahId: 3, surahName: 'آل عمران', ayah: 92, page: 62 },
  { juz: 5, surahId: 4, surahName: 'نساء', ayah: 24, page: 82 },
  { juz: 6, surahId: 4, surahName: 'نساء', ayah: 148, page: 102 },
  { juz: 7, surahId: 5, surahName: 'مائده', ayah: 82, page: 121 },
  { juz: 8, surahId: 6, surahName: 'انعام', ayah: 111, page: 142 },
  { juz: 9, surahId: 7, surahName: 'اعراف', ayah: 88, page: 162 },
  { juz: 10, surahId: 8, surahName: 'انفال', ayah: 41, page: 182 },
  { juz: 11, surahId: 9, surahName: 'توبه', ayah: 93, page: 201 },
  { juz: 12, surahId: 11, surahName: 'هود', ayah: 6, page: 222 },
  { juz: 13, surahId: 12, surahName: 'یوسف', ayah: 53, page: 242 },
  { juz: 14, surahId: 15, surahName: 'حجر', ayah: 1, page: 262 },
  { juz: 15, surahId: 17, surahName: 'اسراء', ayah: 1, page: 282 },
  { juz: 16, surahId: 18, surahName: 'کهف', ayah: 75, page: 302 },
  { juz: 17, surahId: 21, surahName: 'انبیاء', ayah: 1, page: 322 },
  { juz: 18, surahId: 23, surahName: 'مؤمنون', ayah: 1, page: 342 },
  { juz: 19, surahId: 25, surahName: 'فرقان', ayah: 21, page: 362 },
  { juz: 20, surahId: 27, surahName: 'نمل', ayah: 56, page: 382 },
  { juz: 21, surahId: 29, surahName: 'عنکبوت', ayah: 46, page: 402 },
  { juz: 22, surahId: 33, surahName: 'احزاب', ayah: 31, page: 422 },
  { juz: 23, surahId: 36, surahName: 'یس', ayah: 28, page: 442 },
  { juz: 24, surahId: 39, surahName: 'زمر', ayah: 32, page: 462 },
  { juz: 25, surahId: 41, surahName: 'فصلت', ayah: 47, page: 482 },
  { juz: 26, surahId: 46, surahName: 'احقاف', ayah: 1, page: 502 },
  { juz: 27, surahId: 51, surahName: 'ذاریات', ayah: 31, page: 522 },
  { juz: 28, surahId: 58, surahName: 'مجادله', ayah: 1, page: 542 },
  { juz: 29, surahId: 67, surahName: 'ملک', ayah: 1, page: 562 },
  { juz: 30, surahId: 78, surahName: 'نبأ', ayah: 1, page: 582 },
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
  onToggleDarkMode,
  onPlayVerseAudio,
  darkMode,
}) => {
  const [memoStats, setMemoStats] = useState<MemorizationStats>(getMemorizationStats);

  // وضعیت و پیشرفت برنامه ختم قرآن
  const [khatmPlan, setKhatmPlan] = useState<KhatmPlan | null>(null);
  const [khatmSegments, setKhatmSegments] = useState<KhatmSegment[]>([]);
  const [isKhatmLoading, setIsKhatmLoading] = useState(true);

  // اطمینان از اسکرول به ابتدای صفحه هنگام بازگشت به صفحه اصلی (حل باگ اسکرول ناخواسته)
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
    } finally {
      setIsKhatmLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKhatmData();
    window.addEventListener('mobin-khatm-updated', loadKhatmData);
    return () => window.removeEventListener('mobin-khatm-updated', loadKhatmData);
  }, [loadKhatmData]);

  // آیه منتخب تصادفی
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

  // گوش فرادادن به تغییرات پیشرفت حفظ
  useEffect(() => {
    const handleUpdate = () => {
      setMemoStats(getMemorizationStats());
    };
    window.addEventListener('mobin-memorization-updated', handleUpdate);
    return () => window.removeEventListener('mobin-memorization-updated', handleUpdate);
  }, []);

  // سوره آخرین مطالعه
  const lastReadSurah = useMemo(() => {
    if (!lastRead) return surahs[0];
    return surahs.find((s) => s.id === lastRead.surahId) || surahs[0];
  }, [lastRead, surahs]);

  // محاسبات پیشرفت ختم قرآن
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
      className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-6 sm:space-y-7 animate-fadeIn select-none"
      dir="rtl"
    >
      {/* هدر بالای صفحه اصلی: سمت راست آیکن تنظیمات، وسط لوگو، سمت چپ ابزارهای تکمیلی */}
      <header
        id="home-top-header"
        className="flex items-center justify-between gap-3 pt-1 pb-2 border-b border-amber-500/20"
      >
        {/* سمت راست: دکمه تنظیمات و تم */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSettings}
            className={`p-2.5 rounded-2xl border transition-all active:scale-95 flex items-center justify-center ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/30 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-amber-700/20 text-slate-700 hover:bg-amber-50/70 shadow-xs'
            }`}
            title="تنظیمات قلم و ترجمه"
            aria-label="تنظیمات"
          >
            <Settings className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </button>

          <button
            onClick={onToggleDarkMode}
            className={`p-2.5 rounded-2xl border transition-all active:scale-95 flex items-center justify-center ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/30 text-amber-400 hover:bg-slate-800'
                : 'bg-white border-amber-700/20 text-slate-700 hover:bg-amber-50/70 shadow-xs'
            }`}
            title={darkMode ? 'حالت روز' : 'حالت شب'}
            aria-label="تغییر تم روز و شب"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* وسط: لوگوی زیبا و فاخر قرآن مبین */}
        <div className="flex items-center justify-center">
          <QuranLogo size="md" darkMode={darkMode} />
        </div>

        {/* سمت چپ: نشان‌شده‌ها و مدیریت دانلود */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenBookmarks}
            className={`p-2.5 rounded-2xl border transition-all active:scale-95 flex items-center justify-center ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/30 text-amber-400 hover:bg-slate-800'
                : 'bg-white border-amber-700/20 text-slate-700 hover:bg-amber-50/70 shadow-xs'
            }`}
            title="نشان‌شده‌ها و یادداشت‌ها"
            aria-label="نشان‌شده‌ها"
          >
            <Bookmark className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* نوار جستجوی صفحه اصلی: کلیک روی آن پنجره اختصاصی فهرست سوره‌ها و جزءها را باز می‌کند */}
      <section id="home-search-bar" className="relative">
        <div
          onClick={onOpenSurahSelector}
          className={`relative flex items-center justify-between rounded-2xl border-2 transition-all shadow-sm cursor-pointer p-3 sm:p-3.5 group ${
            darkMode
              ? 'bg-slate-900/90 border-amber-500/30 hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20'
              : 'bg-white border-amber-700/25 hover:border-teal-600 hover:ring-2 hover:ring-teal-600/20'
          }`}
        >
          <div className="flex items-center gap-3 text-slate-400 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            <Search className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              جستجو در فهرست ۱۱۴ سوره، ۳۰ جزء قرآن و صفحات...
            </span>
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onOpenSurahSelector}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all shrink-0"
            >
              فهرست سوره‌ها
            </button>
            <button
              onClick={() => onOpenSearch()}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 font-bold text-xs transition-all border border-amber-500/20 flex items-center gap-1 shrink-0"
              title="جستجوی پیشرفته متنی در آیات و ترجمه‌ها"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>پیشرفته</span>
            </button>
          </div>
        </div>
      </section>

      {/* کارت شاخص «ادامهٔ آخرین مطالعه» */}
      <QuranicCard
        id="home-last-read-card"
        darkMode={darkMode}
        className="hover:scale-[1.005]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">
                آخرین موقعیت مطالعه شما
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                سوره {lastReadSurah.nameArabic} ({lastReadSurah.namePersian})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                آیه {toPersianDigits(lastRead ? lastRead.verseNumber : 1)} از {toPersianDigits(lastReadSurah.versesCount)} • جزء {toPersianDigits(lastReadSurah.juzNumber)} • صفحه {toPersianDigits(lastReadSurah.startPage || 1)}
              </p>
            </div>
          </div>

          <button
            onClick={onContinueReading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
          >
            <span>ادامه قرائت</span>
            <ChevronLeft className="w-4 h-4 mr-1" />
          </button>
        </div>
      </QuranicCard>

      {/* کارت حرفه‌ای و جامع پیشرفت ختم قرآن کریم */}
      <QuranicCard
        id="home-khatm-progress-card"
        darkMode={darkMode}
      >
        <div className="flex items-center justify-between mb-3 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  پیشرفت و عهد روزانهٔ ختم قرآن کریم
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/20">
                  {khatmPlan?.title || 'ختم ۳۰ روزه'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                روز {toPersianDigits(khatmCurrentDay)} از {toPersianDigits(khatmTargetDays)} • پیگیری منظم بر اساس مرزهای حقیقی مصحف شریف
              </p>
            </div>
          </div>

          <button
            onClick={onOpenKhatm}
            className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>مدیریت ختم</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* نوار پیشرفت درصد کل */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span>
                {toPersianDigits(khatmCompletedCount)} صفحه تلاوت شده از {toPersianDigits(khatmTotalPages)} صفحه کل
              </span>
            </span>
            <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 font-sans">
              {toPersianDigits(khatmProgressPercent)}٪
            </span>
          </div>

          <div className="w-full h-3 bg-stone-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-stone-300/50 dark:border-slate-700">
            <div
              className="h-full bg-gradient-to-l from-amber-500 via-amber-400 to-teal-600 rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${Math.max(1, khatmProgressPercent)}%` }}
            />
          </div>

          {/* کارت وضعیت تکلیف تلاوت امروز */}
          {khatmTodaySegment && (
            <div className={`mt-3 p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isKhatmTodayCompleted
                ? darkMode
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                : darkMode
                ? 'bg-slate-800/60 border-slate-700'
                : 'bg-stone-50 border-stone-200'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold flex items-center gap-1 ${
                    isKhatmTodayCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {isKhatmTodayCompleted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>سهمیه تلاوت امروز خوانده شد ✓</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>سهمیه تلاوت امروز (روز {toPersianDigits(khatmCurrentDay)})</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                  صفحه {toPersianDigits(khatmTodaySegment.startPage)} تا {toPersianDigits(khatmTodaySegment.endPage)}
                  {khatmTodaySegment.label ? ` • ${toPersianDigits(khatmTodaySegment.label)}` : ''}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => onNavigateToMushafPage(khatmTodaySegment.startPage)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>تلاوت سهمیه امروز (ص {toPersianDigits(khatmTodaySegment.startPage)})</span>
                </button>

                {!isKhatmTodayCompleted && (
                  <button
                    onClick={handleMarkTodayKhatmCompleted}
                    className="px-3 py-2 rounded-xl border border-amber-500/30 hover:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-xs transition-all active:scale-95"
                  >
                    ثبت انجام
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </QuranicCard>

      {/* آیه منتخب تصادفی با دکمه تغییر تصادفی و پرش به همان آیه */}
      <QuranicCard
        id="home-daily-verse-card"
        darkMode={darkMode}
        highlighted
      >
        <div className="flex items-center justify-between mb-3 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
              آیهٔ منتخب • {selectedRandomVerse.theme}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              سوره {selectedRandomVerse.surahNameArabic} : آیه {toPersianDigits(selectedRandomVerse.verseNumber)}
            </span>
            <button
              onClick={handleShuffleVerse}
              className="p-1 rounded-lg hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 transition-transform active:rotate-180"
              title="آیه تصادفی دیگر"
              aria-label="تغییر آیه تصادفی"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* متن عربی آیه روز */}
        <p
          className="text-right text-lg sm:text-xl font-medium leading-loose text-slate-900 dark:text-slate-100 my-2"
          style={{ fontFamily: "'Amiri', 'Amiri Quran', serif" }}
          dir="rtl"
        >
          {selectedRandomVerse.textArabic}
          <AyahEndMarker verseNumber={selectedRandomVerse.verseNumber} />
        </p>

        {/* ترجمه فارسی */}
        <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 leading-relaxed text-right mt-2" dir="rtl">
          «{selectedRandomVerse.translationPersian}»
        </p>

        {/* کنش‌های آیه منتخب */}
        <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-end gap-2">
          <button
            onClick={() => onPlayVerseAudio(selectedRandomVerse.surahId, selectedRandomVerse.verseNumber)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 font-bold text-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>استماع ترتیل</span>
          </button>

          {/* کلیک مستقیماً به آیه دقیق می‌رود نه فقط ابتدای سوره */}
          <button
            onClick={() => onNavigateToVerse(selectedRandomVerse.surahId, selectedRandomVerse.verseNumber)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>مشاهده آیه در سوره</span>
          </button>
        </div>
      </QuranicCard>

      {/* بخش پیشرفت حفظ قرآن برای کاربر */}
      <QuranicCard
        id="home-memorization-progress"
        darkMode={darkMode}
      >
        <div className="flex items-center justify-between mb-3 border-b border-amber-500/20 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                پیشرفت حفظ و تثبیت قرآن کریم
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                پیگیری و مرور روزانه با روش تکرار منظم
              </p>
            </div>
          </div>

          <button
            onClick={onOpenMemorization}
            className="text-xs font-bold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1"
          >
            <span>ورود به بخش حفظ</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* نوار پیشرفت کل حفظ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>
                {toPersianDigits(memoStats.totalMemorized)} آیه از {toPersianDigits(memoStats.totalVerses)} آیه کل قرآن
              </span>
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-sans font-bold">
              {toPersianDigits(memoStats.percentage)}٪
            </span>
          </div>

          <div className="w-full h-3 bg-stone-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-stone-300/50 dark:border-slate-700">
            <div
              className="h-full bg-gradient-to-l from-amber-500 via-teal-500 to-emerald-600 rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${Math.max(1, memoStats.percentage)}%` }}
            />
          </div>

          {/* آماره‌های سریع حفظ */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="p-2 rounded-xl bg-stone-100/70 dark:bg-slate-800/60 border border-stone-200/60 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">آیات نشان‌شده حفظ</div>
              <div className="text-sm font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                {toPersianDigits(memoStats.totalMemorized)}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-stone-100/70 dark:bg-slate-800/60 border border-stone-200/60 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">جلسات اخیر</div>
              <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                {toPersianDigits(memoStats.recentSessions.length)} جلسه
              </div>
            </div>

            <div className="p-2 rounded-xl bg-stone-100/70 dark:bg-slate-800/60 border border-stone-200/60 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">هدف تثبیت</div>
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                جزء ۳۰
              </div>
            </div>
          </div>
        </div>
      </QuranicCard>

      {/* دسترسی سریع به امکانات (کاشی‌های منظم با بوردرهای قرآنی) */}
      <section id="home-quick-actions" className="space-y-3">
        <h2 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>امکانات و بخش‌های تخصصی قرآن مبین</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* خواندن آیه به آیه */}
          <button
            onClick={onContinueReading}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-teal-500'
                : 'bg-white border-amber-700/20 hover:border-teal-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 w-fit mb-2">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">قرائت آیه به آیه</div>
              <div className="text-[11px] text-slate-400 mt-0.5">۳ ترجمه + تفسیر و واژگان</div>
            </div>
          </button>

          {/* مصحف صفحه‌ای */}
          <button
            onClick={onOpenMushafPage}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-amber-500'
                : 'bg-white border-amber-700/20 hover:border-amber-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">مصحف صفحه‌ای</div>
              <div className="text-[11px] text-slate-400 mt-0.5">۶۰۴ صفحه خط عثمان طه</div>
            </div>
          </button>

          {/* ترتیل صوتی قاریان */}
          <button
            onClick={() => onPlayVerseAudio(lastReadSurah.id, lastRead ? lastRead.verseNumber : 1)}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-teal-500'
                : 'bg-white border-amber-700/20 hover:border-teal-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 w-fit mb-2">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">ترتیل صوتی</div>
              <div className="text-[11px] text-slate-400 mt-0.5">پرهیزگار، عبدالباسط و...</div>
            </div>
          </button>

          {/* دستیار هوشمند تدبّر */}
          <button
            onClick={() => onOpenAI()}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-indigo-500'
                : 'bg-white border-amber-700/20 hover:border-indigo-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">دستیار تدبّر</div>
              <div className="text-[11px] text-slate-400 mt-0.5">پاسخگویی قرآنی و تاریخچه</div>
            </div>
          </button>

          {/* حفظ و لایتنر */}
          <button
            onClick={onOpenMemorization}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-emerald-500'
                : 'bg-white border-amber-700/20 hover:border-emerald-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 w-fit mb-2">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">حفظ قرآن</div>
              <div className="text-[11px] text-slate-400 mt-0.5">تکرار فاصله، آزمون و آمار</div>
            </div>
          </button>

          {/* مدیریت دانلود و آفلاین */}
          <button
            onClick={onOpenOfflineDownloads}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-teal-500'
                : 'bg-white border-amber-700/20 hover:border-teal-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 w-fit mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">مدیریت دانلود آفلاین</div>
              <div className="text-[11px] text-slate-400 mt-0.5">دانلود صوت‌های ترتیل قاریان</div>
            </div>
          </button>

          {/* ختم قرآن */}
          <button
            onClick={onOpenKhatm}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-amber-500'
                : 'bg-white border-amber-700/20 hover:border-amber-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit mb-2">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">برنامه ختم قرآن</div>
              <div className="text-[11px] text-slate-400 mt-0.5">پیگیری منظم جزءخوانی</div>
            </div>
          </button>

          {/* نشان‌شده‌ها و بوکمارک‌ها */}
          <button
            onClick={onOpenBookmarks}
            className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between hover:scale-[1.02] shadow-2xs ${
              darkMode
                ? 'bg-slate-900/90 border-amber-500/25 hover:border-amber-500'
                : 'bg-white border-amber-700/20 hover:border-amber-600'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit mb-2">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">نشان‌شده‌ها</div>
              <div className="text-[11px] text-slate-400 mt-0.5">آیات و یادداشت‌های برگزیده</div>
            </div>
          </button>
        </div>
      </section>
    </main>
  );
};
