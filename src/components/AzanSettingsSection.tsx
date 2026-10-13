import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Download,
  Play,
  Square,
  Bell,
  Sparkles,
  Sliders,
  CheckCircle2,
  Music,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  Radio,
  Clock,
  ShieldCheck,
  Search,
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
  NotificationPermissionState,
} from '../services/azanService';
import { toPersianDigits } from '../utils/textNormalization';

interface AzanSettingsSectionProps {
  darkMode: boolean;
}

// کامپوننت انیمیشن موج صوتی (اکولایزر)
const AudioEqualizer: React.FC<{ isPlaying: boolean; colorClass?: string }> = ({
  isPlaying,
  colorClass = 'bg-teal-500',
}) => {
  return (
    <div className="flex items-end gap-0.5 h-4 w-4 justify-center">
      <span
        className={`w-0.5 rounded-full ${colorClass} transition-all duration-300 ${
          isPlaying ? 'h-3.5 animate-pulse' : 'h-1.5'
        }`}
      />
      <span
        className={`w-0.5 rounded-full ${colorClass} transition-all duration-200 ${
          isPlaying ? 'h-4 animate-bounce' : 'h-2'
        }`}
      />
      <span
        className={`w-0.5 rounded-full ${colorClass} transition-all duration-300 ${
          isPlaying ? 'h-2.5 animate-pulse' : 'h-1'
        }`}
      />
      <span
        className={`w-0.5 rounded-full ${colorClass} transition-all duration-150 ${
          isPlaying ? 'h-3.5 animate-bounce' : 'h-2'
        }`}
      />
    </div>
  );
};

export const AzanSettingsSection: React.FC<AzanSettingsSectionProps> = ({}) => {
  const [settings, setSettings] = useState<AzanSettings>(getAzanSettings());
  const [downloadedIds, setDownloadedIds] = useState<string[]>(getDownloadedMuezzinIds());
  const [downloadedDuaIds, setDownloadedDuaIds] = useState<string[]>(getDownloadedDuaIds());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [, setDownloadProgress] = useState<number>(0);
  const [previewState, setPreviewState] = useState(getCurrentPreviewState());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>(
    getNotificationPermissionStatus()
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMuezzinListExpanded, setIsMuezzinListExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const handleTogglePlayMuezzin = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewState.isPlaying && previewState.id === id) {
      stopAzanPreview();
    } else {
      await playAzanPreview(id, () => {
        setPreviewState({ isPlaying: false, id: null, type: null });
      });
    }
  };

  const handleTogglePlayDua = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewState.isPlaying && previewState.id === id) {
      stopAzanPreview();
    } else {
      await playDuaPreview(id, () => {
        setPreviewState({ isPlaying: false, id: null, type: null });
      });
    }
  };

  const handleDownloadMuezzin = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const muezzin = MUEZZINS_LIST.find((m) => m.id === id);
    if (!muezzin) return;
    try {
      setDownloadingId(id);
      setDownloadProgress(20);
      await downloadMuezzinAudio(id, (p) => setDownloadProgress(p));
      setDownloadedIds(getDownloadedMuezzinIds());
      setDownloadingId(null);
      showToast(`صوت اذان «${muezzin.name}» در حافظه دستگاه ذخیره شد.`);
    } catch (err: any) {
      setDownloadingId(null);
      showToast(err.message || 'خطا در بارگیری صوت');
    }
  };

  const handleDeleteDownloadMuezzin = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await deleteDownloadedMuezzin(id);
    setDownloadedIds(getDownloadedMuezzinIds());
    showToast('صوت از حافظه دستگاه حذف شد.');
  };

  const handleDownloadDua = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const handleDeleteDownloadDua = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
      showToast('اعلان‌های سیستم با موفقیت فعال شدند ✓');
    } else {
      showToast('لطفاً در صورت نیاز از تنظیمات مرورگر دسترسی اعلان را فعال کنید.');
    }
  };

  const currentMuezzin =
    MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];

  const filteredMuezzins = MUEZZINS_LIST.filter(
    (m) =>
      m.name.includes(searchQuery) ||
      m.title.includes(searchQuery) ||
      m.maqam.includes(searchQuery)
  );

  return (
    <div className="space-y-5 text-right pb-8 w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
      {/* پیام موقت اعلان */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] bg-slate-900/95 dark:bg-teal-950/95 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl border border-teal-500/30 flex items-center gap-2 animate-fadeIn backdrop-blur-md max-w-[90vw] truncate">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* ۱. مؤذن فعال منتخب (کارت ویژه و شکیل) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-emerald-950 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-teal-600/30 space-y-4">
        {/* نشان اصالت شیعه در پس‌زمینه */}
        <div className="absolute top-0 left-0 translate-x-4 -translate-y-4 w-32 h-32 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-300 flex items-center justify-center font-black text-xl shrink-0 shadow-inner">
              {currentMuezzin.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  مؤذن فعال
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/30 text-teal-200 border border-teal-400/30">
                  دستگاه: {currentMuezzin.maqam}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white mt-1 truncate">
                {currentMuezzin.name}
              </h3>
              <p className="text-[11px] text-teal-100/90 truncate mt-0.5">
                {currentMuezzin.title}
              </p>
            </div>
          </div>

          {/* کلید پخش سریع صوت مؤذن فعال */}
          <button
            onClick={(e) => handleTogglePlayMuezzin(currentMuezzin.id, e)}
            className={`p-3 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer shadow-md transition-all ${
              previewState.isPlaying && previewState.id === currentMuezzin.id
                ? 'bg-amber-400 text-teal-950 scale-105 animate-pulse'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
            }`}
            title="شنیدن پیش‌نمایش اذان"
          >
            {previewState.isPlaying && previewState.id === currentMuezzin.id ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
          </button>
        </div>

        <p className="text-xs text-teal-100/80 leading-relaxed border-t border-teal-700/60 pt-3 relative z-10">
          {currentMuezzin.description}
        </p>

        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-teal-200/90 relative z-10">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>مدت اذان: {toPersianDigits(currentMuezzin.duration)}</span>
          </span>

          {downloadedIds.includes(currentMuezzin.id) ? (
            <span className="flex items-center gap-1 text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
              <Check className="w-3.5 h-3.5" />
              <span>ذخیره آفلاین ✓</span>
            </span>
          ) : (
            <button
              onClick={(e) => handleDownloadMuezzin(currentMuezzin.id, e)}
              disabled={downloadingId === currentMuezzin.id}
              className="flex items-center gap-1 text-teal-100 font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg border border-white/20 cursor-pointer transition-colors"
            >
              <Download className={`w-3.5 h-3.5 ${downloadingId === currentMuezzin.id ? 'animate-bounce' : ''}`} />
              <span>دانلود برای آفلاین</span>
            </button>
          )}
        </div>
      </section>

      {/* ۲. فهرست شکیل و استایل‌دار تمامی قاریان و مؤذنان شیعه */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-3xl p-3.5 sm:p-5 border border-stone-200/80 dark:border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                فهرست مؤذنان معتبر شیعه
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                همگی با شهادت به ولایت امیرالمؤمنین (ع) و حی علی خیر العمل
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsMuezzinListExpanded(!isMuezzinListExpanded)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-stone-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            <span>{isMuezzinListExpanded ? 'بستن لیست' : 'مشاهده همه'}</span>
            {isMuezzinListExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* فیلتر جستجو سریع بین مؤذنان */}
        {isMuezzinListExpanded && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام مؤذن یا دستگاه آوازی (مثلاً: مؤذن‌زاده، بیات ترک، آقاتی...)"
              className="w-full pl-3 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>
        )}

        {/* کارت‌های مجزا و خوش‌طرح برای هر مؤذن */}
        {isMuezzinListExpanded && (
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-0.5 scrollbar-thin">
            {filteredMuezzins.map((muezzin) => {
              const isSelected = settings.selectedMuezzinId === muezzin.id;
              const isPlaying = previewState.isPlaying && previewState.id === muezzin.id;
              const isDownloaded = downloadedIds.includes(muezzin.id);
              const isDownloading = downloadingId === muezzin.id;

              return (
                <div
                  key={muezzin.id}
                  onClick={() => handleSelectMuezzin(muezzin.id)}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-teal-500/10 dark:bg-teal-950/40 border-teal-500 dark:border-teal-500 shadow-sm ring-1 ring-teal-500/30'
                      : 'bg-white dark:bg-slate-900/70 border-stone-200/80 dark:border-slate-800 hover:border-teal-400/50 hover:bg-stone-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* آیکون انتخاب / وضعیت */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isSelected ? <Check className="w-5 h-5" /> : muezzin.name.charAt(0)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                            {muezzin.name}
                          </h4>
                          {isSelected && (
                            <span className="text-[9px] font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded-md">
                              فعال
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-500/20">
                            {muezzin.maqam}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {muezzin.title}
                        </p>
                      </div>
                    </div>

                    {/* دکمه‌های کنترلی سمت چپ */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* اکولایزر هنگام پخش */}
                      {isPlaying && <AudioEqualizer isPlaying={isPlaying} colorClass="bg-teal-500" />}

                      {/* دکمه پخش / توقف */}
                      <button
                        onClick={(e) => handleTogglePlayMuezzin(muezzin.id, e)}
                        className={`p-2 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                          isPlaying
                            ? 'bg-teal-600 text-white animate-pulse'
                            : 'bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                        title={isPlaying ? 'توقف' : 'پخش پیش‌نمایش'}
                      >
                        {isPlaying ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      {/* دانلود آفلاین */}
                      {!isDownloaded ? (
                        <button
                          onClick={(e) => handleDownloadMuezzin(muezzin.id, e)}
                          disabled={isDownloading}
                          title="دانلود جهت پخش آفلاین"
                          className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleDeleteDownloadMuezzin(muezzin.id, e)}
                          title="در حافظه ذخیره شده (کلیک برای حذف)"
                          className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ۳. بخش پخش ادعیه و مناجات قبل از اذان (طراحی کارت‌های شکیل و منظم) */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-3xl p-3.5 sm:p-5 border border-stone-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                پخش دعا و مناجات پیش از اذان
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                طنین ادعیه متبرک پیش از حلول وقت نماز
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.playPreAzanDua}
              onChange={(e) => updateSetting('playPreAzanDua', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
          </label>
        </div>

        {settings.playPreAzanDua && (
          <div className="space-y-3.5 pt-2 border-t border-stone-200/60 dark:border-slate-800">
            {/* انتخاب فاصله زمانی قبل از اذان به صورت چیپ‌های شکیل */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                زمان شروع پخش دعا:
              </span>
              <div className="flex items-center gap-1.5">
                {[5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => updateSetting('preAlertMinutes', mins as any)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      settings.preAlertMinutes === mins
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-stone-200 dark:border-slate-800'
                    }`}
                  >
                    {toPersianDigits(mins)} دقیقه قبل
                  </button>
                ))}
              </div>
            </div>

            {/* کارت‌های زیبای ادعیه معتبر */}
            <div className="grid grid-cols-1 gap-2.5">
              {PRE_AZAN_DUAS_LIST.map((dua) => {
                const isSelected = settings.selectedPreDuaId === dua.id;
                const isPlaying = previewState.isPlaying && previewState.id === dua.id;
                const isDownloaded = downloadedDuaIds.includes(dua.id);
                const isDownloading = downloadingId === dua.id;

                return (
                  <div
                    key={dua.id}
                    onClick={() => handleSelectPreDua(dua.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-purple-500/10 dark:bg-purple-950/40 border-purple-500 dark:border-purple-500 shadow-sm ring-1 ring-purple-500/30'
                        : 'bg-white dark:bg-slate-900/70 border-stone-200/80 dark:border-slate-800 hover:border-purple-400/50 hover:bg-stone-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isSelected ? <Check className="w-5 h-5" /> : <Heart className="w-4 h-4 text-purple-500" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                              {dua.name}
                            </h4>
                            {isSelected && (
                              <span className="text-[9px] font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded-md">
                                انتخاب شده
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/20">
                              {toPersianDigits(dua.duration)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {dua.title}
                          </p>
                        </div>
                      </div>

                      {/* کلیدهای کنترل صوت دعا */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPlaying && <AudioEqualizer isPlaying={isPlaying} colorClass="bg-purple-500" />}

                        <button
                          onClick={(e) => handleTogglePlayDua(dua.id, e)}
                          className={`p-2 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                            isPlaying
                              ? 'bg-purple-600 text-white animate-pulse'
                              : 'bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                          title={isPlaying ? 'توقف صوت' : 'شنیدن صوت دعا'}
                        >
                          {isPlaying ? (
                            <Square className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>

                        {!isDownloaded ? (
                          <button
                            onClick={(e) => handleDownloadDua(dua.id, e)}
                            disabled={isDownloading}
                            title="دانلود جهت پخش آفلاین"
                            className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteDownloadDua(dua.id, e)}
                            title="ذخیره شده در دستگاه"
                            className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      {dua.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ۴. هشدار خودکار اذان و تنظیم اعلان‌ها (بدون هیچ دکمه تست زنده) */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-3xl p-3.5 sm:p-5 border border-stone-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                هشدارهای خودکار شرعی
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                فعال‌سازی پخش اذان و اعلان روی صفحه
              </p>
            </div>
          </div>

          {permissionStatus === 'granted' ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-500/30 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>اعلان فعال ✓</span>
            </span>
          ) : (
            <button
              onClick={handleRequestPermission}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1 shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>فعال‌سازی اعلان</span>
            </button>
          )}
        </div>

        {/* جعبه راهنمای ویژه عملکرد در حالت بسته و سایلنت */}
        <div className="p-3 rounded-2xl bg-teal-500/10 dark:bg-teal-950/40 border border-teal-500/30 text-xs text-teal-950 dark:text-teal-200 leading-relaxed space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-300">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>نحوه عملکرد هنگام بسته بودن برنامه یا خواب گوشی:</span>
          </div>
          <p className="text-[11px] opacity-95">
            در زمان دقیق اذان، اعلان سیستمی به همراه لرزش و زنگ اختصاصی روی صفحه گوشی ظاهر می‌شود. با لمس اعلان، برنامه به طور خودکار باز شده و نوای ملکوتی اذان مؤذن منتخب طنین‌انداز می‌گردد.
          </p>
        </div>

        {/* انتخاب اذان‌های سه‌گانه شیعه (صبح، ظهر، مغرب) */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            پخش خودکار اذان برای کدام اوقات شرعی:
          </span>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { key: 'fajrAlert', label: 'اذان صبح' },
              { key: 'dhuhrAlert', label: 'اذان ظهر' },
              { key: 'maghribAlert', label: 'اذان مغرب' },
            ].map(({ key, label }) => {
              const active = (settings as any)[key];
              return (
                <button
                  key={key}
                  onClick={() => updateSetting(key as any, !active)}
                  className={`py-2 px-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                    active
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-stone-200 dark:border-slate-800'
                  }`}
                >
                  {label}
                  {active && <span className="mr-1 text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* نوار تنظیم میزان صدا */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-200/60 dark:border-slate-800 text-xs">
          <span className="text-slate-700 dark:text-slate-300 font-bold shrink-0 flex items-center gap-1.5">
            {settings.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-teal-600" />
            )}
            <span>بلندی صدای اذان:</span>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={(e) => updateSetting('volume', parseFloat(e.target.value))}
            className="flex-1 accent-teal-600 h-1.5 bg-stone-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />
          <span className="font-bold text-xs text-teal-600 dark:text-teal-400 w-9 text-left shrink-0">
            {toPersianDigits(Math.round(settings.volume * 100))}%
          </span>
        </div>
      </section>

      {/* ۵. فرمول محاسبه اوقات شرعی */}
      <section className="bg-stone-50 dark:bg-slate-800/40 rounded-3xl p-3.5 sm:p-5 border border-stone-200/80 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Sliders className="w-4 h-4 text-teal-600 shrink-0" />
          <span>فرمول محاسبه اوقات شرعی:</span>
        </div>
        <select
          value={settings.calculationMethod}
          onChange={(e) => updateSetting('calculationMethod', e.target.value as any)}
          className="w-full p-2.5 rounded-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-stone-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer"
        >
          <option value="tehran">مؤسسه ژئوفیزیک دانشگاه تهران (رسمی و شرعی ایران)</option>
          <option value="taghrib">مجمع جهانی تقریب مذاهب اسلامی</option>
          <option value="mwl">رابطة العالم الإسلامی (MWL)</option>
          <option value="makkah">ام‌القری مکه مکرمه</option>
        </select>
      </section>
    </div>
  );
};
