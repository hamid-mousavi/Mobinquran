import React from 'react';
import type { DayState } from '../../utils/khatmPlans';

const COLORS: Record<DayState, string> = {
  done: 'bg-emerald-500',
  partial: 'bg-amber-400',
  missed: 'bg-rose-400/80',
  today: 'bg-sky-500 ring-1 ring-sky-300 dark:ring-sky-400',
  future: 'bg-stone-200 dark:bg-slate-700',
};

const LABELS: Record<DayState, string> = {
  done: 'کامل',
  partial: 'ناقص',
  missed: 'خوانده نشده',
  today: 'امروز',
  future: 'پیش رو',
};

/** نوار یک‌نگاه: هر خانه یک روز برنامه است */
export const DayStrip: React.FC<{ states: DayState[]; tall?: boolean }> = ({ states, tall }) => (
  <div
    className={`flex gap-[2px] w-full ${tall ? 'h-3' : 'h-2'}`}
    role="img"
    aria-label={`وضعیت ${states.length} روز برنامه`}
    dir="rtl"
  >
    {states.map((s, i) => (
      <div key={i} title={`روز ${i + 1}: ${LABELS[s]}`} className={`flex-1 min-w-[2px] rounded-[2px] ${COLORS[s]}`} />
    ))}
  </div>
);

export const DayStripLegend: React.FC = () => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
    {(Object.keys(COLORS) as DayState[]).map((s) => (
      <span key={s} className="flex items-center gap-1">
        <span className={`inline-block w-2.5 h-2.5 rounded-[2px] ${COLORS[s]}`} />
        {LABELS[s]}
      </span>
    ))}
  </div>
);
