import React, { useState, useEffect } from 'react';
import { X, Eye, Palette, Maximize2, Minimize2, AlignJustify, Check, HardDrive, ShieldCheck, ShieldAlert, Smartphone, RefreshCw } from 'lucide-react';
import { AppSettings, Translator, ArabicFont, LineHeight } from '../types';
import { getArabicFontFamily, ARABIC_FONT_OPTIONS } from '../utils/fontHelper';
import { getStorageStatus, requestStoragePersistence, checkForUpdates, StorageStatus } from '../services/pwaManager';
import { toPersianDigits } from '../utils/textNormalization';
import { useModalA11y } from '../hooks/useModalA11y';
import { BackupSection } from './BackupSection';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenAbout?: () => void;
  darkMode: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenAbout,
  darkMode,
}) => {
  const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [requestingPersist, setRequestingPersist] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (isOpen) {
      getStorageStatus().then(setStorageStatus).catch(() => {});
    }
  }, [isOpen]);

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckMsg, setUpdateCheckMsg] = useState<string | null>(null);

  const handleRequestPersistence = async () => {
    setRequestingPersist(true);
    await requestStoragePersistence();
    const updated = await getStorageStatus();
    setStorageStatus(updated);
    setRequestingPersist(false);
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateCheckMsg(null);
    try {
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        window.dispatchEvent(new CustomEvent('mobin-sw-update'));
        setUpdateCheckMsg('نسخه جدید یافت شد و بنر بروزرسانی در پایین صفحه فعال گردید.');
      } else {
        setUpdateCheckMsg('شما از آخرین نسخه برنامه استفاده می‌کنید.');
        setTimeout(() => setUpdateCheckMsg(null), 4000);
      }
    } catch {
      setUpdateCheckMsg('خطا در بررسی بروزرسانی؛ اتصال اینترنت را بررسی کنید.');
      setTimeout(() => setUpdateCheckMsg(null), 4000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-settings-backdrop"
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        id="modal-settings-content"
        role="dialog"
        aria-modal="true"
        aria-label="تنظیمات نمایش و قلم قرآن"
        className={`w-full max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-amber-600 shadow-2xl overflow-hidden transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-stone-50 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* سربرگ */}
        <div className={`shrink-0 px-5 pt-3 pb-3 border-b flex items-center justify-between ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-amber-300/60 bg-stone-50'}`}>
          <div className="flex items-center gap-3 font-extrabold text-base">
            <span className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-[15px] font-black">Aa</span>
            <span>تنظیمات نمایش و قلم قرآن</span>
          </div>
          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer" aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-5 space-y-5 overflow-y-auto">
          {/* حالت تمام‌صفحه / خلوت معنوی */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50 dark:bg-teal-950/30">
            <div>
              <div className="font-semibold text-sm flex items-center gap-1.5">
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-teal-600" /> : <Maximize2 className="w-4 h-4 text-teal-600" />}
                <span>حالت تمام‌صفحه (خلوت قرآنی)</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">مخفی‌سازی نوارهای بالا و پایین برای قرائت پیوسته</div>
            </div>
            <button
              onClick={toggleFullscreen}
              className="min-h-[44px] px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              {isFullscreen ? 'خروج' : 'فعال‌سازی'}
            </button>
          </div>

          {/* اندازه فونت عربی */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold">
              <label htmlFor="range-arabic-font-size" className="cursor-pointer">
                اندازه متن عربی آیات
              </label>
              <span className="text-teal-600 dark:text-teal-400 font-bold">{toPersianDigits(settings.arabicFontSize)} پیکسل</span>
            </div>
            <input
              id="range-arabic-font-size"
              type="range"
              min="22"
              max="56"
              step="2"
              value={settings.arabicFontSize}
              onChange={(e) => onUpdateSettings({ arabicFontSize: Number(e.target.value) })}
              className="w-full accent-teal-600 cursor-pointer"
              aria-label="اندازه متن عربی آیات (تا ۲۰۰ درصد)"
            />
            {/* پیش‌نمایش اندازه قلم عربی */}
            <div
              className={`p-3 rounded-xl text-center border leading-relaxed transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-amber-200'
                  : 'bg-amber-50 border-amber-300 text-teal-900'
              }`}
              style={{
                fontSize: `${settings.arabicFontSize}px`,
                fontFamily: getArabicFontFamily(settings.arabicFont),
              }}
            >
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
          </div>

          {/* فاصله خطوط (Line Height) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <AlignJustify className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>فاصله بین خطوط (ارتفاع سطر)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', title: 'معمولی' },
                { id: 'relaxed', title: 'متوسط' },
                { id: 'loose', title: 'باز و خوانا' },
              ].map((lh) => {
                const isSelected = (settings.lineHeight || 'relaxed') === lh.id;
                return (
                  <button
                    key={lh.id}
                    onClick={() => onUpdateSettings({ lineHeight: lh.id as LineHeight })}
                    className={`min-h-[44px] p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600/10 text-teal-600 dark:text-teal-400'
                        : 'border-amber-300/70 dark:border-slate-700 bg-white/60 dark:bg-transparent'
                    }`}
                  >
                    {lh.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* نوع فونت عربی */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>قلم (فونت) رسم‌الخط قرآنی</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ARABIC_FONT_OPTIONS.map((font) => {
                const isSelected = (settings.arabicFont || 'ir-mushaf') === font.id;
                return (
                  <button
                    key={font.id}
                    onClick={() => onUpdateSettings({ arabicFont: font.id as ArabicFont })}
                    className={`min-h-[50px] px-3.5 py-3 rounded-xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600/10 text-teal-900 dark:text-teal-300 ring-1 ring-teal-500/30'
                        : 'border-amber-300/70 dark:border-slate-700 bg-white/60 dark:bg-transparent hover:bg-white dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-base font-bold" style={{ fontFamily: getArabicFontFamily(font.id) }}>
                      {font.name}
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* مترجم پیش‌فرض */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>مترجم فارسی پیش‌فرض</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'makarem', title: 'مکارم شیرازی' },
                { id: 'fooladvand', title: 'فولادوند' },
                { id: 'ansarian', title: 'انصاریان' },
              ].map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => onUpdateSettings({ activeTranslator: tr.id as Translator })}
                  className={`min-h-[44px] p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    settings.activeTranslator === tr.id
                      ? 'border-teal-600 bg-teal-600/10 text-teal-600 dark:text-teal-400'
                      : 'border-amber-300/70 dark:border-slate-700 bg-white/60 dark:bg-transparent'
                  }`}
                >
                  {tr.title}
                </button>
              ))}
            </div>
          </div>

          {/* سوییچ نمایش ترجمه */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-amber-300/70 dark:border-slate-800 bg-white/60 dark:bg-transparent">
            <div>
              <div className="font-semibold text-sm">نمایش ترجمه زیر آیات</div>
              <div className="text-xs text-slate-400">امکان مطالعه بدون ترجمه (فقط متن عربی)</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showTranslation}
                onChange={(e) => onUpdateSettings({ showTranslation: e.target.checked })}
                className="sr-only peer"
                aria-label="نمایش ترجمه زیر آیات"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {/* اندازه فونت ترجمه */}
          {settings.showTranslation && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold">
                <label htmlFor="range-translation-font-size" className="cursor-pointer">
                  اندازه قلم ترجمه فارسی
                </label>
                <span className="text-teal-600 dark:text-teal-400 font-bold">{toPersianDigits(settings.translationFontSize)} پیکسل</span>
              </div>
              <input
                id="range-translation-font-size"
                type="range"
                min="13"
                max="30"
                step="1"
                value={settings.translationFontSize}
                onChange={(e) => onUpdateSettings({ translationFontSize: Number(e.target.value) })}
                className="w-full accent-teal-600 cursor-pointer"
                aria-label="اندازه قلم ترجمه فارسی (تا ۲۰۰ درصد)"
              />
            </div>
          )}

          {/* ماندگاری داده‌ها و نصب وب‌اپ (PWA & Storage Persistence) */}
          <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>فضای آفلاین و ماندگاری حافظه</span>
              </label>
            </div>

            {storageStatus && (
              <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>میزان فضای مصرفی در مرورگر:</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">
                    {toPersianDigits(storageStatus.usageMB)} مگابایت {Number(storageStatus.quotaMB) > 0 && ` از ${toPersianDigits(storageStatus.quotaMB)} مگابایت`}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {storageStatus.isPersisted ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span>
                      {storageStatus.isPersisted
                        ? 'ماندگاری دائم فعال است'
                        : 'ذخیره موقت مرورگر'}
                    </span>
                  </div>
                  {!storageStatus.isPersisted && (
                    <button
                      onClick={handleRequestPersistence}
                      disabled={requestingPersist}
                      className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] shadow-sm transition disabled:opacity-50"
                    >
                      {requestingPersist ? 'در حال ثبت...' : 'فعال‌سازی ماندگاری دائم'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* پشتیبان‌گیری و بازیابی پیشرفت کاربر */}
          <BackupSection darkMode={darkMode} />

          {/* بررسی نسخه‌ی جدید برنامه و دریافت به‌روزرسانی */}
          <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <div className={`p-3 rounded-xl border text-xs space-y-2 ${
              darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <RefreshCw className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">به‌روزرسانی برنامه</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">بررسی خودکار و دستی آخرین نسخه</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUpdate ? 'در حال بررسی...' : 'بررسی بروزرسانی'}</span>
                </button>
              </div>

              {updateCheckMsg && (
                <div className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 animate-in fade-in">
                  {updateCheckMsg}
                </div>
              )}
            </div>
          </div>
        </div>


        <div
          className="shrink-0 px-5 pt-3 border-t border-amber-300/60 dark:border-slate-800 bg-stone-50 dark:bg-slate-900"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          <button
            onClick={onClose}
            className="w-full min-h-[50px] rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-[15px] shadow-md transition-all cursor-pointer active:scale-[0.99]"
          >
            تأیید و ذخیره
          </button>
        </div>
      </div>
    </div>
  );
};

