import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, CheckCircle, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallBannerProps {
  darkMode: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ darkMode }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // بررسی اینکه آیا از قبل به صورت Standalone نصب شده
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // تشخیص iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // اگر نصب شده یا کاربر بنر را بسته باشد و یا پرامپت آماده نباشد (مگر در ios) نمایش نمی‌دهیم
  if (isInstalled || isDismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <div
        id="pwa-install-banner"
        className={`px-3 py-2 border-b transition-colors flex items-center justify-between text-xs sm:text-sm ${
          darkMode
            ? 'bg-gradient-to-r from-teal-950/90 via-slate-900 to-amber-950/70 border-teal-900/50 text-slate-200'
            : 'bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 border-teal-700 text-white'
        }`}
      >
        <div className="flex items-center gap-2 max-w-[75%] sm:max-w-none">
          <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-amber-300 ml-1">نصب نسخه اپلیکیشن:</span>
            <span className="opacity-95 hidden sm:inline">برای دسترسی آفلاین و اجرای تمام‌صفحه بدون نوار مرورگر</span>
            <span className="opacity-95 sm:hidden">اجرای آفلاین و تمام‌صفحه</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="btn-pwa-install-action"
            onClick={handleInstallClick}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold shadow text-xs transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>نصب رایگان</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="بستن پیام"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* راهنمای ویژه نصب در سیستم‌عامل iOS Safari */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-stone-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <div className="font-bold text-sm flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                <Share className="w-4 h-4" />
                <span>راهنمای نصب در آیفون / آیپد (iOS)</span>
              </div>
              <button onClick={() => setShowIOSGuide(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300 flex items-center justify-center font-bold shrink-0">
                  ۱
                </span>
                <span>در مرورگر Safari دکمه اشتراک‌گذاری (Share) در پایین صفحه را لمس فرمایید.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300 flex items-center justify-center font-bold shrink-0">
                  ۲
                </span>
                <span>گزینه «Add to Home Screen» (افزودن به صفحه اصلی) را انتخاب کنید.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300 flex items-center justify-center font-bold shrink-0">
                  ۳
                </span>
                <span>روی دکمه «Add» بزنید تا آیکون قرآن مبین به صفحه گوشی شما اضافه شود.</span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full mt-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
