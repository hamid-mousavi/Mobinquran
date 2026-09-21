import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // اگر اپ قبلاً نصب شده است، دکمه نیازی نیست
  if (isInstalled) {
    return null;
  }

  // فرآیند نصب برای مرورگرهای پشتیبانی‌کننده (Chrome، Edge، Samsung Internet، Desktop)
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        onClick={install}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 ${className}`}
        title="نصب اپلیکیشن قرآن مبین روی دستگاه"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{variant === 'full' ? 'نصب اپلیکیشن قرآن مبین' : 'نصب وب‌اپ'}</span>
      </button>
    );
  }

  // راهنمای نصب در iOS Safari
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-teal-600/40 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30 text-xs font-semibold transition-all ${className}`}
          title="راهنمای افزودن به صفحه اصلی در آیفون"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{variant === 'full' ? 'نصب در آیفون / آیپد' : 'نصب در iOS'}</span>
        </button>

        {showIOSGuide && (
          <div
            id="ios-install-guide-modal"
            dir="rtl"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  نصب قرآن مبین روی آیفون / آیپد
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                    ۱
                  </div>
                  <div>
                    در نوار پایین مرورگر Safari دکمهٔ <strong>Share</strong> (<Share className="w-3.5 h-3.5 inline mx-0.5" />) را لمس کنید.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                    ۲
                  </div>
                  <div>
                    کمی به پایین اسکرول کنید و گزینهٔ <strong>Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5" /> افزودن به صفحه اصلی) را انتخاب کنید.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                    ۳
                  </div>
                  <div>
                    در گوشه بالا روی <strong>Add</strong> بزنید تا آیکون قرآن مبین به صفحه اصلی افزوده شود.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-teal-600 hover:bg-teal-700 py-2 text-xs sm:text-sm font-bold text-white shadow-md transition-all"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
