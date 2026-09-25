import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
  Smartphone,
  CheckCircle2,
  Share,
  AlertTriangle,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import {
  isIosDevice,
  isInAppBrowser,
  isRunningStandalone,
  promptPWAInstall,
  getDeferredPrompt,
  subscribeToInstallStatus,
} from '../services/pwaInstallService';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  darkMode,
}) => {
  const [hasPrompt, setHasPrompt] = useState(!!getDeferredPrompt());
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const unsub = subscribeToInstallStatus(() => {
      setHasPrompt(!!getDeferredPrompt());
      setIsInstalled(isRunningStandalone());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const isIOS = isIosDevice();
  const inApp = isInAppBrowser();

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const outcome = await promptPWAInstall();
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setTimeout(onClose, 1000);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn font-['Vazirmatn'] select-none"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          darkMode
            ? 'bg-slate-900 border-slate-700/80 text-slate-100 shadow-black/80'
            : 'bg-white border-stone-200 text-slate-800 shadow-slate-400/30'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* سربرگ مودال */}
        <div className="p-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between bg-stone-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon-192.png"
              alt="قرآن مبین"
              className="w-10 h-10 rounded-xl object-contain shadow-xs border border-teal-600/20"
            />
            <div>
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                نصب اپلیکیشن قرآن مبین
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                نسخه پیشرفته وب‌اپلیکیشن (PWA)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوای مودال */}
        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* وضعیت: از قبل نصب‌شده */}
          {isInstalled ? (
            <div className="p-4 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-800 dark:text-teal-300 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-teal-600 dark:text-teal-400" />
              <div className="text-xs sm:text-sm font-medium">
                اپلیکیشن قرآن مبین هم‌اکنون روی دستگاه شما نصب است و به صورت مستقل و تمام‌صفحه اجرا می‌شود.
              </div>
            </div>
          ) : (
            <>
              {/* هشدار مرورگر داخلی پیام‌رسان‌ها (تلگرام/ایتا/واتساپ/روبیکا) */}
              {inApp && (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>علت ساخت شورتکات به جای نصب برنامه:</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    شما در حال مشاهده لینک در <strong>مرورگر داخلی پیام‌رسان (تلگرام / ایتا / واتساپ)</strong> هستید. مرورگرهای داخلی اجازه نصب واقعی برنامه را ندارند و فقط شورتکات می‌سازند.
                  </p>
                  <div className="p-2 rounded-lg bg-amber-500/20 text-xs font-semibold flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-300" />
                    <span>روی ۳ نقطه بالای صفحه بزنید و «باز کردن در مرورگر کروم» (Open in Chrome) را انتخاب کنید.</span>
                  </div>
                </div>
              )}

              {/* دکمه نصب مستقیم (اگر کروم پرامپت آماده دارد) */}
              {hasPrompt && !inApp && (
                <button
                  onClick={handleInstallClick}
                  disabled={isInstalling}
                  className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <Download className="w-5 h-5" />
                  <span>{isInstalling ? 'در حال فعال‌سازی نصب...' : 'نصب مستقیم اپلیکیشن روی دستگاه'}</span>
                </button>
              )}

              {/* مزایای نصب نسخه اپلیکیشن */}
              <div className="p-3 rounded-xl bg-stone-100/70 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  مزایای نصب نسخه برنامه:
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>قرائت ۱۰۰٪ آفلاین</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>حذف نوار آدرس مرورگر</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>دسترسی مستقیم از صفحه اصلی</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>بدون اشغال حجم گوشی</span>
                  </div>
                </div>
              </div>

              {/* راهنمای گام‌به‌گام بر اساس سیستم‌عامل */}
              {isIOS ? (
                /* راهنمای آیفون / آیپد */
                <div className="space-y-2 border-t border-stone-200 dark:border-slate-800 pt-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Share className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>راهنمای نصب در آیفون / آیپد (Safari):</span>
                  </div>
                  <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        ۱
                      </span>
                      <span>سایت را در مرورگر <strong>Safari</strong> باز فرمایید.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        ۲
                      </span>
                      <span>دکمه <strong>Share (اشتراک‌گذاری ⎋)</strong> را در پایین مرورگر لمس کنید.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        ۳
                      </span>
                      <span>گزینه <strong>«Add to Home Screen» (افزودن به صفحه اصلی)</strong> را انتخاب و سپس روی <strong>Add</strong> بزنید.</span>
                    </li>
                  </ol>
                </div>
              ) : (
                /* راهنمای اندروید / کروم */
                <div className="space-y-2 border-t border-stone-200 dark:border-slate-800 pt-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>راهنمای نصب در اندروید (مرورگر کروم Chrome):</span>
                  </div>
                  <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        ۱
                      </span>
                      <span>لینک را حتماً در <strong>مرورگر Google Chrome</strong> باز کنید (نه داخل تلگرام/ایتا).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        ۲
                      </span>
                      <span>روی <strong>منوی سه‌نقطه (⋮)</strong> در بالا سمت راست مرورگر بزنید.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        ۳
                      </span>
                      <span>
                        گزینه <strong>«نصب برنامه» (Install app)</strong> را انتخاب کنید تا برنامه با لوگوی رسمی دانلود و نصب شود.
                      </span>
                    </li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        {/* پایین مودال */}
        <div className="p-3 border-t border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-slate-800 hover:bg-stone-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
