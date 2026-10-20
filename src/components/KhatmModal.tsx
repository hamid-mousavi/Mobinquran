import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import { KhatmPlan } from '../types';
import { localDateKey } from '../utils/date';
import { buildKhatmSegments, KhatmSegment } from '../utils/khatmMath';
import { withPagesCompleted } from '../utils/khatmProgress';
import { applyPlanEdit, buildPlan } from '../utils/khatmPlans';
import { QuranService } from '../services/quranService';
import { recordUserActivity } from '../services/activityTracker';
import {
  EVENT_KHATM_CANDIDATES,
  clearKhatmCandidates,
  flushPageView,
  getKhatmCandidates,
} from '../services/khatm/pageViewTracker';
import { toPersianDigits } from '../utils/textNormalization';
import { useModalA11y } from '../hooks/useModalA11y';
import { KhatmPlanCard } from './khatm/KhatmPlanCard';
import { KhatmPlanDetail } from './khatm/KhatmPlanDetail';
import { KhatmFormValues, KhatmPlanForm } from './khatm/KhatmPlanForm';

interface KhatmModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onNavigateToPage: (pageNumber: number) => void;
}

type View =
  | { kind: 'list' }
  | { kind: 'detail'; id: string }
  | { kind: 'form'; mode: 'create' }
  | { kind: 'form'; mode: 'edit'; id: string };

interface Starts {
  juzStartPages: number[];
  quarterStartPages: number[];
}

const EMPTY_STARTS: Starts = { juzStartPages: [], quarterStartPages: [] };

const notifyKhatmChanged = () => window.dispatchEvent(new CustomEvent('mobin-khatm-updated'));

export const KhatmModal: React.FC<KhatmModalProps> = ({ isOpen, onClose, darkMode, onNavigateToPage }) => {
  const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });
  const [plans, setPlans] = useState<KhatmPlan[]>([]);
  const [starts, setStarts] = useState<Starts>(EMPTY_STARTS);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [candidates, setCandidates] = useState<number[]>([]);

  const reload = useCallback(async () => {
    const [list, st] = await Promise.all([
      QuranService.getKhatmPlans(),
      QuranService.getMushafStarts().catch(() => EMPTY_STARTS),
    ]);
    setPlans(list);
    setStarts(st);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setView({ kind: 'list' });
    reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, reload]);

  // صفحه‌هایی که ردیاب مطالعه حدس می‌زند خوانده شده‌اند (ثبت فقط با تأیید کاربر)
  useEffect(() => {
    if (!isOpen) return;
    flushPageView();
    setCandidates(getKhatmCandidates());
    const onUpdate = () => setCandidates(getKhatmCandidates());
    window.addEventListener(EVENT_KHATM_CANDIDATES, onUpdate);
    return () => window.removeEventListener(EVENT_KHATM_CANDIDATES, onUpdate);
  }, [isOpen]);

  // بازه‌های روزانهٔ هر برنامه؛ اگر مرزهای واقعی مصحف در دسترس نبود، تقسیم هم‌تا
  const segmentsById = useMemo(() => {
    const hasStarts = starts.juzStartPages.length === 30 && starts.quarterStartPages.length >= 120;
    const out: Record<string, { segments: KhatmSegment[]; perDayLabel: string }> = {};
    for (const p of plans) {
      out[p.id] = hasStarts
        ? buildKhatmSegments(p.type || 'custom', p.targetDays, starts.juzStartPages, starts.quarterStartPages)
        : buildKhatmSegments('custom', p.targetDays, [], []);
    }
    return out;
  }, [plans, starts]);

  const savePlan = useCallback(
    async (next: KhatmPlan) => {
      setPlans((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      try {
        await QuranService.saveKhatmPlan(next);
        notifyKhatmChanged();
      } catch {
        await reload();
      }
    },
    [reload]
  );

  const findPlan = (id: string) => plans.find((p) => p.id === id);

  const handleCreate = async (v: KhatmFormValues) => {
    const plan = buildPlan(
      { type: v.type, customDays: v.customDays, title: v.title, startDate: v.startDate },
      localDateKey(),
      Date.now()
    );
    await QuranService.saveKhatmPlan(plan);
    if (v.makePrimary || plans.length === 0) await QuranService.setPrimaryKhatmPlan(plan.id);
    await reload();
    notifyKhatmChanged();
    setView({ kind: 'detail', id: plan.id });
  };

  const handleEdit = async (id: string, v: KhatmFormValues) => {
    const plan = findPlan(id);
    if (!plan) return;
    await savePlan(applyPlanEdit(plan, { title: v.title, startDate: v.startDate, targetDays: v.customDays }, localDateKey()));
    setView({ kind: 'detail', id });
  };

  const handleDelete = async (id: string) => {
    const wasPrimary = !!findPlan(id)?.isActive;
    const remaining = plans.filter((p) => p.id !== id);
    await QuranService.deleteKhatmPlan(id);
    if (wasPrimary && remaining.length > 0) await QuranService.setPrimaryKhatmPlan(remaining[0].id);
    await reload();
    notifyKhatmChanged();
    setView({ kind: 'list' });
  };

  const handleSetPrimary = async (id: string) => {
    await QuranService.setPrimaryKhatmPlan(id);
    await reload();
    notifyKhatmChanged();
  };

  const handleReset = (id: string) => {
    const plan = findPlan(id);
    if (plan) void savePlan({ ...plan, completedPages: [] });
  };

  const handleTogglePage = (id: string, page: number) => {
    const plan = findPlan(id);
    if (!plan) return;
    const has = plan.completedPages.includes(page);
    if (!has) recordUserActivity('khatm'); // برداشتن علامت استمرار ثبت نمی‌کند
    void savePlan({
      ...plan,
      completedPages: has ? plan.completedPages.filter((p) => p !== page) : withPagesCompleted(plan.completedPages, [page], plan.totalPages || 604),
      lastReadDate: has ? plan.lastReadDate : localDateKey(),
    });
  };

  const handleCompletePages = (id: string, pages: number[]) => {
    const plan = findPlan(id);
    if (!plan || pages.length === 0) return;
    recordUserActivity('khatm');
    void savePlan({
      ...plan,
      completedPages: withPagesCompleted(plan.completedPages, pages, plan.totalPages || 604),
      lastReadDate: localDateKey(),
    });
  };

  const handleConfirmCandidates = (id: string, pages: number[]) => {
    handleCompletePages(id, pages);
    clearKhatmCandidates();
    setCandidates([]);
  };

  const handleDismissCandidates = () => {
    clearKhatmCandidates();
    setCandidates([]);
  };

  const goToPage = (page: number) => {
    onNavigateToPage(page);
    onClose();
  };

  if (!isOpen) return null;

  const detailPlan = view.kind === 'detail' || (view.kind === 'form' && view.mode === 'edit') ? findPlan(view.id) : undefined;

  return (
    <div
      id="khatm-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        id="khatm-modal-container"
        className={`w-full max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl border-2 transition-all overflow-hidden ${
          darkMode ? 'bg-slate-900 border-amber-500/50 text-slate-100' : 'bg-[#f7f3e8] border-amber-600 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* هدر */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">ختم‌های من</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {plans.length > 0 ? `${toPersianDigits(plans.length)} ختم` : 'برنامهٔ تلاوت و پیگیری پیشرفت'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors text-slate-500 cursor-pointer"
            aria-label="بستن پنجره ختم"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوا */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-[max(env(safe-area-inset-bottom,0px),24px)] space-y-4">
          {loading && plans.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">در حال بارگذاری…</div>
          ) : view.kind === 'form' && view.mode === 'create' ? (
            <KhatmPlanForm
              mode="create"
              isFirstPlan={plans.length === 0}
              onSubmit={(v) => void handleCreate(v)}
              onCancel={() => setView({ kind: 'list' })}
            />
          ) : view.kind === 'form' && detailPlan ? (
            <KhatmPlanForm
              mode="edit"
              initial={detailPlan}
              isFirstPlan={false}
              onSubmit={(v) => void handleEdit(detailPlan.id, v)}
              onCancel={() => setView({ kind: 'detail', id: detailPlan.id })}
            />
          ) : view.kind === 'detail' && detailPlan ? (
            <KhatmPlanDetail
              plan={detailPlan}
              segments={segmentsById[detailPlan.id]?.segments ?? []}
              perDayLabel={segmentsById[detailPlan.id]?.perDayLabel ?? ''}
              darkMode={darkMode}
              candidates={candidates}
              onBack={() => setView({ kind: 'list' })}
              onEdit={() => setView({ kind: 'form', mode: 'edit', id: detailPlan.id })}
              onDelete={() => void handleDelete(detailPlan.id)}
              onReset={() => handleReset(detailPlan.id)}
              onSetPrimary={() => void handleSetPrimary(detailPlan.id)}
              onTogglePage={(p) => handleTogglePage(detailPlan.id, p)}
              onCompletePages={(pages) => handleCompletePages(detailPlan.id, pages)}
              onConfirmCandidates={(pages) => handleConfirmCandidates(detailPlan.id, pages)}
              onDismissCandidates={handleDismissCandidates}
              onNavigateToPage={goToPage}
            />
          ) : plans.length === 0 ? (
            <div className="py-10 text-center space-y-4">
              <p className="text-sm font-bold">هنوز ختمی تعریف نکرده‌اید</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                یک برنامه بسازید تا سهم هر روز و پیشرفتتان را یک‌جا ببینید.
              </p>
              <button
                type="button"
                onClick={() => setView({ kind: 'form', mode: 'create' })}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن ختم جدید</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setView({ kind: 'form', mode: 'create' })}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-amber-500/50 text-amber-700 dark:text-amber-400 font-bold text-sm hover:bg-amber-500/10 cursor-pointer active:scale-[0.99] transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن ختم جدید</span>
              </button>
              <div className="space-y-3">
                {plans.map((p) => (
                  <KhatmPlanCard
                    key={p.id}
                    plan={p}
                    segments={segmentsById[p.id]?.segments ?? []}
                    darkMode={darkMode}
                    onOpen={() => setView({ kind: 'detail', id: p.id })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
