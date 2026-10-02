import React, { useState } from 'react';
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
  CheckCircle,
  HelpCircle,
  Trophy,
  Filter,
  Search,
  ExternalLink,
} from 'lucide-react';
import { QURAN_STORIES, QuranStory } from '../data/quranStories';
import { toPersianDigits } from '../utils/textNormalization';
import { FullscreenShortsQuiz, ShortsQuestion } from './FullscreenShortsQuiz';
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

export const QuranStoriesExplorer: React.FC<QuranStoriesExplorerProps> = ({
  darkMode,
  onNavigateToSurah,
}) => {
  const [selectedStory, setSelectedStory] = useState<QuranStory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isShortsQuizOpen, setIsShortsQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<ShortsQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState('مسابقه داستان‌های قرآنی');

  const filteredStories = QURAN_STORIES.filter(
    (story) =>
      story.title.includes(searchQuery) ||
      story.character.includes(searchQuery) ||
      story.surahName.includes(searchQuery) ||
      story.summary.includes(searchQuery)
  );

  // شروع آزمون شورتز برای یک داستان خاص
  const handleStartStoryQuiz = (story: QuranStory) => {
    const formattedQuestions: ShortsQuestion[] = story.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      contextText: q.contextAyah,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      surahName: q.surahName,
      verseNumber: q.verseNumber,
      categoryBadge: `داستان ${story.title}`,
    }));

    setQuizQuestions(formattedQuestions);
    setQuizTitle(`آزمون داستان ${story.title}`);
    setIsShortsQuizOpen(true);
  };

  // شروع آزمون جامع از تمام داستان‌های قرآنی
  const handleStartAllStoriesQuiz = () => {
    const allQuestions: ShortsQuestion[] = [];
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
        });
      });
    });

    // بر زدن تصادفی سوالات
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    setQuizQuestions(shuffled);
    setQuizTitle('آزمون جامع داستان‌ها و حکمت‌های قرآنی');
    setIsShortsQuizOpen(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* بنر ویژه معرفی و دکمه آزمون جامع شورتز */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-teal-900 via-emerald-950 to-slate-950 text-white shadow-xl border border-teal-500/20">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>گنجینه داستان‌ها و عبرت‌های قرآنی</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-black text-white leading-tight">
            قصه‌های شگفت قرآن و آزمون‌های تدبّر
          </h2>

          <p className="text-xs sm:text-sm text-teal-100/80 leading-relaxed">
            سرگذشت‌های آموزنده پیامبران و اولیای الهی با آیات اصیل قرآن؛ بخوانید، حکمت‌های زندگی بیاموزید و دانسته‌های خود را در آزمون تدبّر به چالش بکشید.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleStartAllStoriesQuiz}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Trophy className="w-4 h-4 text-slate-950 fill-current" />
              <span>آزمون همه داستان‌ها</span>
            </button>

            <span className="text-xs text-teal-200/70 font-medium">
              {toPersianDigits(QURAN_STORIES.length)} داستان منتخب با سوالات تطبیقی
            </span>
          </div>
        </div>

        {/* نقش‌مایه تزئینی پس‌زمینه */}
        <div className="absolute left-4 bottom-4 opacity-15 pointer-events-none hidden sm:block">
          <BookOpen className="w-48 h-48 text-white" />
        </div>
      </div>

      {/* نوار جستجوی داستان‌ها */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در داستان‌ها، شخصیت‌ها (مثلاً یوسف، کهف، سلیمان، مریم...)"
            className="w-full pr-10 pl-4 py-3 rounded-2xl bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* شبکه کارت‌های داستان‌های قرآنی */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStories.map((story) => {
          const IconComponent = ICON_MAP[story.icon] || BookOpen;

          return (
            <QuranicCard
              key={story.id}
              darkMode={darkMode}
              className="p-5 sm:p-6 transition-all hover:shadow-md hover:border-teal-500/40 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                        {story.title}
                      </h3>
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        سوره {story.surahName} • {story.versesRange}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold shrink-0">
                    {toPersianDigits(story.questions.length)} سوال آزمون
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {story.subtitle}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {story.summary}
                </p>

                {/* برچسب شخصیت‌ها */}
                <div className="text-[11px] text-teal-700 dark:text-teal-400/90 font-medium">
                  شخصیت‌ها: {story.character}
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
                  title="آزمون"
                  aria-label="آزمون"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>
              </div>
            </QuranicCard>
          );
        })}
      </div>

      {/* مودال مطالعه کامل داستان، فرازهای آیات و حکمت‌ها */}
      {selectedStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
        >
          <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* سربرگ مودال */}
            <div className="p-4 sm:p-6 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-stone-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                    {selectedStory.title}
                  </h3>
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    سوره {selectedStory.surahName} • {selectedStory.versesRange}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedStory(null)}
                className="w-9 h-9 rounded-full bg-stone-200 dark:bg-slate-700 hover:bg-stone-300 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                title="بستن"
              >
                ✕
              </button>
            </div>

            {/* بدنه محتوای داستان */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              {/* خلاصه داستان */}
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/20 text-xs sm:text-sm text-teal-950 dark:text-teal-100 leading-relaxed font-medium">
                {selectedStory.summary}
              </div>

              {/* بخش‌های روایی به همراه آیات کلیدی */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  فرازهای بنیادین روایت در قرآن کریم:
                </h4>

                {selectedStory.narrative.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-2.5"
                  >
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-teal-600/15 text-teal-600 dark:text-teal-400 text-xs flex items-center justify-center font-bold">
                        {toPersianDigits(idx + 1)}
                      </span>
                      <span>{sec.sectionTitle}</span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {sec.text}
                    </p>

                    {sec.keyAyahText && (
                      <div className="pt-2">
                        <div
                          className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-center font-bold text-base sm:text-lg text-slate-900 dark:text-amber-100 leading-loose"
                          style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                        >
                          «{sec.keyAyahText}»
                        </div>
                        {sec.keyAyahRef && (
                          <div className="text-[10px] text-slate-400 text-left mt-1 font-medium">
                            {sec.keyAyahRef}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* حکمت‌ها و پیام‌های اخلاقی */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-700/30 space-y-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>حکمت‌ها و درس‌های معنوی برای زندگی:</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-amber-950 dark:text-amber-100/90 leading-relaxed list-disc list-inside">
                  {selectedStory.wisdoms.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* پانوشت دکمه شروع آزمون شورتز */}
            <div className="p-4 sm:p-6 border-t border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedStory(null)}
                className="py-2.5 px-4 rounded-xl border border-stone-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
              >
                بستن
              </button>

              <button
                onClick={() => {
                  const s = selectedStory;
                  setSelectedStory(null);
                  handleStartStoryQuiz(s);
                }}
                className="py-2.5 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>شروع آزمون</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* کامپوننت آزمون شورتز تمام‌صفحه */}
      <FullscreenShortsQuiz
        isOpen={isShortsQuizOpen}
        onClose={() => setIsShortsQuizOpen(false)}
        questions={quizQuestions}
        title={quizTitle}
      />
    </div>
  );
};
