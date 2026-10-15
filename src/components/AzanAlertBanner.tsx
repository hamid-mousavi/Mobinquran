import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, X, Clock, Sparkles } from 'lucide-react';
import { stopAllAzanAudio } from '../services/azanService';

interface AzanAlertDetail {
  prayerName: string;
  muezzinName: string;
  timestamp: string;
}

export const AzanAlertBanner: React.FC = () => {
  const [alertData, setAlertData] = useState<AzanAlertDetail | null>(null);

  useEffect(() => {
    const handleAzanAlert = (e: any) => {
      if (e.detail) {
        setAlertData(e.detail);
      }
    };

    window.addEventListener('mobin-azan-alert', handleAzanAlert);
    return () => {
      window.removeEventListener('mobin-azan-alert', handleAzanAlert);
    };
  }, []);

  if (!alertData) return null;

  const handleDismiss = () => {
    stopAllAzanAudio();
    setAlertData(null);
  };

  const handleOpenPrayerModal = () => {
    window.dispatchEvent(new CustomEvent('mobin-open-prayer-times'));
    setAlertData(null);
  };

  return (
    <div
      className="fixed top-4 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-md z-[90] bg-slate-900/95 dark:bg-teal-950/95 text-white p-4 rounded-3xl shadow-2xl border border-teal-500/40 backdrop-blur-md animate-slideDown select-none"
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center shrink-0 shadow-lg animate-pulse">
            <Volume2 className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <h4 className="font-black text-sm text-amber-300">
                {alertData.prayerName}
              </h4>
            </div>

            <p className="text-xs text-slate-200 mt-1 leading-relaxed">
              نوای ملکوتی اذان شیعه با صدای <b>{alertData.muezzinName}</b>
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>توقف صوت</span>
              </button>

              <button
                onClick={handleOpenPrayerModal}
                className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>مشاهده اوقات شرعی</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
