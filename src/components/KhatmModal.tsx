import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, Circle, Flame, X, RotateCcw, BookOpen } from 'lucide-react';
import { KhatmPlan, KhatmType } from '../types';
import { localDateKey, currentKhatmDay } from '../utils/date';
import { buildKhatmSegments, KhatmSegment } from '../utils/khatmMath';
import { QuranService } from '../services/quranService';

interface KhatmModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onNavigateToPage: (pageNumber: number) => void;
}

const DEFAULT_SEGMENT_COUNT = 30;

export const KhatmModal: React.FC<KhatmModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  onNavigateToPage,
}) => {
  const [plan, setPlan] = useState<KhatmPlan | null>(null);
  const [segments, setSegments] = useState<KhatmSegment[]>([]);
  const [perDayLabel, setPerDayLabel] = useState('');
  const [isPlanLoading, setIsPlanLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'status' | 'new_plan'>('status');
  const [newPlanType, setNewPlanType] = useState<KhatmType>('ramadan_30');
  const [customDays, setCustomDays] = useState(60);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setIsPlanLoading(true);
      try {
        // مرزهای واقعی مصحف و برنامهٔ فعال (هر دو از IndexedDB)
        const [starts, savedPlan] = await Promise.all([
          QuranService.getMushafStarts(),
          QuranService.getKhatmPlan(),
        ]);
        if (cancelled) return;

        const target = savedPlan ?? {
          id: 'ramadan_30_default',
          title: 'ختم ۳۰ روزه قرآن کریم (جزء به جزء)',
          type: 'ramadan_30' as KhatmType,
          startDate: localDateKey(),
          targetDays: DEFAULT_SEGMENT_COUNT,
          totalPages: 604,
          completedPages: [],
          currentDay: 1,
          isActive: true,
        };

        if (cancelled) return;
        setPlan(target);

        const result = buildKhatmSegments(
          target.type || 'custom',
          target.targetDays,
          starts.juzStartPages,
          starts.quarterStartPages
        );
        setSegments(result.segments);
        setPerDayLabel(result.perDayLabel);
      } catch {
        // در صورت خطا، حالت نخست ختم ۳۰ روزه با تقسیم هم‌تا
        const fallback: KhatmSegment[] = [];
        const len = Math.ceil(604 / DEFAULT_SEGMENT_COUNT);
        for (let day = 1; day <= DEFAULT_SEGMENT_COUNT; day++) {
          fallback.push({
            day,
            startPage: (day - 1) * len + 1,
            endPage: Math.min(604, day * len),
            label: '',
          });
        }
        setSegments(fallback);
        setPerDayLabel(`روزانه ~${len} صفحه`);
        setPlan({
          id: 'ramadan_30_default',
          title: 'ختم ۳۰ روزه قرآن کریم (جزء به جزء)',
          type: 'ramadan_30',
          startDate: localDateKey(),
          targetDays: DEFAULT_SEGMENT_COUNT,
          totalPages: 604,
          completedPages: [],
          currentDay: 1,
          isActive: true,
        });
      } finally {
        if (!cancelled) setIsPlanLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // ذخیرهٔ همهٔ تغییرات برنامه به‌صورت مستقیم در Dexie (P3-T9)
  const applyPlanChange = useCallback((updater: (prev: KhatmPlan) => KhatmPlan) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      QuranService.saveKhatmPlan({ ...next, isActive: true }).catch(() => {});
      return next;
    });
  }, []);

  if (!isOpen) return null;

  // روز جاری از روی تاریخ شروع و تاریخ محلیِ امروز (نه UTC و نه شمارندهٔ ذخیره‌شده)
  const targetDays = plan?.targetDays || DEFAULT_SEGMENT_COUNT;
  const totalPages = plan?.totalPages || 604;
  const derivedDay = plan ? currentKhatmDay(plan.startDate, targetDays) : 1;
  const currentDay = Math.min(derivedDay, Math.max(1, segments.length || targetDays));

  const todaySegment: KhatmSegment | null = segments[currentDay - 1] || null;

  const completedCount = plan?.completedPages.length || 0;
  const progressPercent = Math.min(100, Math.round((completedCount / totalPages) * 100));

  // آیا همهٔ صفحات بازهٔ امروز خوانده شده‌اند؟
  const isTodayCompleted =
    !!todaySegment &&
    (() => {
      const pages = plan?.completedPages || [];
      for (let p = todaySegment.startPage; p <= todaySegment.endPage; p++) {
        if (!pages.includes(p)) return false;
      }
      return true;
    })();

  const togglePageCompletion = (pageNum: number) => {
    applyPlanChange((prev) => {
      const exists = prev.completedPages.includes(pageNum);
      const updatedPages = exists
        ? prev.completedPages.filter((p) => p !== pageNum)
        : [...prev.completedPages, pageNum].sort((a, b) => a - b);
      return { ...prev, completedPages: updatedPages };
    });
  };

  const handleMarkTodayCompleted = () => {
    if (!todaySegment || !plan) return;
    applyPlanChange((prev) => {
      const newPages = new Set(prev.completedPages);
      for (let p = todaySegment.startPage; p <= todaySegment.endPage; p++) {
        newPages.add(p);
      }
      return {
        ...prev,
        completedPages: Array.from(newPages).sort((a, b) => a - b),
        lastReadDate: localDateKey(),
      };
    });
  };

  const handleCreateNewPlan = async () => {
    let days = 30;
    let title = 'ختم ۳۰ روزه قرآن کریم (بر اساس مرز واقعی اجزاء)';

    if (newPlanType === 'arbaeen_40') {
      days = 40;
      title = 'چله قرآنی و تزکیه نفس (۴۰ روزه - بر اساس حدود حزب از جدول مصحف)';
    } else if (newPlanType === 'hizb_120') {
      days = 120;
      title = 'ختم تدبّری ۱۲۰ روزه (روزانه ۲ ربع حزب)';
    } else if (newPlanType === 'custom') {
      days = Math.max(10, Math.min(365, customDays));
      title = `ختم سفارشی ${days} روزه`;
    }

    try {
      const starts = await QuranService.getMushafStarts();
      const result = buildKhatmSegments(
        newPlanType,
        days,
        starts.juzStartPages,
        starts.quarterStartPages
      );
      setSegments(result.segments);
      setPerDayLabel(result.perDayLabel);

      const newPlan: KhatmPlan = {
        id: `plan_${Date.now()}`,
        title,
        type: newPlanType,
        startDate: localDateKey(),
        targetDays: days,
        totalPages: 604,
        completedPages: [],
        currentDay: 1,
        isActive: true,
      };
      await QuranService.saveKhatmPlan(newPlan);
      setPlan(newPlan);
      setActiveTab('status');
    } catch {
      // fallback: تقسیم هم‌تا
      const result = buildKhatmSegments('custom', days, [], []);
      setSegments(result.segments);
      setPerDayLabel(result.perDayLabel);
      const newPlan: KhatmPlan = {
        id: `plan_${Date.now()}`,
        title,
        type: newPlanType,
        startDate: localDateKey(),
        targetDays: days,
        totalPages: 604,
        completedPages: [],
        currentDay: 1,
        isActive: true,
      };
      await QuranService.saveKhatmPlan(newPlan);
      setPlan(newPlan);
      setActiveTab('status');
    }
  };

  const handleResetCurrentPlan = () => {
    if (window.confirm('آیا از بازنشانی پیشرفت برنامه ختم قرآن اطمینان دارید؟')) {
      applyPlanChange((prev) => ({
        ...prev,
        completedPages: [],
      }));
    }
  };

  return (
    <div
      id="khatm-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="khatm-modal-container"
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border transition-all overflow-hidden ${
          darkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-[#faf8f5] border-stone-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* هدر مودال */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">برنامه‌ریزی و پیگیری ختم قرآن</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تنظیم هدف روزانه تلاوت و ثبت گام‌به‌گام پیشرفت
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
            aria-label="بستن پنجره ختم"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* تب‌ها */}
        <div className="flex border-b border-stone-200 dark:border-slate-800 text-xs font-bold px-4 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 px-4 border-b-2 transition-all ${
              activeTab === 'status'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            پیشرفت برنامه جاری
          </button>
          <button
            onClick={() => setActiveTab('new_plan')}
            className={`pb-2.5 px-4 border-b-2 transition-all ${
              activeTab === 'new_plan'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            تعریف برنامه جدید
          </button>
        </div>

        {/* محتوای مودال */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {activeTab === 'status' ? (
            isPlanLoading && !plan ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                در حال بارگذاری برنامهٔ ختم...
              </div>
            ) : (
              <>
                {/* کارت وضعیت کلی */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border relative overflow-hidden ${
                    darkMode
                      ? 'bg-gradient-to-br from-slate-800 to-slate-850 border-slate-700'
                      : 'bg-gradient-to-br from-white to-amber-50/50 border-amber-200/80 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        برنامه فعال
                      </span>
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {plan?.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        روز {currentDay} از {targetDays} • {perDayLabel}
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                        {progressPercent}٪
                      </span>
                      <p className="text-[11px] text-slate-400">پیشرفت کل</p>
                    </div>
                  </div>

                  {/* نوار پیشرفت */}
                  <div className="mt-4 w-full bg-stone-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-l from-amber-500 to-amber-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>{completedCount} صفحه خوانده شده</span>
                    <span>{totalPages - completedCount} صفحه باقیمانده</span>
                  </div>
                </div>

                {/* بخش تلاوت امروز */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    darkMode
                      ? 'bg-slate-800/60 border-slate-700'
                      : 'bg-white border-stone-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-amber-500" />
                      <h4 className="font-bold text-sm">تکلیف تلاوت امروز (روز {currentDay})</h4>
                    </div>
                    {todaySegment && (
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                        صفحه {todaySegment.startPage} تا {todaySegment.endPage}
                        {todaySegment.label ? ` • ${todaySegment.label}` : ''}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    با تلاوت امروز، سهم روزانهٔ عهد قرآنی خود را با مرزهای واقعی مصحف
                    (جزء/ربع حزب) به پایان برسانید.
                  </p>

                  {todaySegment ? (
                    <>
                      {/* صفحات ریز امروز جهت علامت‌گذاری */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(() => {
                          const pageButtons: React.ReactNode[] = [];
                          for (
                            let pageNum = todaySegment.startPage;
                            pageNum <= todaySegment.endPage;
                            pageNum++
                          ) {
                            const isDone = plan?.completedPages.includes(pageNum) || false;
                            pageButtons.push(
                              <button
                                key={pageNum}
                                onClick={() => togglePageCompletion(pageNum)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                  isDone
                                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                    : 'bg-stone-50 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 opacity-40" />
                                )}
                                <span>ص {pageNum}</span>
                              </button>
                            );
                          }
                          return pageButtons;
                        })()}
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                        <button
                          onClick={() => {
                            onNavigateToPage(todaySegment.startPage);
                            onClose();
                          }}
                          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow transition-all active:scale-95"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>شروع تلاوت امروز (صفحه {todaySegment.startPage})</span>
                        </button>

                        <button
                          onClick={handleMarkTodayCompleted}
                          className={`w-full sm:w-auto py-2.5 px-4 rounded-xl font-bold text-xs border transition-all ${
                            isTodayCompleted
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 cursor-default'
                              : 'bg-stone-100 dark:bg-slate-800 hover:bg-amber-500/10 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-700'
                          }`}
                        >
                          {isTodayCompleted ? 'تلاوت امروز ثبت شد ✓' : 'ثبت کامل تلاوت امروز'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">محاسبهٔ بازهٔ امروز در حال انجام است...</p>
                  )}
                </div>

                {/* اکشن بازنشانی */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleResetCurrentPlan}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>بازنشانی پیشرفت برنامه</span>
                  </button>
                </div>
              </>
            )
          ) : (
            /* تعریف برنامه جدید */
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-sm">انتخاب قالب ختم قرآن کریم</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  بازهٔ روزانه با مرز واقعی اجزاء و احزاب از جدول مصحف محاسبه می‌شود
                  (نه تقسیم سادهٔ `604 / روز`).
                </p>
              </div>

              <div className="space-y-2.5">
                {/* قالب ۳۰ روزه رمضان */}
                <div
                  onClick={() => setNewPlanType('ramadan_30')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    newPlanType === 'ramadan_30'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white dark:bg-slate-800/60 border-stone-200 dark:border-slate-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      ختم ۳۰ روزه ماه مبارک رمضان
                    </span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      روزانه ۱ جزء (مرز واقعی)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    مناسب برای ماه مبارک رمضان جهت قرائت یک جزء در هر شبانه‌روز؛ بازهٔ هر روز دقیقاً
                    همان مرز جزء در مصحف است.
                  </p>
                </div>

                {/* چله ۴۰ روزه */}
                <div
                  onClick={() => setNewPlanType('arbaeen_40')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    newPlanType === 'arbaeen_40'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white dark:bg-slate-800/60 border-stone-200 dark:border-slate-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      چله قرآنی و تزکیه (۴۰ روزه)
                    </span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      روزانه ~۱۵ صفحه
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    دوره‌ای معنوی برای انس با قرآن در ۴۰ روز با گام‌های روزانهٔ هم‌گام با مرزهای حزب.
                  </p>
                </div>

                {/* ختم ۱۲۰ روزه بر اساس حزب */}
                <div
                  onClick={() => setNewPlanType('hizb_120')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    newPlanType === 'hizb_120'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white dark:bg-slate-800/60 border-stone-200 dark:border-slate-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      ختم تدبّری ۱۲۰ روزه (ربع حزب به ربع)
                    </span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      روزانه ۲ ربع حزب (~۵ صفحه)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    مطالعهٔ عمیق و تدبّر با حجم سبک روزانه؛ بازهٔ هر روز روی مرز واقعی ربع حزب جدول
                    مصحف می‌ایستد.
                  </p>
                </div>

                {/* ختم سفارشی */}
                <div
                  onClick={() => setNewPlanType('custom')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    newPlanType === 'custom'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white dark:bg-slate-800/60 border-stone-200 dark:border-slate-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      برنامه سفارشی
                    </span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      تعداد روزهای دلخواه
                    </span>
                  </div>
                  {newPlanType === 'custom' && (
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-slate-700 flex items-center gap-3">
                      <label className="text-xs text-slate-600 dark:text-slate-300">
                        تعداد روزهای هدف:
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={365}
                        value={customDays}
                        onChange={(e) => setCustomDays(Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded-lg border text-sm text-center font-bold bg-white dark:bg-slate-800"
                      />
                      <span className="text-xs text-slate-400">
                        (روزانه حدود {Math.ceil(604 / (customDays || 1))} صفحه)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleCreateNewPlan}
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
              >
                ایجاد و فعال‌سازی این برنامه
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};