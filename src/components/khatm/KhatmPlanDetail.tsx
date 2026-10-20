import React, { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Circle, Flame, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import type { KhatmPlan } from '../../types';
import type { KhatmSegment } from '../../utils/khatmMath';
import { computeKhatmStatus } from '../../utils/khatmProgress';
import { dayStates, planGlance } from '../../utils/khatmPlans';
import { pendingCandidates, toRanges } from '../../services/khatm/pageViewCore';
import { toPersianDigits } from '../../utils/textNormalization';
import { DayStrip, DayStripLegend } from './DayStrip';

interface KhatmPlanDetailProps {
  plan: KhatmPlan;
  segments: KhatmSegment[];
  perDayLabel: string;
  darkMode: boolean;
  /** صفحه‌های حدس‌زده‌شدهٔ مطالعه (ثبت فقط با تأیید) */
  candidates: number[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReset: () => void;
  onSetPrimary: () => void;
  onTogglePage: (page: number) => void;
  onCompletePages: (pages: number[]) => void;
  onConfirmCandidates: (pages: number[]) => void;
  onDismissCandidates: () => void;
  onNavigateToPage: (page: number) => void;
}

const formatRanges = (pages: number[]) =>
  toRanges(pages)
    .map(([a, b]) => (a === b ? toPersianDigits(a) : `${toPersianDigits(a)} تا ${toPersianDigits(b)}`))
    .join('، ');

export const KhatmPlanDetail: React.FC<KhatmPlanDetailProps> = ({
  plan,
  segments,
  perDayLabel,
  darkMode,
  candidates,
  onBack,
  onEdit,
  onDelete,
  onReset,
  onSetPrimary,
  onTogglePage,
  onCompletePages,
  onConfirmCandidates,
  onDismissCandidates,
  onNavigateToPage,
}) => {
  const [confirming, setConfirming] = useState<'delete' | 'reset' | null>(null);
  const [showDays, setShowDays] = useState(false);

  const totalPages = plan.totalPages || 604;
  const g = planGlance(plan, segments);
  const todaySegment = segments[g.currentDay - 1] ?? null;
  const status = computeKhatmStatus(plan.completedPages, segments, g.currentDay, plan.targetDays, totalPages);
  const pending = pendingCandidates(candidates, plan.completedPages);
  const states = dayStates(plan.completedPages, segments, g.currentDay);
  const done = new Set(plan.completedPages);

  const card = darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-stone-200 shadow-sm';
  const subtle = 'text-slate-500 dark:text-slate-400';

  return (
    <div className="space-y-4">
      {/* نوار بالا: بازگشت + عنوان */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="بازگشت به فهرست ختم‌ها"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-sm truncate flex-1">{plan.title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="ویرایش ختم"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      {/* وضعیت کلی */}
      <div className={`p-4 rounded-2xl border space-y-3 ${card}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={`text-xs ${subtle}`}>
              روز {toPersianDigits(g.currentDay)} از {toPersianDigits(g.totalDays)} • {toPersianDigits(perDayLabel)}
            </p>
            <p className={`text-[11px] ${subtle}`}>
              شروع: {toPersianDigits(plan.startDate)} • {toPersianDigits(g.daysLeft)} روز باقی‌مانده
            </p>
          </div>
          <div className="text-left">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{toPersianDigits(g.percent)}٪</span>
            <p className="text-[11px] text-slate-400">پیشرفت کل</p>
          </div>
        </div>
        <div className="w-full bg-stone-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-l from-amber-500 to-amber-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${g.percent}%` }}
          />
        </div>
        <div className={`flex items-center justify-between text-[11px] font-medium ${subtle}`}>
          <span>{toPersianDigits(g.completedCount)} صفحه خوانده شده</span>
          <span>{toPersianDigits(g.remainingPages)} صفحه باقی‌مانده</span>
        </div>
        <div className="space-y-1.5 pt-1">
          <DayStrip states={states} tall />
          <DayStripLegend />
        </div>
      </div>

      {/* پیشنهاد ثبت صفحه‌های مطالعه‌شده */}
      {pending.length > 0 && (
        <div role="status" className="p-3.5 rounded-2xl border border-teal-500/30 bg-teal-500/10 space-y-2.5">
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
            به نظر می‌رسد صفحهٔ {formatRanges(pending)} را مطالعه کرده‌اید. در این ختم ثبت شود؟
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onConfirmCandidates(pending)}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold cursor-pointer active:scale-95 transition-all"
            >
              ثبت {toPersianDigits(pending.length)} صفحه
            </button>
            <button
              type="button"
              onClick={onDismissCandidates}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer active:scale-95 transition-all"
            >
              نه، ممنون
            </button>
          </div>
        </div>
      )}

      {/* عقب‌افتادگی و بازتوزیع */}
      {status.catchUp && (
        <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-2.5">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
            {toPersianDigits(status.behindPages.length)} صفحه از روزهای قبل خوانده نشده است
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            برای رسیدن به هدف در {toPersianDigits(status.daysLeft)} روز باقی‌مانده، از امروز روزانه حدود{' '}
            {toPersianDigits(status.catchUp.quotaPerDay)} صفحه لازم است (به‌جای {toPersianDigits(status.catchUp.originalPerDay)} صفحه).
            سهم امروز با جبران: صفحهٔ {formatRanges(status.catchUp.todayPages)}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {status.firstUnreadPage !== null && (
              <button
                type="button"
                onClick={() => onNavigateToPage(status.firstUnreadPage as number)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer active:scale-95 transition-all"
              >
                شروع از صفحهٔ {toPersianDigits(status.firstUnreadPage)}
              </button>
            )}
            <button
              type="button"
              onClick={() => onCompletePages(status.catchUp ? status.catchUp.todayPages : [])}
              className="px-3 py-1.5 rounded-xl border border-amber-600/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold cursor-pointer active:scale-95 transition-all"
            >
              ثبت سهم امروز (جبران)
            </button>
          </div>
        </div>
      )}

      {/* تلاوت امروز */}
      {!g.isComplete && (
        <div className={`p-4 rounded-2xl border space-y-3 ${card}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h4 className="font-bold text-sm">تلاوت امروز (روز {toPersianDigits(g.currentDay)})</h4>
            </div>
            {todaySegment && (
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                صفحهٔ {toPersianDigits(todaySegment.startPage)} تا {toPersianDigits(todaySegment.endPage)}
                {todaySegment.label ? ` • ${toPersianDigits(todaySegment.label)}` : ''}
              </span>
            )}
          </div>
          {todaySegment ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: todaySegment.endPage - todaySegment.startPage + 1 }, (_, i) => todaySegment.startPage + i).map(
                  (pageNum) => {
                    const isDone = done.has(pageNum);
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => onTogglePage(pageNum)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isDone
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-stone-50 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5 opacity-40" />}
                        <span>ص {toPersianDigits(pageNum)}</span>
                      </button>
                    );
                  }
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateToPage(todaySegment.startPage)}
                  className="w-full sm:flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow cursor-pointer active:scale-95 transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>شروع تلاوت (صفحه {toPersianDigits(todaySegment.startPage)})</span>
                </button>
                <button
                  type="button"
                  disabled={g.todayDone}
                  onClick={() => onCompletePages(Array.from({ length: todaySegment.endPage - todaySegment.startPage + 1 }, (_, i) => todaySegment.startPage + i))}
                  className={`w-full sm:w-auto py-2.5 px-4 rounded-xl font-bold text-xs border transition-all ${
                    g.todayDone
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 cursor-default'
                      : 'bg-stone-100 dark:bg-slate-800 hover:bg-amber-500/10 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-700 cursor-pointer'
                  }`}
                >
                  {g.todayDone ? 'تلاوت امروز ثبت شد ✓' : 'ثبت کامل تلاوت امروز'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">بازهٔ امروز در دسترس نیست.</p>
          )}
        </div>
      )}

      {g.isComplete && (
        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
          این ختم کامل شد. تقبّل الله.
        </div>
      )}

      {/* برنامهٔ روزها (جزئیات بیشتر) */}
      <div className={`rounded-2xl border ${card}`}>
        <button
          type="button"
          onClick={() => setShowDays((v) => !v)}
          className="w-full flex items-center justify-between p-3.5 text-xs font-bold cursor-pointer"
          aria-expanded={showDays}
        >
          <span>برنامهٔ روز به روز</span>
          <span className="text-slate-400">{showDays ? 'بستن' : 'نمایش'}</span>
        </button>
        {showDays && (
          <ul className="max-h-60 overflow-y-auto px-3.5 pb-3.5 space-y-1">
            {segments.map((seg, i) => {
              const st = states[i];
              return (
                <li
                  key={seg.day}
                  className={`flex items-center justify-between gap-2 text-[11px] rounded-lg px-2 py-1.5 ${
                    st === 'today' ? 'bg-sky-500/10' : ''
                  }`}
                >
                  <span className="font-bold">روز {toPersianDigits(seg.day)}</span>
                  <span className={subtle}>
                    صفحهٔ {toPersianDigits(seg.startPage)} تا {toPersianDigits(seg.endPage)}
                    {seg.label ? ` • ${toPersianDigits(seg.label)}` : ''}
                  </span>
                  <span className="w-12 text-left">
                    {st === 'done' ? '✓' : st === 'partial' ? 'ناقص' : st === 'missed' ? 'عقب' : st === 'today' ? 'امروز' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* اکشن‌ها */}
      <div className="space-y-2 pt-1">
        {!plan.isActive && (
          <button
            type="button"
            onClick={onSetPrimary}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-amber-500/40 text-amber-700 dark:text-amber-400 text-xs font-bold cursor-pointer active:scale-95 transition-all"
          >
            <Star className="w-3.5 h-3.5" />
            <span>نمایش این ختم در صفحهٔ اصلی</span>
          </button>
        )}

        {confirming ? (
          <div role="alertdialog" className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-2">
            <p className="text-xs text-slate-700 dark:text-slate-200">
              {confirming === 'delete'
                ? 'این ختم و پیشرفتش برای همیشه حذف شود؟'
                : 'پیشرفت این ختم به صفر برگردد؟ (خود ختم می‌ماند)'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const c = confirming;
                  setConfirming(null);
                  if (c === 'delete') onDelete();
                  else onReset();
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer active:scale-95 transition-all"
              >
                {confirming === 'delete' ? 'بله، حذف شود' : 'بله، بازنشانی'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-slate-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setConfirming('reset')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی پیشرفت</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirming('delete')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف ختم</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
