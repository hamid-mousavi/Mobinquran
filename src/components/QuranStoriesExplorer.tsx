import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Crown,
  Sparkles,
  Compass,
  Sun,
  Shield,
  Heart,
  Anchor,
  Play,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Trophy,
  Filter,
  Search,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Clock,
  Award,
  Flame,
  Check,
} from 'lucide-react';
import { QURAN_STORIES, QuranStory, StoryCategory } from '../data/quranStories';
import { toPersianDigits } from '../utils/textNormalization';
import { RealisticQuizView, QuizQuestionItem } from './RealisticQuizView';
import { QuranStoryDetailModal } from './QuranStoryDetailModal';
import { QuranicCard } from './QuranicOrnament';

interface QuranStoriesExplorerProps {
  darkMode: boolean;
  onNavigateToSurah?: (surahId: number) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Crown,
  Sparkles,
  Compass,
  Sun,
  Shield,
  Heart,
  Anchor,
};

type FilterCategoryType = 'all' | StoryCategory | 'bookmarked' | 'read';

const CATEGORY_NAMES: Record<FilterCategoryType, { title: string; icon: string }> = {
  all: { title: 'همه داستان‌ها', icon: '🌟' },
  prophets: { title: 'پیامبران الهی', icon: '🕊️' },
  wisdom_lessons: { title: 'حکمت‌ها و عبرت‌ها', icon: '📜' },
  women: { title: 'بانوان قرآنی', icon: '🌸' },
  miracles_faith: { title: 'معجزات و ایمان', icon: '⚡' },
  bookmarked: { title: 'نشان‌شده‌ها', icon: '🔖' },
  read: { title: 'مطالعه‌شده‌ها', icon: '✅' },
};

export const QuranStoriesExplorer: React.FC<QuranStoriesExplorerProps> = ({
  darkMode,
  onNavigateToSurah,
}) => {
  const [selectedStory, setSelectedStory] = useState<QuranStory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategoryType>('all');
  const [isRealisticQuizOpen, setIsRealisticQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionItem[]>([]);
  const [quizTitle, setQuizTitle] = useState('مسابقه داستان‌های قرآنی');
  const [currentQuizStory, setCurrentQuizStory] = useState<QuranStory | null>(null);

  // وضعیت بوک‌مارک‌ها و خوانده‌شده‌ها
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('quran_bookmarked_stories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('quran_read_stories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // بارگذاری مجدد استیت از حافظه در صورت تغییر در مودال
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const savedBm = localStorage.getItem('quran_bookmarked_stories');
        if (savedBm) setBookmarkedIds(JSON.parse(savedBm));
        const savedRd = localStorage.getItem('quran_read_stories');
        if (savedRd) setReadIds(JSON.parse(savedRd));
      } catch {}
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // تازه‌سازی وضعیت با بسته شدن مودال
  const handleCloseModal = () => {
    setSelectedStory(null);
    try {
      const savedBm = localStorage.getItem('quran_bookmarked_stories');
      if (savedBm) setBookmarkedIds(JSON.parse(savedBm));
      const savedRd = localStorage.getItem('quran_read_stories');
      if (savedRd) setReadIds(JSON.parse(savedRd));
    } catch {}
  };

  const toggleBookmark = (storyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let updated: string[];
      if (bookmarkedIds.includes(storyId)) {
        updated = bookmarkedIds.filter((id) => id !== storyId);
      } else {
        updated = [...bookmarkedIds, storyId];
      }
      setBookmarkedIds(updated);
      localStorage.setItem('quran_bookmarked_stories', JSON.stringify(updated));
    } catch {}
  };

  // محاسبه آمار دسته‌بندی‌ها
  const counts: Record<FilterCategoryType, number> = {
    all: QURAN_STORIES.length,
    prophets: QURAN_STORIES.filter((s) => s.category === 'prophets').length,
    wisdom_lessons: QURAN_STORIES.filter((s) => s.category === 'wisdom_lessons').length,
    women: QURAN_STORIES.filter((s) => s.category === 'women').length,
    miracles_faith: QURAN_STORIES.filter((s) => s.category === 'miracles_faith').length,
    bookmarked: bookmarkedIds.length,
    read: readIds.length,
  };

  // داستان ویژه روز
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % QURAN_STORIES.length;
  const featuredStory = QURAN_STORIES[dayIndex] || QURAN_STORIES[0];

  // فیلتر کردن داستان‌ها
  const filteredStories = QURAN_STORIES.filter((story) => {
    const matchesSearch =
      story.title.includes(searchQuery) ||
      story.character.includes(searchQuery) ||
      story.surahName.includes(searchQuery) ||
      story.summary.includes(searchQuery);

    if (!matchesSearch) return false;

    if (activeCategory === 'all') return true;
    if (activeCategory === 'bookmarked') return bookmarkedIds.includes(story.id);
    if (activeCategory === 'read') return readIds.includes(story.id);
    return story.category === activeCategory;
  });

  // درصد پیشرفت مطالعه داستان‌ها
  const readPercent = Math.round((readIds.length / QURAN_STORIES.length) * 100);

  // شروع آزمون تخصصی برای یک داستان خاص
  const handleStartStoryQuiz = (story: QuranStory) => {
    setCurrentQuizStory(story);
    const formattedQuestions: QuizQuestionItem[] = story.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      contextText: q.contextAyah,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      surahName: q.surahName,
      verseNumber: q.verseNumber,
      categoryBadge: `داستان ${story.title}`,
      fullVerseText: q.contextAyah,
      fullVerseTranslation: q.explanation,
      isBlankFill: false,
    }));

    setQuizQuestions(formattedQuestions);
    setQuizTitle(`آزمون داستان ${story.title}`);
    setIsRealisticQuizOpen(true);
  };

  // شروع آزمون جامع از تمام داستان‌های قرآنی
  const handleStartAllStoriesQuiz = () => {
    setCurrentQuizStory(null);
    const allQuestions: QuizQuestionItem[] = [];
    QURAN_STORIES.forEach((story) => {
      story.questions.forEach((q) => {
        allQuestions.push({
          id: q.id,
          prompt: q.prompt,
          contextText: q.contextAyah,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          surahName: q.surahName,
          verseNumber: q.verseNumber,
          categoryBadge: `داستان ${story.title}`,
          fullVerseText: q.contextAyah,
          fullVerseTranslation: q.explanation,
          isBlankFill: false,
        });
      });
    });

    // بر زدن تصادفی سوالات
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    setQuizQuestions(shuffled);
    setQuizTitle('آزمون جامع داستان‌ها و حکمت‌های قرآنی');
    setIsRealisticQuizOpen(true);
  };

  const handleRestartQuiz = () => {
    if (currentQuizStory) {
      handleStartStoryQuiz(currentQuizStory);
    } else {
      handleStartAllStoriesQuiz();
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* بنر ویژه معرفی و دکمه آزمون جامع شورتز */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-teal-900 via-emerald-950 to-slate-950 text-white shadow-xl border border-teal-500/20">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>گنجینه داستان‌ها، عبرت‌ها و معارف قرآنی</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-black text-white leading-tight">
            قصه‌های شگفت قرآن و آزمون‌های تدبّر
          </h2>

          <p className="text-xs sm:text-sm text-teal-100/80 leading-relaxed">
            سرگذشت‌های آموزنده پیامبران، بانوان برگزیده و اولیای الهی با آیات اصیل قرآن؛ پرده‌به‌پرده بخوانید، با نوای تلاوت آیه مأنوس شوید، حکمت‌های زندگی بیاموزید و دانسته‌های خود را در آزمون تدبّر به چالش بکشید.
          </p>

          {/* نوار کوچک پیشرفت مطالعه داستان‌ها */}
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 space-y-2 max-w-md">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-teal-200">پیشرفت مطالعه داستان‌ها</span>
              <span className="text-amber-300">
                {toPersianDigits(readIds.length)} از {toPersianDigits(QURAN_STORIES.length)} داستان ({toPersianDigits(readPercent)}٪)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${readPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleStartAllStoriesQuiz}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Trophy className="w-4 h-4 text-slate-950 fill-current" />
              <span>آزمون جامع همه داستان‌ها</span>
            </button>

            <span className="text-xs text-teal-200/80 font-medium">
              {toPersianDigits(QURAN_STORIES.length)} داستان منتخب با سوالات تطبیقی
            </span>
          </div>
        </div>

        {/* نقش‌مایه تزئینی پس‌زمینه */}
        <div className="absolute left-4 bottom-4 opacity-15 pointer-events-none hidden sm:block">
          <BookOpen className="w-48 h-48 text-white" />
        </div>
      </div>

      {/* کارت داستان برگزیده روز (Featured Daily Story) */}
      {featuredStory && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-transparent dark:from-amber-950/30 dark:via-slate-800/80 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px] border border-amber-500/30">
                ⭐ داستان برگزیده امروز
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                سوره {featuredStory.surahName} • {featuredStory.versesRange}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
              {featuredStory.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
              {featuredStory.summary}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedStory(featuredStory)}
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>مطالعه داستان امروز</span>
            </button>
            <button
              type="button"
              onClick={() => handleStartStoryQuiz(featuredStory)}
              className="p-2.5 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="آزمون این داستان"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* نوار جستجو و تب‌های دسته‌بندی موضوعی */}
      <div className="space-y-3">
        {/* نوار جستجو */}
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در داستان‌ها، پیامبران، شخصیت‌ها (مثلاً یوسف، کهف، سلیمان، مریم، معراج...)"
            className="w-full pr-10 pl-4 py-3 rounded-2xl bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-all"
          />
        </div>

        {/* فیلترهای تب‌های دسته‌بندی موضوعی */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
          {(Object.keys(CATEGORY_NAMES) as FilterCategoryType[]).map((catKey) => {
            const count = counts[catKey];
            const meta = CATEGORY_NAMES[catKey];
            const isActive = activeCategory === catKey;

            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setActiveCategory(catKey)}
                className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-slate-900 border-stone-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-200/60 dark:hover:bg-slate-800/80'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-stone-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {toPersianDigits(count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* نتایج و شبکه کارت‌های داستان‌های قرآنی */}
      {filteredStories.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            داستانی با این مشخصات یافت نشد
          </h4>
          <p className="text-xs text-slate-400">
            می‌توانید کلمه جستجو را تغییر دهید یا به دسته‌بندی «همه داستان‌ها» بازگردید.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="py-2 px-4 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-all cursor-pointer"
          >
            مشاهده همه داستان‌ها
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStories.map((story) => {
            const IconComponent = ICON_MAP[story.icon] || BookOpen;
            const isBookmarked = bookmarkedIds.includes(story.id);
            const isRead = readIds.includes(story.id);

            return (
              <QuranicCard
                key={story.id}
                darkMode={darkMode}
                className="p-5 sm:p-6 transition-all hover:shadow-md hover:border-teal-500/40 flex flex-col justify-between relative group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                            {story.title}
                          </h3>
                          {isRead && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                              خوانده شد ✓
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          سوره {story.surahName} • {story.versesRange}
                        </div>
                      </div>
                    </div>

                    {/* دکمه بوک‌مارک فوری */}
                    <button
                      type="button"
                      onClick={(e) => toggleBookmark(story.id, e)}
                      className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                        isBookmarked
                          ? 'text-amber-500 bg-amber-500/10'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-slate-800'
                      }`}
                      title={isBookmarked ? 'حذف نشان' : 'نشان کردن'}
                      aria-label="نشان کردن"
                    >
                      {isBookmarked ? (
                        <BookmarkCheck className="w-4 h-4 fill-current" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {story.subtitle}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                    {story.summary}
                  </p>

                  {/* برچسب شخصیت‌ها و اطلاعات تکمیلی */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="text-teal-700 dark:text-teal-400 font-medium truncate">
                      شخصیت‌ها: {story.character}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {story.estimatedReadTimeMinutes && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{toPersianDigits(story.estimatedReadTimeMinutes)} دقیقه</span>
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-slate-800 font-bold text-[10px]">
                        {toPersianDigits(story.questions.length)} سوال
                      </span>
                    </div>
                  </div>
                </div>

                {/* دکمه‌های اقدام برای هر داستان */}
                <div className="flex items-center gap-2 pt-4 mt-4 border-t border-stone-100 dark:border-slate-800">
                  <button
                    onClick={() => setSelectedStory(story)}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>مطالعه داستان</span>
                  </button>

                  <button
                    onClick={() => handleStartStoryQuiz(story)}
                    className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition-all cursor-pointer active:scale-95 shadow-sm shrink-0"
                    title="آزمون این داستان"
                    aria-label="آزمون"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              </QuranicCard>
            );
          })}
        </div>
      )}

      {/* مودال مطالعه تفصیلی و با جزئیات داستان */}
      {selectedStory && (
        <QuranStoryDetailModal
          story={selectedStory}
          onClose={handleCloseModal}
          onStartQuiz={(story) => {
            setSelectedStory(null);
            handleStartStoryQuiz(story);
          }}
          onNavigateToSurah={onNavigateToSurah}
        />
      )}

      {/* کامپوننت آزمون استاندارد و تخصصی داستان‌های قرآنی */}
      {isRealisticQuizOpen && (
        <RealisticQuizView
          questions={quizQuestions}
          title={quizTitle}
          totalQuizTimeSeconds={Math.round(quizQuestions.length * 45)}
          isTimerEnabled={true}
          onClose={() => setIsRealisticQuizOpen(false)}
          onRestart={handleRestartQuiz}
        />
      )}
    </div>
  );
};
