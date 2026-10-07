import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  ChevronLeft,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  StreakData,
  WeekDayStatus,
  ReviewAyahItem,
  recordUserActivity,
} from '../services/activityTracker';
import { toPersianDigits } from '../utils/textNormalization';

interface DailyCompanionCardProps {
  streakData: StreakData;
  weekStatus: WeekDayStatus[];
  dueReviewAyahs: ReviewAyahItem[];
  onOpenStreakModal: () => void;
  onOpenReviewModal: () => void;
  darkMode: boolean;
}

export const DailyCompanionCard: React.FC<DailyCompanionCardProps> = ({
  streakData,
  weekStatus,
  dueReviewAyahs,
  onOpenStreakModal,
  onOpenReviewModal,
  darkMode,
}) => {
  const [showCelebration, setShowCelebration] = useState(false);

  // ثبت همراهی امروز با یک لمس سریع
  const handleOneTouchLog = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordUserActivity('read');
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2500);
  };

  return (
    <section
      aria-label="استمرار روزانه با قرآن"
      onClick={onOpenStreakModal}
      className="group rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs hover:shadow-sm backdrop-blur-md transition-all hover:border-amber-500/40 cursor-pointer"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2.5 sm:gap-4 flex-wrap">
        {/* سمت راست: نشانگر جمع‌وجور استمرار */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
              streakData.currentStreak > 0
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/20'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-400'
            }`}
          >
            <Flame className={`w-4 h-4 sm:w-5 sm:h-5 ${streakData.currentStreak > 0 ? 'fill-current animate-pulse' : ''}`} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {streakData.currentStreak > 0
                  ? `${toPersianDigits(streakData.currentStreak)} روز استمرار`
                  : 'استمرار روزانه'}
              </span>

              {streakData.todayCompleted && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>ثبت شد</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden xs:block">
              {showCelebration
                ? 'همراهی امروز شما با موفقیت ثبت شد 🔥'
                : streakData.todayCompleted
                ? `رکورد: ${toPersianDigits(streakData.bestStreak)} روز`
                : 'یک لمس برای ثبت انس امروز'}
            </p>
          </div>
        </div>

        {/* وسط: ۷ نشانگر شنبه تا جمعه */}
        <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-xl bg-stone-50/80 dark:bg-slate-800/40">
          {weekStatus.map((day) => (
            <div key={day.dateKey} className="flex flex-col items-center gap-0.5 px-1">
              <span
                className={`text-[9px] font-bold ${
                  day.isToday
                    ? 'text-teal-600 dark:text-teal-400 font-black'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {day.dayLabel}
              </span>
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                  day.isCompleted
                    ? 'bg-emerald-500 text-white'
                    : day.isToday
                    ? 'border-2 border-teal-500 bg-teal-500/10'
                    : 'bg-stone-200/70 dark:bg-slate-800'
                }`}
              >
                {day.isCompleted && <span className="text-[8px] font-black leading-none">✓</span>}
              </div>
            </div>
          ))}
        </div>

        {/* سمت چپ: دکمه‌های اقدام تمیز و کم‌حجم */}
        <div className="flex items-center gap-2 mr-auto shrink-0">
          {/* نشانگر مرور لایتنر اگر آیه‌ای برای مرور باشد */}
          {dueReviewAyahs.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReviewModal();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="ورود به میزکار مرور آیات به روش جعبه لایتنر"
            >
              <RotateCcw className="w-3 h-3 text-amber-500" />
              <span>{toPersianDigits(dueReviewAyahs.length)} مرور</span>
            </button>
          )}

          {/* دکمه ثبت سریع یک‌لمسی اگر امروز ثبت نشده باشد */}
          {!streakData.todayCompleted && (
            <button
              type="button"
              onClick={handleOneTouchLog}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
              title="ثبت همراهی امروز با یک لمس"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span className="text-[11px]">ثبت امروز</span>
            </button>
          )}

          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
        </div>
      </div>
    </section>
  );
};
