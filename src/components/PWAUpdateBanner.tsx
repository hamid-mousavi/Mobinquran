import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X, Volume2 } from 'lucide-react';
import { onServiceWorkerUpdate, applyAppUpdate, getIsUpdateAvailable } from '../services/pwaManager';

interface PWAUpdateBannerProps {
  isAudioPlaying?: boolean;
}

export const PWAUpdateBanner: React.FC<PWAUpdateBannerProps> = ({ isAudioPlaying = false }) => {
  const [showBanner, setShowBanner] = useState(getIsUpdateAvailable());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = onServiceWorkerUpdate(() => {
      setShowBanner(true);
      setIsDismissed(false);
    });

    const handleCustomUpdate = () => {
      setShowBanner(true);
      setIsDismissed(false);
    };

    window.addEventListener('mobin-sw-update', handleCustomUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('mobin-sw-update', handleCustomUpdate);
    };
  }, []);

  if (!showBanner || isDismissed) {
    return null;
  }

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await applyAppUpdate();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      dir="rtl"
      className={`fixed left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[70] transition-all duration-300 ${
        isAudioPlaying ? 'bottom-28 sm:bottom-24' : 'bottom-4'
      }`}
    >

      <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-teal-500/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-500/20 text-teal-300 rounded-xl shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-xs font-bold text-white">نسخه جدید قرآن مبین آماده است</p>
            <p className="text-[11px] text-teal-200/80">
              {isAudioPlaying ? (
                <span className="flex items-center gap-1 text-amber-300">
                  <Volume2 className="w-3 h-3" />
                  <span>پخش صوت فعال است؛ پس از اتمام بروزرسانی کنید</span>
                </span>
              ) : (
                'برای دریافت بهبودها و امکانات جدید بروزرسانی کنید'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'در حال نصب...' : 'بروزرسانی'}</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            aria-label="بستن اعلان"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
