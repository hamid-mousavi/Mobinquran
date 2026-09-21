import React, { useState, useEffect } from 'react';
import { X, Type, Eye, Palette, Maximize2, Minimize2, AlignJustify, Check, HardDrive, ShieldCheck, ShieldAlert, Smartphone } from 'lucide-react';
import { AppSettings, Translator, ArabicFont, LineHeight } from '../types';
import { getArabicFontFamily, ARABIC_FONT_OPTIONS } from '../utils/fontHelper';
import { getStorageStatus, requestStoragePersistence, StorageStatus } from '../services/pwaManager';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  darkMode: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  darkMode,
}) => {
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

  const handleRequestPersistence = async () => {
    setRequestingPersist(true);
    await requestStoragePersistence();
    const updated = await getStorageStatus();
    setStorageStatus(updated);
    setRequestingPersist(false);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        id="modal-settings-content"
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
      >
        {/* سربرگ */}
        <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-2 font-bold text-base">
            <Type className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>تنظیمات نمایش و قلم قرآن</span>
          </div>
          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* حالت تمام‌صفحه / خلوت معنوی */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-teal-600/30 bg-teal-500/5">
            <div>
              <div className="font-semibold text-sm flex items-center gap-1.5">
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-teal-600" /> : <Maximize2 className="w-4 h-4 text-teal-600" />}
                <span>حالت تمام‌صفحه (خلوت قرآنی)</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">مخفی‌سازی نوارهای بالا و پایین برای قرائت پیوسته</div>
            </div>
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              {isFullscreen ? 'خروج' : 'فعال‌سازی'}
            </button>
          </div>

          {/* اندازه فونت عربی */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span>اندازه متن عربی آیات</span>
              <span className="text-teal-600 dark:text-teal-400 font-mono">{settings.arabicFontSize}px</span>
            </div>
            <input
              type="range"
              min="22"
              max="48"
              step="2"
              value={settings.arabicFontSize}
              onChange={(e) => onUpdateSettings({ arabicFontSize: Number(e.target.value) })}
              className="w-full accent-teal-600 cursor-pointer"
            />
            {/* پیش‌نمایش اندازه قلم عربی */}
            <div
              className={`p-3 rounded-xl text-center border leading-relaxed transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-amber-200'
                  : 'bg-amber-50/50 border-amber-200 text-teal-900'
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
                    className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600/10 text-teal-600 dark:text-teal-400'
                        : 'border-slate-200 dark:border-slate-700'
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
            <label className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>قلم (فونت) رسم‌الخط قرآنی</span>
              </span>
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-normal">
                شامل فونت‌های رسمی مجمع ملک فهد
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ARABIC_FONT_OPTIONS.map((font) => {
                const isSelected = (settings.arabicFont || 'uthman-taha') === font.id;
                return (
                  <button
                    key={font.id}
                    onClick={() => onUpdateSettings({ arabicFont: font.id as ArabicFont })}
                    className={`p-3 rounded-xl border text-right transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600/10 text-teal-900 dark:text-teal-300 ring-1 ring-teal-500/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        <span style={{ fontFamily: getArabicFontFamily(font.id) }}>
                          {font.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {font.subtitle}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
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
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                    settings.activeTranslator === tr.id
                      ? 'border-teal-600 bg-teal-600/10 text-teal-600 dark:text-teal-400'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {tr.title}
                </button>
              ))}
            </div>
          </div>

          {/* سوییچ نمایش ترجمه */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800">
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
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {/* اندازه فونت ترجمه */}
          {settings.showTranslation && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold">
                <span>اندازه قلم ترجمه فارسی</span>
                <span className="text-teal-600 dark:text-teal-400 font-mono">{settings.translationFontSize}px</span>
              </div>
              <input
                type="range"
                min="13"
                max="24"
                step="1"
                value={settings.translationFontSize}
                onChange={(e) => onUpdateSettings({ translationFontSize: Number(e.target.value) })}
                className="w-full accent-teal-600 cursor-pointer"
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
              <PWAInstallButton />
            </div>

            {storageStatus && (
              <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>میزان فضای مصرفی در مرورگر:</span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                    {storageStatus.usageMB} MB {Number(storageStatus.quotaMB) > 0 && ` / ${storageStatus.quotaMB} MB`}
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
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all"
          >
            تأیید و ذخیره
          </button>
        </div>
      </div>
    </div>
  );
};

