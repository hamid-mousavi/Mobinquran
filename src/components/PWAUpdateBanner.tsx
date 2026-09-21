import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { onServiceWorkerUpdate, applyAppUpdate } from '../services/pwaManager';

interface PWAUpdateBannerProps {
  isAudioPlaying?: boolean;
}

export const PWAUpdateBanner: React.FC<PWAUpdateBannerProps> = ({ isAudioPlaying = false }) => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = onServiceWorkerUpdate(() => {
      setShowUpdate(true);
    });
    return unsubscribe;
  }, []);

  if (!showUpdate || dismissed) {
    return null;
  }

  const handleApply = async () => {
    setIsUpdating(true);
    await applyAppUpdate();
  };

  return (
    <div
      id="pwa-update-banner"
      dir="rtl"
      className="fixed bottom-20 sm:bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-bounce-subtle"
    >
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-teal-900 to-slate-900 text-white shadow-2xl border border-teal-500/40 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 border border-teal-500/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm text-teal-100 truncate">
              نسخهٔ جدید قرآن مبین آماده است
            </div>
            <div className="text-[11px] text-teal-300/80 truncate">
              {isAudioPlaying
                ? 'به‌روزرسانی آماده است (صوت در حال پخش است)'
                : 'برای بارگذاری تغییرات جدید کلیک کنید'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="btn-apply-pwa-update"
            onClick={handleApply}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'در حال اعمال...' : 'اعمال'}</span>
          </button>
          <button
            id="btn-dismiss-pwa-update"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-teal-300 hover:bg-white/10 transition-colors"
            title="بعداً"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
