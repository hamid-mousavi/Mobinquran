import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { KhatmPlan, KhatmType } from '../../types';
import {
  KHATM_TEMPLATES,
  MAX_CUSTOM_DAYS,
  MAX_TITLE_LENGTH,
  MIN_CUSTOM_DAYS,
  defaultTitle,
  daysForType,
} from '../../utils/khatmPlans';
import { localDateKey } from '../../utils/date';
import { toPersianDigits } from '../../utils/textNormalization';

export interface KhatmFormValues {
  type: KhatmType;
  customDays: number;
  title: string;
  startDate: string;
  makePrimary: boolean;
}

interface KhatmPlanFormProps {
  mode: 'create' | 'edit';
  /** در حالت ویرایش، برنامهٔ موجود */
  initial?: KhatmPlan;
  /** اولین برنامه همیشه «اصلی» است */
  isFirstPlan: boolean;
  onSubmit: (values: KhatmFormValues) => void;
  onCancel: () => void;
}

export const KhatmPlanForm: React.FC<KhatmPlanFormProps> = ({ mode, initial, isFirstPlan, onSubmit, onCancel }) => {
  const today = localDateKey();
  const [type, setType] = useState<KhatmType>(initial?.type ?? 'ramadan_30');
  const [customDays, setCustomDays] = useState<number>(initial?.type === 'custom' ? initial.targetDays : 60);
  const [title, setTitle] = useState<string>(initial?.title ?? '');
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? today);
  const [makePrimary, setMakePrimary] = useState<boolean>(isFirstPlan);

  const editingCustom = mode === 'edit' && initial?.type === 'custom';
  const showCustomDays = mode === 'create' ? type === 'custom' : editingCustom;
  const customInvalid = showCustomDays && (!Number.isFinite(customDays) || customDays < MIN_CUSTOM_DAYS || customDays > MAX_CUSTOM_DAYS);
  const effectiveType = mode === 'edit' && initial ? initial.type : type;
  const placeholder = defaultTitle(effectiveType, daysForType(effectiveType, customDays));

  const field =
    'w-full rounded-xl border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="بازگشت"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-sm">{mode === 'create' ? 'افزودن ختم جدید' : 'ویرایش ختم'}</h3>
      </div>

      {mode === 'create' && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">نوع ختم</div>
          {KHATM_TEMPLATES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setType(t.type)}
              className={`w-full text-right p-3 rounded-2xl border transition-all cursor-pointer ${
                type === t.type
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500'
                  : 'bg-white dark:bg-slate-800/60 border-stone-200 dark:border-slate-700 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm">{t.title}</span>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">{t.perDay}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{t.description}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setType('custom')}
            className={`w-full text-right p-3 rounded-2xl border transition-all cursor-pointer ${
              type === 'custom'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500'
                : 'bg-white dark:bg-slate-800/60 border-stone-200 dark:border-slate-700 hover:border-stone-300'
            }`}
          >
            <span className="font-bold text-sm">ختم سفارشی</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">مدت دلخواه؛ صفحه‌ها هم‌تا بین روزها تقسیم می‌شوند.</p>
          </button>
        </div>
      )}

      {showCustomDays && (
        <div className="space-y-1">
          <label htmlFor="khatm-custom-days" className="text-xs font-bold text-slate-600 dark:text-slate-300">
            مدت ختم (روز)
          </label>
          <input
            id="khatm-custom-days"
            type="number"
            inputMode="numeric"
            min={MIN_CUSTOM_DAYS}
            max={MAX_CUSTOM_DAYS}
            value={Number.isFinite(customDays) ? customDays : ''}
            onChange={(e) => setCustomDays(e.target.value === '' ? NaN : Number(e.target.value))}
            className={field}
          />
          <p className={`text-[11px] ${customInvalid ? 'text-red-500' : 'text-slate-400'}`}>
            بین {toPersianDigits(MIN_CUSTOM_DAYS)} تا {toPersianDigits(MAX_CUSTOM_DAYS)} روز
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="khatm-title" className="text-xs font-bold text-slate-600 dark:text-slate-300">
          عنوان (اختیاری)
        </label>
        <input
          id="khatm-title"
          type="text"
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder={placeholder}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="khatm-start" className="text-xs font-bold text-slate-600 dark:text-slate-300">
          تاریخ شروع
        </label>
        <input
          id="khatm-start"
          type="date"
          max={today}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={field}
          dir="ltr"
        />
        <p className="text-[11px] text-slate-400">روز جاری برنامه از این تاریخ حساب می‌شود.</p>
      </div>

      {mode === 'create' && !isFirstPlan && (
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} />
          <span>نمایش این ختم در صفحهٔ اصلی</span>
        </label>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!!customInvalid}
          onClick={() =>
            onSubmit({
              type: effectiveType,
              customDays,
              title,
              startDate,
              makePrimary: isFirstPlan || makePrimary,
            })
          }
          className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all"
        >
          {mode === 'create' ? 'ایجاد ختم' : 'ذخیره تغییرات'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
        >
          انصراف
        </button>
      </div>
    </div>
  );
};
