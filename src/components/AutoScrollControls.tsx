import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, X, Gauge, ChevronsDown, Sparkles } from 'lucide-react';

interface AutoScrollControlsProps {
  isActive: boolean;
  onClose: () => void;
  darkMode: boolean;
  onNextPageOrSurah?: () => void;
}

export const AutoScrollControls: React.FC<AutoScrollControlsProps> = ({
  isActive,
  onClose,
  darkMode,
  onNextPageOrSurah,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1); // 0.5, 1, 1.5, 2
  const [isTemporarilyPaused, setIsTemporarilyPaused] = useState(false);

  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const userPauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fractionalScrollRef = useRef<number>(0);

  const SPEEDS = [0.5, 1, 1.5, 2, 2.5];

  // محاسبه سرعت پیکسل در ثانیه
  // 1x = 35 پیکسل در ثانیه (حدود ۲ تا ۳ کلمه در ثانیه برای قرائت آرام)
  const getPixelsPerSecond = useCallback((currentSpeed: number) => {
    return 36 * currentSpeed;
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
      const pixelsPerSec = getPixelsPerSecond(speed);
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
  }, [isActive, isPlaying, isTemporarilyPaused, speed, getPixelsPerSecond, onNextPageOrSurah]);

  if (!isActive) return null;

  return (
    <div
      id="auto-scroll-floating-bar"
      className="fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] sm:w-auto min-w-[320px] max-w-lg transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div
        className={`rounded-2xl p-2.5 sm:px-4 border shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ${
          darkMode
            ? 'bg-slate-900/95 border-teal-500/40 text-slate-100 shadow-teal-950/50'
            : 'bg-white/95 border-teal-600/30 text-slate-800 shadow-stone-300'
        }`}
      >
        {/* وضعیت و دکمه توقف/ادامه */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying((prev) => !prev)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-md transition-all active:scale-95 ${
              isPlaying && !isTemporarilyPaused
                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
            }`}
            title={isPlaying ? 'توقف موقت اسکرول' : 'ادامه اسکرول'}
          >
            {isPlaying && !isTemporarilyPaused ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-300">
              <ChevronsDown className={`w-3.5 h-3.5 ${isPlaying && !isTemporarilyPaused ? 'animate-bounce' : ''}`} />
              <span>
                {isTemporarilyPaused
                  ? 'لمس صفحه (توقف کوتاه)...'
                  : isPlaying
                  ? 'اسکرول خودکار فعال'
                  : 'اسکرول متوقف شد'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              سرعت تلاوت: {speed}x
            </div>
          </div>
        </div>

        {/* دکمه‌های سرعت */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                speed === s
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* دکمه بستن */}
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          title="بستن اسکرول خودکار"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
