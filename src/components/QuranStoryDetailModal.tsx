import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Users,
  Compass,
  Play,
  Share2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Award,
} from 'lucide-react';
import { QuranStory } from '../data/quranStories';
import { toPersianDigits } from '../utils/textNormalization';

interface QuranStoryDetailModalProps {
  story: QuranStory | null;
  onClose: () => void;
  onStartQuiz: (story: QuranStory) => void;
}

export const QuranStoryDetailModal: React.FC<QuranStoryDetailModalProps> = ({
  story,
  onClose,
  onStartQuiz,
}) => {
  const [activeTab, setActiveTab] = useState<'narrative' | 'ayahs' | 'wisdoms'>('narrative');
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  if (!story) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/75 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* سربرگ مودال با طراحی فاخر و شأن قرآنی */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-teal-900/10 via-amber-600/5 to-transparent dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 truncate">
                {story.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium truncate mt-0.5">
                <span>سوره {story.surahName}</span>
                <span>•</span>
                <span>{story.versesRange}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* دکمه شروع آزمون شورتز با آیکون ساده و خوانا */}
            <button
              onClick={() => onStartQuiz(story)}
              className="py-2 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              title="شروع آزمون"
              aria-label="شروع آزمون"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">آزمون این داستان</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
              title="بستن"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* برچسب‌های تب مطالعه برای دسترسی عمیق به جزئیات */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-3 pb-2 border-b border-stone-100 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/40 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('narrative')}
            className={`py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'narrative'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>شرح تفصیلی وقایع و صحنه‌ها</span>
          </button>

          <button
            onClick={() => setActiveTab('ayahs')}
            className={`py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'ayahs'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>فرازها و آیات کلیدی</span>
          </button>

          <button
            onClick={() => setActiveTab('wisdoms')}
            className={`py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'wisdoms'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>حکمت‌ها و درس‌های زندگی ({toPersianDigits(story.wisdoms.length)})</span>
          </button>
        </div>

        {/* بدنه محتوای داستان با فونت فوق‌العاده خوانا و جزئیات فراگیر */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* معرفی اجمالی و شخصیت‌ها */}
          <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/20 dark:via-slate-800/60 dark:to-transparent border border-amber-500/25 space-y-2.5">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {story.subtitle}
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
              {story.summary}
            </p>
            <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>شخصیت‌های محوری:</span>
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {story.character}
              </span>
            </div>
          </div>

          {/* تب ۱: شرح تفصیلی و جزء‌به‌جزء ماجرا */}
          {activeTab === 'narrative' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  فصول و وقایع تفصیلی داستان:
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {toPersianDigits(story.narrative.length)} فصل روایی
                </span>
              </div>

              {story.narrative.map((sec, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-4 sm:p-6 bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-3.5 transition-all hover:border-teal-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {toPersianDigits(idx + 1)}
                      </span>
                      <span>{sec.sectionTitle}</span>
                    </div>
                    {sec.keyAyahRef && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-stone-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                        {sec.keyAyahRef}
                      </span>
                    )}
                  </div>

                  {/* متن تفصیلی با پاراگراف‌بندی و فونت خوانا */}
                  <p className="text-xs sm:text-sm md:text-base text-slate-700 dark:text-slate-200 leading-loose text-justify font-normal">
                    {sec.text}
                  </p>

                  {/* فراز قرآنی عثمان‌طه */}
                  {sec.keyAyahText && (
                    <div className="pt-2">
                      <div
                        className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-slate-900/90 border border-amber-300/40 dark:border-amber-600/30 text-center font-bold text-lg sm:text-2xl text-slate-900 dark:text-amber-100 leading-[2.4] shadow-xs"
                        style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                      >
                        «{sec.keyAyahText}»
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* تب ۲: فقط آیات شریفه و ترجمه */}
          {activeTab === 'ayahs' && (
            <div className="space-y-4">
              <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                فرازهای منتخب قرآن کریم در این سرگذشت:
              </h3>

              {story.narrative
                .filter((s) => s.keyAyahText)
                .map((sec, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl p-5 bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-bold">
                      <span>{sec.sectionTitle}</span>
                      <span>{sec.keyAyahRef}</span>
                    </div>

                    <div
                      className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-center font-bold text-xl sm:text-2xl text-slate-900 dark:text-amber-100 leading-[2.4]"
                      style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                    >
                      «{sec.keyAyahText}»
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {sec.text}
                    </p>
                  </div>
                ))}
            </div>
          )}

          {/* تب ۳: حکمت‌ها و عبرت‌های تربیتی */}
          {activeTab === 'wisdoms' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-700/30 space-y-3">
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>درس‌های معرفتی و عبرت‌های جاودان برای زندگی معاصر:</span>
                </h3>
                <ul className="space-y-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100/95 leading-relaxed">
                  {story.wisdoms.map((w, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {toPersianDigits(i + 1)}
                      </span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* کارت دعوت به آزمون شورتز */}
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-teal-900 dark:text-teal-200">
                    آیا مایلید محفوظات خود از این داستان را بیازمایید؟
                  </div>
                  <div className="text-xs text-teal-700 dark:text-teal-300/80 mt-0.5">
                    شامل {toPersianDigits(story.questions.length)} سوال چهارگزینه‌ای تخصصی همراه با صوت آیات
                  </div>
                </div>

                <button
                  onClick={() => onStartQuiz(story)}
                  className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>آزمون سریع این داستان</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* پانوشت مودال */}
        <div className="p-3.5 sm:p-4 border-t border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/50 flex items-center justify-between gap-2.5 text-xs">
          <span className="text-slate-400 font-medium">
            تعداد آیات: {story.versesRange}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onStartQuiz(story)}
              className="py-2 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>شروع آزمون داستان</span>
            </button>
            <button
              onClick={onClose}
              className="py-2 px-3.5 rounded-xl border border-stone-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-stone-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
