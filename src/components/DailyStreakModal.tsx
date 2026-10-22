import React, { useState } from 'react';
import {
  X,
  Flame,
  Trophy,
  Calendar,
  CheckCircle2,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import {
  StreakData,
  WeekDayStatus,
  recordUserActivity,
  getActivities,
} from '../services/activityTracker';
import { toPersianDigits } from '../utils/textNormalization';
import {
  localDateKey,
  getPersianDateParts,
  getPersianMonthData,
  PERSIAN_WEEKDAY_NAMES,
  PERSIAN_WEEKDAY_SHORT,
} from '../utils/date';

interface DailyStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakData: StreakData;
  weekStatus?: WeekDayStatus[];
  darkMode?: boolean;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  isOpen,
  onClose,
  streakData,
  darkMode,
}) => {
  // وضعیت ناوبری ماه‌های تقویم شمسی
  const todayPersian = getPersianDateParts();
  const [viewYear, setViewYear] = useState<number>(todayPersian.year);
  const [viewMonth, setViewMonth] = useState<number>(todayPersian.month);

  if (!isOpen) return null;

  const activities = getActivities();
  const todayKey = localDateKey();

  // داده‌های ماه شمسی جاری جهت رندر شبکه روزها
  const monthData = getPersianMonthData(viewYear, viewMonth);

  // ناوبری بین ماه‌های هجری شمسی
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleTodayMonth = () => {
    setViewYear(todayPersian.year);
    setViewMonth(todayPersian.month);
  };

  // محاسبه آمار ماه شمسی انتخابی
  const activeDaysThisMonth = monthData.days.filter(
    (d) => activities[d.dateKey] && activities[d.dateKey].count > 0
  ).length;
  const monthPercentage = Math.round((activeDaysThisMonth / monthData.days.length) * 100);

  const handleMarkToday = () => {
    recordUserActivity('read');
  };

  const isCurrentMonth = viewYear === todayPersian.year && viewMonth === todayPersian.month;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl sm:max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[94vh] flex flex-col text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* سربرگ مودال */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200/80 dark:border-slate-800/80 bg-stone-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <Flame className="w-6 h-6 fill-current animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>همراهی و استمرار قرآنی</span>
                <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {toPersianDigits(streakData.currentStreak)} روز پیاپی
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تقویم هجری شمسی انس با کلام وحی و ثبت مداومت روزانه تلاوت قرآن کریم
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-stone-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوای تقویم و آمار استمرار */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* کارت آمار ۳گانه زنجیره */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-3 sm:p-4 rounded-2xl bg-amber-50/50 dark:bg-slate-800/60 border border-amber-200/60 dark:border-slate-700/60 space-y-1">
              <div className="flex items-center justify-center text-amber-500 mb-0.5">
                <Flame className="w-5 h-5 fill-current" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                {toPersianDigits(streakData.currentStreak)}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                روز پیاپی فعلی
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-1">
              <div className="flex items-center justify-center text-teal-600 dark:text-teal-400 mb-0.5">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                {toPersianDigits(streakData.bestStreak)}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 font-medium">بهترین رکورد</div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-1">
              <div className="flex items-center justify-center text-indigo-500 mb-0.5">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                {toPersianDigits(streakData.totalDaysActive)}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 font-medium">کل روزهای انس</div>
            </div>
          </div>

          {/* وضعیت همراهی امروز و ثبت با یک لمس */}
          <div className="p-3 sm:p-4 rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-stone-50/80 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  streakData.todayCompleted
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-stone-200 dark:bg-slate-700 text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                  {streakData.todayCompleted
                    ? 'همراهی امروز شما ثبت شده است ✓'
                    : 'امروز هنوز همراهی خود را ثبت نکرده‌اید'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  امروز: {todayPersian.weekdayName} {toPersianDigits(todayPersian.day)} {todayPersian.monthName} {toPersianDigits(todayPersian.year)} هجری شمسی
                </span>
              </div>
            </div>

            {!streakData.todayCompleted && (
              <button
                type="button"
                onClick={handleMarkToday}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>ثبت تلاوت امروز</span>
              </button>
            )}
          </div>

          {/* کادر تقویم هجری شمسی ماهانه */}
          <div className="p-3.5 sm:p-5 rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            {/* نوار کنترل ماه شمسی */}
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  {monthData.monthName} {toPersianDigits(monthData.year)}
                </span>
                {isCurrentMonth && (
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20">
                    ماه جاری
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {!isCurrentMonth && (
                  <button
                    type="button"
                    onClick={handleTodayMonth}
                    className="px-2.5 py-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    برو به امروز
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="ماه بعدی"
                  aria-label="ماه بعدی"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="ماه قبلی"
                  aria-label="ماه قبلی"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* سرفصل روزهای هفته هجری شمسی (ش، ی، د، س، چ، پ، ج) */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {PERSIAN_WEEKDAY_SHORT.map((dayName, idx) => (
                <div
                  key={idx}
                  className={`text-[11px] sm:text-xs font-bold py-1 ${
                    idx === 6 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* ماتریس روزهای ماه */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {/* سلول‌های خالی روزهای شروع ماه */}
              {Array.from({ length: monthData.firstDayWeekday }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* روزهای تقویم */}
              {monthData.days.map((day) => {
                const activity = activities[day.dateKey];
                const hasRead = activity && activity.count > 0;
                const isToday = day.dateKey === todayKey;

                return (
                  <div
                    key={day.persianDay}
                    className={`aspect-square rounded-xl sm:rounded-2xl p-1 flex flex-col items-center justify-center relative transition-all ${
                      hasRead
                        ? 'bg-emerald-500 text-white shadow-xs font-black'
                        : isToday
                        ? 'border-2 border-teal-500 text-teal-600 dark:text-teal-400 font-bold bg-teal-50/50 dark:bg-teal-950/20'
                        : 'bg-stone-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border border-stone-100 dark:border-slate-800/80 hover:bg-stone-100'
                    }`}
                    title={`${toPersianDigits(day.persianDay)} ${monthData.monthName}${
                      hasRead ? ' - تلاوت ثبت شده ✓' : isToday ? ' - امروز' : ''
                    }`}
                  >
                    <span className="text-xs sm:text-sm">{toPersianDigits(day.persianDay)}</span>
                    {hasRead && (
                      <Check className="w-3 h-3 text-white absolute bottom-1 stroke-[3]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* نوار پیشرفت و آمار ماه جاری */}
            <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                استمرار در {monthData.monthName} ماه: {toPersianDigits(activeDaysThisMonth)} روز از {toPersianDigits(monthData.days.length)} روز ({toPersianDigits(monthPercentage)}٪)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>روز تلاوت</span>
              </div>
            </div>
          </div>

          {/* پیام انگیزشی و معنوی استمرار */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-emerald-500/10 border border-amber-300/40 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="leading-relaxed font-medium">
              «أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ» — محبوب‌ترین کارها نزد خداوند بافضیلت، بااستمرارترینِ آن‌هاست هرچند اندک باشد. انس مداوم روزانه با کلام وحی، جان و اندیشه را نورانی و آرامش‌بخش می‌سازد.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
