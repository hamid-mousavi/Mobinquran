import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, X, ChevronsDown, Gauge } from 'lucide-react';
import { toPersianDigits } from '../utils/textNormalization';

interface AutoScrollControlsProps {
  isActive: boolean;
  onClose: () => void;
  darkMode: boolean;
  onNextPageOrSurah?: () => void;
}

type SpeedPreset = {
  id: 'slow' | 'normal' | 'fast';
  label: string;
  factor: number;
};

const SPEED_PRESETS: SpeedPreset[] = [
  { id: 'slow', label: 'آرام', factor: 0.7 },
  { id: 'normal', label: 'متوسط', factor: 1.0 },
  { id: 'fast', label: 'سریع', factor: 1.5 },
];

export const AutoScrollControls: React.FC<AutoScrollControlsProps> = ({
  isActive,
  onClose,
  darkMode,
  onNextPageOrSurah,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedFactor, setSpeedFactor] = useState<number>(1.0);
  const [isTemporarilyPaused, setIsTemporarilyPaused] = useState(false);

  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const userPauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fractionalScrollRef = useRef<number>(0);

  // محاسبه پیکسل بر ثانیه متناسب با سرعت خواندن
  const getPixelsPerSecond = useCallback((factor: number) => {
    return 34 * factor;
  }, []);

  const handleUserInteraction = useCallback(() => {
    if (!isPlaying) return;
    setIsTemporarilyPaused(true);
    if (userPauseTimerRef.current) clearTimeout(userPauseTimerRef.current);
    userPauseTimerRef.current = setTimeout(() => {
      setIsTemporarilyPaused(false);
    }, 2500);
  }, [isPlaying]);

  useEffect(() => {
    if (!isActive) return;

    window.addEventListener('wheel', handleUserInteraction, { passive: true });
    window.addEventListener('touchmove', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleUserInteraction);
      window.removeEventListener('touchmove', handleUserInteraction);
      if (userPauseTimerRef.current) clearTimeout(userPauseTimerRef.current);
    };
  }, [isActive, handleUserInteraction]);

  useEffect(() => {
    if (!isActive || !isPlaying || isTemporarilyPaused) {
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
        reqIdRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const step = (now: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = now;
      }
      const deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // محاسبه مسافت اسکرول
      const pixelsPerSec = getPixelsPerSecond(speedFactor);
      const deltaPixels = pixelsPerSec * deltaTime;
      fractionalScrollRef.current += deltaPixels;

      if (fractionalScrollRef.current >= 1) {
        const toScroll = Math.floor(fractionalScrollRef.current);
        fractionalScrollRef.current -= toScroll;
        window.scrollBy({ top: toScroll, behavior: 'auto' });

        // بررسی رسیدن به انتهای صفحه
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight;

        if (scrollTop + clientHeight >= scrollHeight - 15) {
          if (onNextPageOrSurah) {
            onNextPageOrSurah();
          } else {
            setIsPlaying(false);
          }
        }
      }

      reqIdRef.current = requestAnimationFrame(step);
    };

    reqIdRef.current = requestAnimationFrame(step);

    return () => {
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
        reqIdRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [isActive, isPlaying, isTemporarilyPaused, speedFactor, getPixelsPerSecond, onNextPageOrSurah]);

  if (!isActive) return null;

  return (
    <div
      id="auto-scroll-floating-bar"
      className="fixed bottom-20 sm:bottom-16 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-sm transition-all duration-300 select-none animate-fadeIn"
      dir="rtl"
    >
      <div
        className={`rounded-2xl p-2 sm:px-3 border-2 shadow-xl backdrop-blur-md flex items-center justify-between gap-2 ${
          darkMode
            ? 'bg-slate-900/95 border-amber-500/40 text-slate-100 shadow-teal-950/60'
            : 'bg-white/95 border-amber-700/30 text-slate-800 shadow-stone-400/40'
        }`}
      >
        {/* کلید توقف / پخش */}
        <button
          onClick={() => setIsPlaying((prev) => !prev)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs transition-all active:scale-95 shrink-0 ${
            isPlaying && !isTemporarilyPaused
              ? 'bg-teal-600 hover:bg-teal-700 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
          }`}
          title={isPlaying ? 'توقف موقت اسکرول' : 'ادامه اسکرول'}
          aria-label={isPlaying ? 'توقف اسکرول' : 'ادامه اسکرول'}
        >
          {isPlaying && !isTemporarilyPaused ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* وضعیت خلاصه */}
        <div className="flex flex-col min-w-0 flex-1 px-1">
          <div className="flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 truncate">
            <ChevronsDown className={`w-3.5 h-3.5 shrink-0 ${isPlaying && !isTemporarilyPaused ? 'animate-bounce' : ''}`} />
            <span className="truncate">
              {isTemporarilyPaused
                ? 'لمس صفحه (توقف کوتاه)'
                : isPlaying
                ? 'اسکرول پیوسته'
                : 'اسکرول متوقف'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            سرعت: {toPersianDigits(speedFactor)}×
          </span>
        </div>

        {/* دسته‌بندی سرعت در ۳ حالت شیک و فشرده */}
        <div className="flex items-center gap-0.5 bg-stone-100/90 dark:bg-slate-800/90 p-0.5 rounded-xl border border-stone-200 dark:border-slate-700 shrink-0">
          {SPEED_PRESETS.map((p) => {
            const isActive = speedFactor === p.factor;
            return (
              <button
                key={p.id}
                onClick={() => setSpeedFactor(p.factor)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={`سرعت ${p.label} (${toPersianDigits(p.factor)} برابر)`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* دکمه بستن */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
          title="بستن اسکرول خودکار"
          aria-label="بستن اسکرول"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
