import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  downloadAllQcf4Fonts,
  dismissPrompt,
  formatMB,
  loadQcf4Manifest,
  type DownloadProgress,
} from '../services/qcf4FontService';
import { toPersianDigits } from '../utils/textNormalization';

interface Qcf4DownloadSheetProps {
  darkMode: boolean;
  onClose: () => void;
}

type Phase = 'ask' | 'downloading' | 'done' | 'error';

export const Qcf4DownloadSheet: React.FC<Qcf4DownloadSheetProps> = ({ darkMode, onClose }) => {
  const [phase, setPhase] = useState<Phase>('ask');
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    loadQcf4Manifest().then((m) => {
      if (alive && m) setTotalBytes(m.totalBytes);
    });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  const start = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase('downloading');
    try {
      await downloadAllQcf4Fonts(setProgress, ctrl.signal);
      setPhase('done');
      setTimeout(onClose, 1200);
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') {
        setPhase('ask');
      } else {
        console.warn('[QCF4] download failed:', e);
        setPhase('error');
      }
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase('ask');
  };

  const percent =
    progress && progress.totalBytes > 0 ? Math.min(100, Math.round((progress.doneBytes / progress.totalBytes) * 100)) : 0;
  const sizeLabel = totalBytes ? `${toPersianDigits(formatMB(totalBytes))} مگابایت` : '…';

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="دانلود فونت مصحف" dir="rtl">
      <div
        className={`w-full max-w-md rounded-t-3xl border-t-2 border-amber-600 px-5 pt-4 pb-6 space-y-4 shadow-2xl ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-stone-50 text-slate-800'
        }`}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-bold">مصحف مدینه با خط عثمان طه</h2>
            <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
              برای نمایش دقیق صفحات مصحف (۱۵ سطری، با شکل چاپی) باید فونت‌های مصحف یک‌بار دانلود شود. بعد از آن بدون اینترنت هم کار می‌کند.
            </p>
          </div>
          {phase !== 'downloading' && (
            <button
              onClick={() => {
                dismissPrompt(false);
                onClose();
              }}
              aria-label="بستن"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {phase === 'ask' && (
          <div className="space-y-2.5">
            <button
              onClick={start}
              disabled={!totalBytes}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-teal-800 text-amber-200 font-bold text-sm disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <Download className="w-4 h-4" />
              <span>دانلود ({sizeLabel})</span>
            </button>
            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">پیشنهاد می‌شود با Wi‑Fi دانلود کنید.</p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <button
                onClick={() => {
                  dismissPrompt(false);
                  onClose();
                }}
                className="text-slate-600 dark:text-slate-300 underline-offset-2 hover:underline cursor-pointer"
              >
                فعلاً نه (نمایش ساده)
              </button>
              <button
                onClick={() => {
                  dismissPrompt(true);
                  onClose();
                }}
                className="text-slate-400 hover:underline cursor-pointer"
              >
                دیگر نپرس
              </button>
            </div>
          </div>
        )}

        {phase === 'downloading' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال دانلود…
              </span>
              <span className="tabular-nums">
                {toPersianDigits(percent)}٪ — {toPersianDigits(formatMB(progress?.doneBytes ?? 0))} از {sizeLabel}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-stone-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <button
              onClick={cancel}
              className="w-full min-h-[44px] rounded-2xl border border-stone-300 dark:border-slate-600 text-sm font-bold cursor-pointer"
            >
              لغو (پیشرفت حفظ می‌شود)
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-teal-700 dark:text-teal-300">
            <CheckCircle2 className="w-5 h-5" /> فونت مصحف آماده شد
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-2.5">
            <p className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              دانلود کامل نشد؛ اتصال اینترنت را بررسی و دوباره تلاش کنید. فایل‌های دانلودشده حفظ شده‌اند.
            </p>
            <button
              onClick={start}
              className="w-full min-h-[48px] rounded-2xl bg-teal-800 text-amber-200 font-bold text-sm cursor-pointer"
            >
              تلاش دوباره
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
