import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Download,
  Trash2,
  Play,
  Square,
  Bell,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Music,
  Check,
} from 'lucide-react';
import {
  MUEZZINS_LIST,
  PRE_AZAN_DUAS_LIST,
  AzanSettings,
  getAzanSettings,
  saveAzanSettings,
  getDownloadedMuezzinIds,
  downloadMuezzinAudio,
  deleteDownloadedMuezzin,
  getDownloadedDuaIds,
  downloadDuaAudio,
  deleteDownloadedDua,
  playAzanPreview,
  playDuaPreview,
  stopAzanPreview,
  getCurrentPreviewState,
  getNotificationPermissionStatus,
  requestAzanNotificationPermission,
  testAzanAlertNow,
  NotificationPermissionState,
} from '../services/azanService';
import { toPersianDigits } from '../utils/textNormalization';

interface AzanSettingsSectionProps {
  darkMode: boolean;
}

export const AzanSettingsSection: React.FC<AzanSettingsSectionProps> = ({}) => {
  const [settings, setSettings] = useState<AzanSettings>(getAzanSettings());
  const [downloadedIds, setDownloadedIds] = useState<string[]>(getDownloadedMuezzinIds());
  const [downloadedDuaIds, setDownloadedDuaIds] = useState<string[]>(getDownloadedDuaIds());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [previewState, setPreviewState] = useState(getCurrentPreviewState());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>(
    getNotificationPermissionStatus()
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handlePreviewState = (e: any) => {
      setPreviewState(e.detail || { isPlaying: false, id: null, type: null });
    };
    const handleDownloadsChanged = (e: any) => {
      setDownloadedIds(e.detail || []);
    };
    const handleDuasDownloadsChanged = (e: any) => {
      setDownloadedDuaIds(e.detail || []);
    };

    window.addEventListener('mobin-azan-preview-state', handlePreviewState);
    window.addEventListener('mobin-azan-downloads-changed', handleDownloadsChanged);
    window.addEventListener('mobin-duas-downloads-changed', handleDuasDownloadsChanged);

    return () => {
      window.removeEventListener('mobin-azan-preview-state', handlePreviewState);
      window.removeEventListener('mobin-azan-downloads-changed', handleDownloadsChanged);
      window.removeEventListener('mobin-duas-downloads-changed', handleDuasDownloadsChanged);
      stopAzanPreview();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const updateSetting = <K extends keyof AzanSettings>(key: K, value: AzanSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveAzanSettings(updated);
  };

  const handleSelectMuezzin = (id: string) => {
    updateSetting('selectedMuezzinId', id);
    const m = MUEZZINS_LIST.find((item) => item.id === id);
    showToast(`مؤذن اذان به «${m?.name}» تغییر یافت.`);
  };

  const handleSelectPreDua = (id: string) => {
    updateSetting('selectedPreDuaId', id);
    const d = PRE_AZAN_DUAS_LIST.find((item) => item.id === id);
    showToast(`دعای قبل از اذان به «${d?.name}» تنظیم شد.`);
  };

  const handleTogglePlayMuezzin = async (id: string) => {
    if (previewState.isPlaying && previewState.id === id) {
      stopAzanPreview();
    } else {
      await playAzanPreview(id, () => {
        setPreviewState({ isPlaying: false, id: null, type: null });
      });
    }
  };

  const handleTogglePlayDua = async (id: string) => {
    if (previewState.isPlaying && previewState.id === id) {
      stopAzanPreview();
    } else {
      await playDuaPreview(id, () => {
        setPreviewState({ isPlaying: false, id: null, type: null });
      });
    }
  };

  const handleDownloadMuezzin = async (id: string) => {
    const muezzin = MUEZZINS_LIST.find((m) => m.id === id);
    if (!muezzin) return;
    try {
      setDownloadingId(id);
      setDownloadProgress(20);
      await downloadMuezzinAudio(id, (p) => setDownloadProgress(p));
      setDownloadedIds(getDownloadedMuezzinIds());
      setDownloadingId(null);
      showToast(`صوت اذان «${muezzin.name}» با موفقیت ذخیره شد.`);
    } catch (err: any) {
      setDownloadingId(null);
      showToast(err.message || 'خطا در بارگیری صوت');
    }
  };

  const handleDeleteDownloadMuezzin = async (id: string) => {
    await deleteDownloadedMuezzin(id);
    setDownloadedIds(getDownloadedMuezzinIds());
    showToast('صوت از حافظه دستگاه حذف شد.');
  };

  const handleDownloadDua = async (id: string) => {
    const dua = PRE_AZAN_DUAS_LIST.find((d) => d.id === id);
    if (!dua) return;
    try {
      setDownloadingId(id);
      setDownloadProgress(25);
      await downloadDuaAudio(id, (p) => setDownloadProgress(p));
      setDownloadedDuaIds(getDownloadedDuaIds());
      setDownloadingId(null);
      showToast(`صوت «${dua.name}» ذخیره شد.`);
    } catch (err: any) {
      setDownloadingId(null);
      showToast(err.message || 'خطا در دانلود دعا');
    }
  };

  const handleDeleteDownloadDua = async (id: string) => {
    await deleteDownloadedDua(id);
    setDownloadedDuaIds(getDownloadedDuaIds());
    showToast('صوت دعا از حافظه پاک شد.');
  };

  const handleRequestPermission = async () => {
    const granted = await requestAzanNotificationPermission();
    const current = getNotificationPermissionStatus();
    setPermissionStatus(current);
    if (granted) {
      updateSetting('systemNotificationEnabled', true);
      showToast('اعلان‌های مرورگر با موفقیت فعال شدند ✓');
    } else {
      showToast('مرورگر دسترسی را تأیید نکرد. لطفاً در صورت نیاز از تنظیمات مرورگر اجازه دهید.');
    }
  };

  const handleTestAlert = async () => {
    await testAzanAlertNow();
    showToast('هشدار اذان به صورت آزمایشی پخش شد.');
  };

  const currentMuezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];
  const currentDua = PRE_AZAN_DUAS_LIST.find((d) => d.id === settings.selectedPreDuaId) || PRE_AZAN_DUAS_LIST[0];

  const isCurrentMuezzinPlaying = previewState.isPlaying && previewState.id === currentMuezzin.id;
  const isCurrentMuezzinDownloaded = downloadedIds.includes(currentMuezzin.id);
  const isCurrentMuezzinDownloading = downloadingId === currentMuezzin.id;

  const isCurrentDuaPlaying = previewState.isPlaying && previewState.id === currentDua.id;
  const isCurrentDuaDownloaded = downloadedDuaIds.includes(currentDua.id);
  const isCurrentDuaDownloading = downloadingId === currentDua.id;

  return (
    <div className="space-y-4 text-right pb-6 w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
      {/* پیام موقت اعلان */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] bg-slate-900/95 dark:bg-teal-950/95 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl border border-teal-500/30 flex items-center gap-2 animate-fadeIn backdrop-blur-md max-w-[90vw] truncate">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* ۱. تنظیم فشرده و انتخابی قاری اذان (فقط اذان شیعه) */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-2xl p-3 sm:p-4 border border-stone-200/80 dark:border-slate-800 space-y-3 w-full max-w-full overflow-hidden min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                قاری و مؤذن اذان (فقط شیعه)
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                همه با شهادت به ولایت امیرالمؤمنین (ع)
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-md border border-teal-500/20 shrink-0 whitespace-nowrap">
            {toPersianDigits(MUEZZINS_LIST.length)} نوای اصیل
          </span>
        </div>

        {/* فیلد انتخابی (Select) فشرده به جای کارت‌های طویل */}
        <div className="space-y-2 w-full min-w-0">
          <div className="flex items-center gap-2 w-full min-w-0">
            <div className="flex-1 min-w-0">
              <select
                value={settings.selectedMuezzinId}
                onChange={(e) => handleSelectMuezzin(e.target.value)}
                className="w-full min-w-0 p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer truncate"
              >
                {MUEZZINS_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* کلید پخش آزمایشی */}
            <button
              onClick={() => handleTogglePlayMuezzin(currentMuezzin.id)}
              title={isCurrentMuezzinPlaying ? 'توقف صوت' : 'شنیدن صوت اذان'}
              className={`p-2 sm:p-2.5 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                isCurrentMuezzinPlaying
                  ? 'bg-teal-600 text-white animate-pulse'
                  : 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-300 hover:bg-teal-100 border border-teal-500/30'
              }`}
            >
              {isCurrentMuezzinPlaying ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            {/* کلید ذخیره آفلاین */}
            {!isCurrentMuezzinDownloaded ? (
              <button
                onClick={() => handleDownloadMuezzin(currentMuezzin.id)}
                disabled={isCurrentMuezzinDownloading}
                title="دانلود برای پخش آفلاین بدون نیاز به اینترنت"
                className="p-2 sm:p-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-200 flex items-center justify-center shrink-0 cursor-pointer border border-stone-200 dark:border-slate-700"
              >
                <Download className={`w-4 h-4 ${isCurrentMuezzinDownloading ? 'animate-bounce' : ''}`} />
              </button>
            ) : (
              <button
                onClick={() => handleDeleteDownloadMuezzin(currentMuezzin.id)}
                title="ذخیره شده آفلاین (کلیک برای حذف)"
                className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center shrink-0 cursor-pointer border border-emerald-500/30 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* توضیح موجز مؤذن انتخاب شده */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-stone-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 w-full min-w-0">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed min-w-0 break-words">
              {currentMuezzin.description}
            </p>
            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 shrink-0 self-start sm:self-auto bg-teal-50 dark:bg-teal-950/50 px-1.5 py-0.5 rounded border border-teal-500/20 whitespace-nowrap">
              دستگاه: {currentMuezzin.maqam}
            </span>
          </div>
        </div>
      </section>

      {/* ۲. تنظیم فشرده و انتخابی ادعیه قبل از اذان */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-2xl p-3 sm:p-4 border border-stone-200/80 dark:border-slate-800 space-y-3 w-full max-w-full overflow-hidden min-w-0">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              id="enablePreDua"
              checked={settings.playPreAzanDua}
              onChange={(e) => updateSetting('playPreAzanDua', e.target.checked)}
              className="w-4 h-4 accent-teal-600 rounded cursor-pointer shrink-0"
            />
            <label htmlFor="enablePreDua" className="cursor-pointer min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                پخش دعا و مناجات پیش از اذان
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                پخش خودکار ادعیه قبل از حلول وقت نماز
              </p>
            </label>
          </div>

          {settings.playPreAzanDua && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
              <span>فاصله:</span>
              <select
                value={settings.preAlertMinutes}
                onChange={(e) => updateSetting('preAlertMinutes', Number(e.target.value) as 0 | 5 | 10 | 15)}
                className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-lg p-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 focus:outline-none cursor-pointer"
              >
                <option value={5}>{toPersianDigits(5)} دقیقه قبل</option>
                <option value={10}>{toPersianDigits(10)} دقیقه قبل</option>
                <option value={15}>{toPersianDigits(15)} دقیقه قبل</option>
              </select>
            </div>
          )}
        </div>

        {/* انتخاب دعا به صورت انتخابی (فشرده) */}
        {settings.playPreAzanDua && (
          <div className="space-y-2 pt-1 border-t border-stone-100 dark:border-slate-800 w-full min-w-0">
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className="flex-1 min-w-0">
                <select
                  value={settings.selectedPreDuaId}
                  onChange={(e) => handleSelectPreDua(e.target.value)}
                  className="w-full min-w-0 p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer truncate"
                >
                  {PRE_AZAN_DUAS_LIST.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* کلید پخش آزمایشی دعا */}
              <button
                onClick={() => handleTogglePlayDua(currentDua.id)}
                title={isCurrentDuaPlaying ? 'توقف پخش' : 'شنیدن صوت دعا'}
                className={`p-2 sm:p-2.5 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  isCurrentDuaPlaying
                    ? 'bg-purple-600 text-white animate-pulse'
                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 hover:bg-purple-100 border border-purple-500/30'
                }`}
              >
                {isCurrentDuaPlaying ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>

              {/* کلید دانلود آفلاین دعا */}
              {!isCurrentDuaDownloaded ? (
                <button
                  onClick={() => handleDownloadDua(currentDua.id)}
                  disabled={isCurrentDuaDownloading}
                  title="دانلود دعا برای آفلاین"
                  className="p-2 sm:p-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-200 flex items-center justify-center shrink-0 cursor-pointer border border-stone-200 dark:border-slate-700"
                >
                  <Download className={`w-4 h-4 ${isCurrentDuaDownloading ? 'animate-bounce' : ''}`} />
                </button>
              ) : (
                <button
                  onClick={() => handleDeleteDownloadDua(currentDua.id)}
                  title="ذخیره شده (کلیک برای حذف)"
                  className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center shrink-0 cursor-pointer border border-emerald-500/30 transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-stone-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed w-full min-w-0 break-words">
              {currentDua.description}
            </div>
          </div>
        )}
      </section>

      {/* ۳. تنظیم هشدار و وضعیت اعلان‌ها (ساده، مستقیم و بدون توضیحات طولانی) */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-2xl p-3 sm:p-4 border border-stone-200/80 dark:border-slate-800 space-y-3 w-full max-w-full overflow-hidden min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              هشدار و اعلان اذان
            </h3>
          </div>

          <button
            onClick={handleTestAlert}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="whitespace-nowrap">تست زنده</span>
          </button>
        </div>

        {/* وضعیت دسترسی اعلان مرورگر - مستقیم با یک دکمه بدون متن‌های طولانی */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 space-y-2 text-xs w-full min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-slate-700 dark:text-slate-300 font-bold text-[11px] sm:text-xs truncate">
              اعلان‌های مرورگر (نوتیفیکیشن):
            </span>

            {permissionStatus === 'granted' ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px] shrink-0 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>فعال ✓</span>
              </span>
            ) : (
              <button
                onClick={handleRequestPermission}
                className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] sm:text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <span>درخواست دسترسی</span>
              </button>
            )}
          </div>

          {/* توضیح اختصاصی حالت سایلنت و کارکرد در پس‌زمینه */}
          <div className="p-2 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-500/20 text-[11px] text-teal-900 dark:text-teal-200 leading-relaxed">
            <p className="font-bold flex items-center gap-1 mb-0.5 text-teal-700 dark:text-teal-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>کارکرد در حالت سایلنت و بستن برنامه:</span>
            </p>
            <p className="text-[10.5px] opacity-90">
              هشدار اذان مجهز به الگوی ارتعاش پرقدرت است که هنگام سایلنت بودن گوشی نیز شما را باخبر می‌کند. با لمس اعلان، برنامه فوراً باز شده و نوای ملکوتی اذان به صورت کامل پخش می‌شود.
            </p>
          </div>

          {permissionStatus === 'denied' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 w-full min-w-0">
              <span className="leading-relaxed min-w-0 break-words">مرورگر اعلان را مسدود کرده است. کلیک کنید تا مجدداً درخواست شود:</span>
              <button
                onClick={handleRequestPermission}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 cursor-pointer self-start sm:self-auto whitespace-nowrap"
              >
                تلاش مجدد
              </button>
            </div>
          )}
        </div>

        {/* کلیدهای انتخاب هشدار برای اوقات پنج‌گانه */}
        <div className="space-y-1.5 pt-1 w-full min-w-0">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block truncate">
            پخش اذان و هشدار برای کدام نمازها:
          </span>
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 text-center w-full min-w-0">
            {[
              { key: 'fajrAlert', label: 'صبح' },
              { key: 'dhuhrAlert', label: 'ظهر' },
              { key: 'asrAlert', label: 'عصر' },
              { key: 'maghribAlert', label: 'مغرب' },
              { key: 'ishaAlert', label: 'عشاء' },
            ].map(({ key, label }) => {
              const active = (settings as any)[key];
              return (
                <button
                  key={key}
                  onClick={() => updateSetting(key as any, !active)}
                  className={`py-1.5 px-0.5 sm:px-1 rounded-xl text-xs font-bold transition-all cursor-pointer border truncate min-w-0 ${
                    active
                      ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-stone-200 dark:border-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* نوار تنظیم میزان صدا */}
        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-stone-100 dark:border-slate-800 text-xs w-full min-w-0">
          <span className="text-slate-600 dark:text-slate-400 font-bold shrink-0 flex items-center gap-1.5">
            {settings.volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-teal-600" />}
            <span className="whitespace-nowrap">صدای اذان:</span>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(e) => updateSetting('volume', parseFloat(e.target.value))}
            className="flex-1 min-w-0 accent-teal-600 h-1.5 bg-stone-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
          <span className="font-bold text-[11px] text-teal-600 dark:text-teal-400 w-8 text-left shrink-0">
            {toPersianDigits(Math.round(settings.volume * 100))}%
          </span>
        </div>
      </section>

      {/* ۴. تنظیمات فرمول محاسبه */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-2xl p-3 sm:p-4 border border-stone-200/80 dark:border-slate-800 space-y-2 w-full max-w-full overflow-hidden min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 min-w-0">
          <Sliders className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="truncate">فرمول محاسبه اوقات شرعی:</span>
        </div>
        <div className="w-full min-w-0">
          <select
            value={settings.calculationMethod}
            onChange={(e) => updateSetting('calculationMethod', e.target.value as any)}
            className="w-full min-w-0 max-w-full p-2 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-stone-200 dark:border-slate-700 text-xs focus:outline-none cursor-pointer truncate"
          >
            <option value="tehran">مؤسسه ژئوفیزیک دانشگاه تهران (رسمی و شرعی ایران)</option>
            <option value="taghrib">مجمع جهانی تقریب مذاهب اسلامی</option>
            <option value="mwl">رابطة العالم الإسلامی (MWL)</option>
            <option value="makkah">ام‌القری مکه مکرمه</option>
          </select>
        </div>
      </section>
    </div>
  );
};
