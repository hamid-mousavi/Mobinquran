import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import {
  isRunningStandalone,
  getDeferredPrompt,
  subscribeToInstallStatus,
  promptPWAInstall,
} from '../services/pwaInstallService';

interface PWAInstallBannerProps {
  darkMode: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ darkMode }) => {
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone());
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsInstalled(isRunningStandalone());
    const unsub = subscribeToInstallStatus(() => {
      setIsInstalled(isRunningStandalone());
    });
    return unsub;
  }, []);

  // اگر اپ به صورت تمام‌صفحه یا standalone نصب شده باشد، بنر نمایش داده نمی‌شود
  if (isInstalled || isDismissed) return null;

  const handleInstallClick = async () => {
    try {
      const outcome = await promptPWAInstall();
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (e) {
      console.error('Install prompt error:', e);
    }
  };

  return (
    <div
      id="pwa-install-banner"
      className={`px-3 py-2 border-b transition-colors flex items-center justify-between text-xs sm:text-sm select-none ${
        darkMode
          ? 'bg-gradient-to-r from-teal-950 via-slate-900 to-amber-950/70 border-teal-900/50 text-slate-200'
          : 'bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 border-teal-700 text-white'
      }`}
    >
      <div className="flex items-center gap-2 max-w-[70%] sm:max-w-none">
        <img
          src="/icon-192.png"
          alt="لوگوی قرآن مبین"
          className="w-7 h-7 rounded-lg object-contain shadow-xs shrink-0 border border-white/20"
        />
        <div>
          <span className="font-bold text-amber-300 ml-1">نصب نسخه اپلیکیشن:</span>
          <span className="opacity-95 hidden sm:inline">اجرای تمام‌صفحه با آیکون اختصاصی و دسترسی ۱۰۰٪ آفلاین</span>
          <span className="opacity-95 sm:hidden">اجرای تمام‌صفحه و آفلاین</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          id="btn-pwa-install-action"
          onClick={handleInstallClick}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold shadow-xs text-xs transition-all active:scale-95 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>نصب برنامه</span>
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          title="بستن پیام"
          aria-label="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
