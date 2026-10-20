import React from 'react';
import { CheckCircle2, ChevronLeft, Star } from 'lucide-react';
import type { KhatmPlan } from '../../types';
import type { KhatmSegment } from '../../utils/khatmMath';
import { dayStates, planGlance } from '../../utils/khatmPlans';
import { toPersianDigits } from '../../utils/textNormalization';
import { DayStrip } from './DayStrip';

interface KhatmPlanCardProps {
  plan: KhatmPlan;
  segments: KhatmSegment[];
  darkMode: boolean;
  onOpen: () => void;
}

/** کارت فشردهٔ یک ختم در فهرست: بدون کلیک، همهٔ اطلاعات کلیدی دیده می‌شود */
export const KhatmPlanCard: React.FC<KhatmPlanCardProps> = ({ plan, segments, darkMode, onOpen }) => {
  const g = planGlance(plan, segments);
  const states = dayStates(plan.completedPages, segments, g.currentDay);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-right p-3.5 rounded-2xl border space-y-2.5 transition-all active:scale-[0.99] cursor-pointer ${
        darkMode
          ? 'bg-slate-800/60 border-slate-700 hover:border-amber-500/50'
          : 'bg-white border-stone-200 shadow-sm hover:border-amber-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{plan.title}</h3>
            {plan.isActive && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                <Star className="w-2.5 h-2.5 fill-current" />
                صفحه اصلی
              </span>
            )}
            {g.isComplete && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                تکمیل شد
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            روز {toPersianDigits(g.currentDay)} از {toPersianDigits(g.totalDays)} •{' '}
            {toPersianDigits(g.remainingPages)} صفحه مانده
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{toPersianDigits(g.percent)}٪</span>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      <div className="w-full bg-stone-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
        <div className="bg-gradient-to-l from-amber-500 to-amber-600 h-full rounded-full" style={{ width: `${g.percent}%` }} />
      </div>

      {!g.isComplete && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          {g.todayRange ? (
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              {g.todayDone ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>سهم امروز انجام شد</span>
                </>
              ) : (
                <span>
                  امروز: صفحهٔ {toPersianDigits(g.todayRange.start)} تا {toPersianDigits(g.todayRange.end)}
                </span>
              )}
            </span>
          ) : (
            <span />
          )}
          {g.behindCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 font-bold">
              {toPersianDigits(g.behindCount)} صفحه عقب
            </span>
          )}
        </div>
      )}

      <DayStrip states={states} />
    </button>
  );
};
