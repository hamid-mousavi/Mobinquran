import React, { useState, useMemo } from 'react';
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
  ArrowLeft,
  ChevronLeft,
  Layers,
  Clock,
  Sparkle,
  Compass,
} from 'lucide-react';
import { Surah, Verse, AppSettings } from '../types';
import { AyahEndMarker } from './QuranReader';

interface QuranHomePageProps {
  surahs: Surah[];
  lastRead: { surahId: number; verseNumber: number; pageNumber?: number } | null;
  onContinueReading: () => void;
  onSelectSurah: (surah: Surah) => void;
  onNavigateToJuz: (juzNumber: number) => void;
  onOpenMushafPage: () => void;
  onOpenSearch: () => void;
  onOpenBookmarks: () => void;
  onOpenKhatm: () => void;
  onOpenAI: (verse?: Verse) => void;
  onOpenMemorization: () => void;
  onPlayVerseAudio: (surahId: number, verseNumber: number) => void;
  darkMode: boolean;
}

// آیات برگزیده روز جهت ایجاد انس معنوی
const DAILY_VERSES = [
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
    theme: 'آرامش دل با یاد خداوند',
  },
  {
    surahId: 65,
    surahNameArabic: 'الطَّلَاق',
    verseNumber: 3,
    textArabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ۚ إِنَّ اللَّهَ بَالِغُ أَمْرِهِ',
    translationPersian: 'و هر کس بر خداوند توکل کند، او برایش کافی است؛ بی‌تردید خداوند فرمان و کار خویش را به سرانجام می‌رساند.',
    theme: 'توکل و کفایت پروردگار',
  },
];

// ۳۰ جزء قرآن و آغاز هر جزء
const JUZ_STARTS = [
  { juz: 1, surahId: 1, surahName: 'حمد', ayah: 1, page: 1 },
  { juz: 2, surahId: 2, surahName: 'بقره', ayah: 142, page: 22 },
  { juz: 3, surahId: 2, surahName: 'بقره', ayah: 253, page: 42 },
  { juz: 4, surahId: 3, surahName: 'آل عمران', ayah: 93, page: 62 },
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
  onNavigateToJuz,
  onOpenMushafPage,
  onOpenSearch,
  onOpenBookmarks,
  onOpenKhatm,
  onOpenAI,
  onOpenMemorization,
  onPlayVerseAudio,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'surahs' | 'juz'>('surahs');
  const [surahFilter, setSurahFilter] = useState<'all' | 'meccan' | 'medinan'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // آیه منتخب روز بر مبنای تاریخ جاری
  const dailyVerse = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
  }, []);

  // سوره آخرین مطالعه
  const lastReadSurah = useMemo(() => {
    if (!lastRead) return surahs[0];
    return surahs.find((s) => s.id === lastRead.surahId) || surahs[0];
  }, [lastRead, surahs]);

  // فیلتر سوره‌ها
  const filteredSurahs = useMemo(() => {
    return surahs.filter((s) => {
      // فیلتر مکی / مدنی
      if (surahFilter === 'meccan' && s.revelationType !== 'Meccan') return false;
      if (surahFilter === 'medinan' && s.revelationType !== 'Medinan') return false;

      // فیلتر جستجو
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        s.nameArabic.toLowerCase().includes(q) ||
        (s.namePersian && s.namePersian.toLowerCase().includes(q)) ||
        (s.englishName && s.englishName.toLowerCase().includes(q)) ||
        String(s.id).includes(q)
      );
    });
  }, [surahs, surahFilter, searchQuery]);

  return (
    <div
      id="quran-home-page"
      className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-28 space-y-7 animate-fadeIn"
      dir="rtl"
    >
      {/* ۱. کتیبه معنوی سردر صفحه اصلی */}
      <section
        id="home-hero-banner"
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 text-center border-2 shadow-lg transition-all ${
          darkMode
            ? 'bg-gradient-to-b from-slate-900 via-teal-950/50 to-slate-900 border-amber-500/35 text-slate-100 shadow-teal-950/40'
            : 'bg-gradient-to-b from-amber-50/80 via-stone-50 to-teal-50/40 border-amber-600/30 text-slate-800 shadow-stone-200'
        }`}
      >
        <div className="absolute inset-1.5 rounded-2xl border border-dashed border-amber-500/25 pointer-events-none" />

        {/* سرآغاز بسم الله */}
        <div
          className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-300 drop-shadow-xs mb-2 tracking-wide"
          style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
        >
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-teal-800 dark:text-teal-200 mt-1">
          مصحف جامع و هوشمند قرآن مبین
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
          همراه تدبّر در کلام وحی، ترتیل اساتید، مصحف عثمان طه و دستیار هوشمند قرآنی
        </p>
      </section>

      {/* ۲. کارت شاخص «ادامهٔ آخرین تلاوت» (Continue Reading) */}
      <section id="home-last-read-card">
        <div
          className={`p-5 sm:p-6 rounded-3xl border-2 transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            darkMode
              ? 'bg-slate-900/90 border-teal-600/40 hover:border-teal-500 shadow-slate-950/60'
              : 'bg-white border-teal-600/30 hover:border-teal-600/50 shadow-teal-900/5'
          }`}
        >
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
                آیه {lastRead ? lastRead.verseNumber.toLocaleString('fa-IR') : '۱'} از {lastReadSurah.versesCount.toLocaleString('fa-IR')} • جزء {lastReadSurah.juzNumber.toLocaleString('fa-IR')} • صفحه {lastReadSurah.startPage?.toLocaleString('fa-IR') || '۱'}
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
      </section>

      {/* ۳. حکمت و آیهٔ منتخب روز (Daily Verse & Reflection) */}
      <section
        id="home-daily-verse-card"
        className={`p-5 sm:p-6 rounded-3xl border transition-all ${
          darkMode
            ? 'bg-slate-900/60 border-amber-500/25'
            : 'bg-gradient-to-br from-amber-50/50 to-stone-50 border-amber-500/20'
        }`}
      >
        <div className="flex items-center justify-between mb-3 border-b border-stone-200/60 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
              آیهٔ منتخب روز • {dailyVerse.theme}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            سوره {dailyVerse.surahNameArabic} : آیه {dailyVerse.verseNumber.toLocaleString('fa-IR')}
          </span>
        </div>

        {/* متن عربی آیه روز با خط مصحفی */}
        <p
          className="text-right text-lg sm:text-xl font-medium leading-loose text-slate-900 dark:text-slate-100 my-2"
          style={{ fontFamily: "'Amiri', serif" }}
          dir="rtl"
        >
          {dailyVerse.textArabic}
          <AyahEndMarker verseNumber={dailyVerse.verseNumber} />
        </p>

        {/* ترجمه فارسی */}
        <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 leading-relaxed text-right mt-2" dir="rtl">
          «{dailyVerse.translationPersian}»
        </p>

        {/* کنش‌های سریع آیه روز */}
        <div className="mt-4 pt-3 border-t border-stone-200/50 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={() => onPlayVerseAudio(dailyVerse.surahId, dailyVerse.verseNumber)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>استماع ترتیل</span>
          </button>

          <button
            onClick={() => {
              const s = surahs.find((x) => x.id === dailyVerse.surahId);
              if (s) onSelectSurah(s);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/10 hover:bg-teal-600/20 text-teal-700 dark:text-teal-300 font-bold text-xs transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>مشاهده در سوره</span>
          </button>
        </div>
      </section>

      {/* ۴. دسترسی سریع به امکانات (خدمات قرآنی در کاشی‌های منظم) */}
      <section id="home-quick-actions" className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
          امکانات و خدمات قرآنی
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* خواندن آیه به آیه */}
          <button
            onClick={onContinueReading}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-teal-500' : 'bg-white border-stone-200 hover:border-teal-600 shadow-xs'
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
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-amber-500' : 'bg-white border-stone-200 hover:border-amber-600 shadow-xs'
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
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-teal-500' : 'bg-white border-stone-200 hover:border-teal-600 shadow-xs'
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

          {/* جستجوی پیشرفته */}
          <button
            onClick={onOpenSearch}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500' : 'bg-white border-stone-200 hover:border-blue-600 shadow-xs'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit mb-2">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">جستجوی پیشرفته</div>
              <div className="text-[11px] text-slate-400 mt-0.5">در آیات، ترجمه‌ها و ریشه‌ها</div>
            </div>
          </button>

          {/* ختم قرآن */}
          <button
            onClick={onOpenKhatm}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-emerald-500' : 'bg-white border-stone-200 hover:border-emerald-600 shadow-xs'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit mb-2">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">برنامه ختم قرآن</div>
              <div className="text-[11px] text-slate-400 mt-0.5">پیگیری منظم جزءخوانی</div>
            </div>
          </button>

          {/* دستیار هوشمند تدبّر */}
          <button
            onClick={() => onOpenAI()}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500' : 'bg-white border-stone-200 hover:border-indigo-600 shadow-xs'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">دستیار تدبّر</div>
              <div className="text-[11px] text-slate-400 mt-0.5">پاسخگویی قرآنی هوشمند</div>
            </div>
          </button>

          {/* نشان‌شده‌ها و بوکمارک‌ها */}
          <button
            onClick={onOpenBookmarks}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-amber-500' : 'bg-white border-stone-200 hover:border-amber-600 shadow-xs'
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

          {/* جعبه لایتنر و حفظ قرآن */}
          <button
            onClick={onOpenMemorization}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] ${
              darkMode ? 'bg-slate-900 border-slate-800 hover:border-teal-500' : 'bg-white border-stone-200 hover:border-teal-600 shadow-xs'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 w-fit mb-2">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm">حفظ و لایتنر</div>
              <div className="text-[11px] text-slate-400 mt-0.5">تکرار فاصله و تثبیت آیه</div>
            </div>
          </button>
        </div>
      </section>

      {/* ۵. مرورگر جامع سوره‌ها و ۳۰ جزء */}
      <section id="home-surahs-navigator" className="space-y-4">
        {/* تب‌های انتخاب: ۱۱۴ سوره یا ۳۰ جزء */}
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('surahs')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'surahs'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              فهرست ۱۱۴ سوره
            </button>
            <button
              onClick={() => setActiveTab('juz')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'juz'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              فهرست ۳۰ جزء
            </button>
          </div>

          {/* فیلتر مکی و مدنی (فقط در تب سوره‌ها) */}
          {activeTab === 'surahs' && (
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <button
                onClick={() => setSurahFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  surahFilter === 'all'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                همه ({surahs.length})
              </button>
              <button
                onClick={() => setSurahFilter('meccan')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  surahFilter === 'meccan'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                مکی
              </button>
              <button
                onClick={() => setSurahFilter('medinan')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  surahFilter === 'medinan'
                    ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                مدنی
              </button>
            </div>
          )}
        </div>

        {/* فیلد جستجوی سریع سوره */}
        {activeTab === 'surahs' && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی سوره با نام یا شماره..."
              className={`w-full pr-10 pl-4 py-2.5 rounded-2xl text-xs sm:text-sm border focus:outline-hidden focus:ring-2 focus:ring-teal-500 ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-stone-200 text-slate-800'
              }`}
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          </div>
        )}

        {/* محتوای تب: شبکهٔ سوره‌ها */}
        {activeTab === 'surahs' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredSurahs.map((surah) => {
              const isCurrent = lastRead && lastRead.surahId === surah.id;
              return (
                <button
                  key={surah.id}
                  onClick={() => onSelectSurah(surah)}
                  className={`p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between group hover:scale-[1.01] ${
                    isCurrent
                      ? darkMode
                        ? 'bg-teal-950/40 border-teal-600'
                        : 'bg-teal-50/80 border-teal-500'
                      : darkMode
                      ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      : 'bg-white border-stone-200/90 hover:border-stone-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isCurrent
                          ? 'bg-teal-600 text-white'
                          : darkMode
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-stone-100 text-slate-700'
                      }`}
                    >
                      {surah.id}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        سوره {surah.nameArabic}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {surah.namePersian} • {surah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
                      </div>
                    </div>
                  </div>

                  <div className="text-left text-[11px] text-slate-400">
                    <div className="font-medium">{surah.versesCount} آیه</div>
                    <div>جزء {surah.juzNumber}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* محتوای تب: فهرست ۳۰ جزء */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {JUZ_STARTS.map((j) => (
              <button
                key={j.juz}
                onClick={() => onNavigateToJuz(j.juz)}
                className={`p-3.5 rounded-2xl border text-center transition-all hover:scale-[1.02] ${
                  darkMode ? 'bg-slate-900 border-slate-800 hover:border-teal-500' : 'bg-white border-stone-200 hover:border-teal-600 shadow-xs'
                }`}
              >
                <div className="text-xs font-bold text-teal-700 dark:text-teal-300 mb-1">
                  جزء {j.juz.toLocaleString('fa-IR')}
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  سوره {j.surahName}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  آیه {j.ayah.toLocaleString('fa-IR')} • صفحه {j.page.toLocaleString('fa-IR')}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
