import React, { useState, useEffect, useRef } from 'react';
import { DownloadCloud, CheckCircle, Database, Trash2, X, AlertTriangle, Loader2, HardDrive, ShieldCheck, ShieldAlert, Headphones, Music2, Download, Check, Info, Bug } from 'lucide-react';
import { ALL_SURAHS } from '../data/surahs';
import { QuranService } from '../services/quranService';
import { ContentMetadata, AudioErrorLogEntry, AudioErrorKind } from '../types';
import { getStorageStatus, requestStoragePersistence, StorageStatus } from '../services/pwaManager';
import { ReciterId, getSourcesForReciter } from '../services/audioSources';
import {
  downloadSurahAudio,
  deleteSurahAudio,
  deleteAllAudioForReciter,
  getAudioCacheStatus,
  isSurahAudioCached,
  AudioCacheStatus,
  formatBytes,
  estimateSurahAudioBytes,
} from '../services/audioCacheService';
import { getAudioErrorLog, clearAudioErrorLog, describeAudioError } from '../services/audioErrorLog';

interface OfflineDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  currentSurahId?: number;
  onDownloadedCountChange?: (count: number) => void;
}

export const OfflineDownloadModal: React.FC<OfflineDownloadModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  currentSurahId,
  onDownloadedCountChange,
}) => {
  const [cachedSurahIds, setCachedSurahIds] = useState<Set<number>>(new Set());
  const [totalVersesCount, setTotalVersesCount] = useState<number>(0);
  const [contentMetadata, setContentMetadata] = useState<ContentMetadata | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [failedSurahIds, setFailedSurahIds] = useState<number[]>([]);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [requestingPersist, setRequestingPersist] = useState(false);
  const cancelDownloadRef = useRef(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; surahName: string }>({
    current: 0,
    total: 0,
    surahName: '',
  });

  // ——— کش صوتی (P5-T2) ———
  const [audioReciterId, setAudioReciterId] = useState<ReciterId>('parhizgar');
  const [audioStatus, setAudioStatus] = useState<AudioCacheStatus | null>(null);
  const [isAudioDownloading, setIsAudioDownloading] = useState(false);
  const [audioDownloadingSurah, setAudioDownloadingSurah] = useState<string>('');
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const cancelAudioDownloadRef = useRef(false);

  // ——— گزارش خطاهای صوتی (P5-T5) ———
  const [audioErrors, setAudioErrors] = useState<AudioErrorLogEntry[]>([]);

  const checkStorage = async () => {
    try {
      const status = await QuranService.getOfflineContentStatus();
      const surahIds = new Set(status.downloadedSurahIds);
      setTotalVersesCount(status.downloadedVerses);
      setCachedSurahIds(surahIds);
      setContentMetadata(await QuranService.getContentMetadata());
      const storage = await getStorageStatus();
      setStorageStatus(storage);
      if (onDownloadedCountChange) {
        onDownloadedCountChange(surahIds.size);
      }
    } catch (err) {
      console.error('Error checking db cache:', err);
    }
  };

  const refreshAudioStatus = async () => {
    const status = await getAudioCacheStatus();
    setAudioStatus(status);
  };

  const refreshAudioErrors = async () => {
    setAudioErrors(await getAudioErrorLog(50));
  };

  const handleRequestPersistence = async () => {
    setRequestingPersist(true);
    await requestStoragePersistence();
    const storage = await getStorageStatus();
    setStorageStatus(storage);
    setRequestingPersist(false);
  };

  useEffect(() => {
    if (isOpen) {
      checkStorage();
      refreshAudioStatus();
      refreshAudioErrors();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadBatch = async (surahList: number[]) => {
    setIsDownloading(true);
    cancelDownloadRef.current = false;
    setFailedSurahIds([]);
    setDownloadNotice(null);
    const needed = surahList.filter((id) => !cachedSurahIds.has(id));

    if (needed.length === 0) {
      alert('تمامی سوره‌های این بسته قبلاً دانلود و ذخیره شده‌اند.');
      setIsDownloading(false);
      return;
    }

    setDownloadProgress({ current: 0, total: needed.length, surahName: '' });
    const result = await QuranService.downloadSurahs(
      needed,
      (current, total, surah) => setDownloadProgress({ current, total, surahName: `سوره ${surah.nameArabic}` }),
      () => cancelDownloadRef.current,
    );

    await checkStorage();
    setIsDownloading(false);
    setFailedSurahIds(result.failedSurahIds);
    if (result.cancelled) {
      setDownloadNotice('دانلود متوقف شد؛ می‌توانید بعداً از همان بسته ادامه دهید.');
    } else if (result.failedSurahIds.length > 0) {
      setDownloadNotice(`${result.failedSurahIds.length} سوره کامل دریافت نشد. اتصال را بررسی و دوباره تلاش کنید.`);
    } else {
      setDownloadNotice('دانلود و بررسی کامل بودن داده‌ها با موفقیت انجام شد.');
    }
  };

  const handleDownloadJuz30 = () => {
    // سوره‌های جزء ۳۰: سوره‌های ۷۸ تا ۱۱۴
    const ids: number[] = [];
    for (let i = 78; i <= 114; i++) ids.push(i);
    handleDownloadBatch(ids);
  };

  const handleDownloadVirtueSurahs = () => {
    // یس(36)، الرحمن(55)، واقعه(56)، ملک(67)، کهف(18)، نور(24)، جمعه(62)
    handleDownloadBatch([36, 55, 56, 67, 18, 24, 62]);
  };

  const handleDownloadAllQuran = () => {
    const allIds: number[] = [];
    for (let i = 1; i <= 114; i++) allIds.push(i);
    handleDownloadBatch(allIds);
  };

  const handleRetryFailed = () => {
    if (failedSurahIds.length > 0) handleDownloadBatch(failedSurahIds);
  };

  const handleClearCache = async () => {
    if (window.confirm('آیا از پاکسازی تمام سوره‌ها و آیات ذخیره‌شده آفلاین اطمینان دارید؟ (تنظیمات و نشانه‌گذاری‌ها محفوظ خواهند ماند)')) {
      await QuranService.clearOfflineContent();
      await checkStorage();
    }
  };

  const handleDownloadAudioSurahs = async (surahIds: number[], label: string, reciterId: ReciterId = audioReciterId) => {
    cancelAudioDownloadRef.current = false;
    setIsAudioDownloading(true);
    setAudioNotice(null);

    // بررسی سقف فضای نرم قبل از دانلود (برآورد ~55KB/آیه)
    const status = await getAudioCacheStatus();
    for (const id of surahIds) {
      if (status.totalBytes + estimateSurahAudioBytes(reciterId, id) > status.softLimitBytes) {
        setAudioNotice('ظرفیت کش صوتی به سقف نزدیک است؛ ابتدا سوره‌های قبلی را حذف کنید.');
        setIsAudioDownloading(false);
        return;
      }
    }

    let done = 0;
    for (const id of surahIds) {
      if (cancelAudioDownloadRef.current) break;
      const already = await isSurahAudioCached(reciterId, id);
      if (already) {
        done++;
        setAudioProgress({ current: done, total: surahIds.length });
        setAudioDownloadingSurah('');
        continue;
      }
      const surah = ALL_SURAHS.find((s) => s.id === id);
      setAudioDownloadingSurah(`${surah?.nameArabic ?? `سوره ${id}`}`);
      try {
        await downloadSurahAudio(reciterId, id, (cur, total) => {
          setAudioProgress({ current: done + (cur / total), total: surahIds.length });
        }, () => cancelAudioDownloadRef.current);
      } catch (err) {
        console.error(`Audio download failed for surah ${id}:`, err);
      }
      done++;
      setAudioProgress({ current: done, total: surahIds.length });
    }

    setAudioDownloadingSurah('');
    await refreshAudioStatus();
    setIsAudioDownloading(false);
    if (cancelAudioDownloadRef.current) {
      setAudioNotice('دانلود صوت متوقف شد. سورهٔ ناقص دوباره دانلود می‌شود.');
    } else {
      setAudioNotice(`${label} با قاری انتخابی برای پخش آفلاین آماده شد.`);
    }
  };

  const percent = downloadProgress.total > 0
    ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
    : 0;

  return (
    <div
      id="offline-download-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="offline-download-modal-container"
        className={`w-full max-w-lg rounded-3xl shadow-2xl border transition-all overflow-hidden ${
          darkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-[#faf8f5] border-stone-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* هدر */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-600/10 text-teal-700 dark:text-teal-400">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">مدیریت ذخیره‌سازی آفلاین</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                دانلود بسته‌ای متن و ترجمه‌ها جهت استفاده بدون نیاز به اینترنت
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوا */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* کارت وضعیت حافظه محلی */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              darkMode
                ? 'bg-slate-800/70 border-slate-700'
                : 'bg-white border-stone-200 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">وضعیت دیتابیس محلی (IndexedDB)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {cachedSurahIds.size} از ۱۱۴ سوره • {totalVersesCount} آیه ذخیره شده
                </p>
              </div>
            </div>
            <button
              onClick={handleClearCache}
              disabled={cachedSurahIds.size === 0 || isDownloading}
              className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
              title="پاکسازی حافظه کش"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* وضعیت سهمیه حافظه و ماندگاری دائمی مرورگر (P2-T5) */}
          {storageStatus && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
                darkMode
                  ? 'bg-slate-800/40 border-slate-700 text-slate-300'
                  : 'bg-teal-50/50 border-teal-100 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>فضای ذخیره‌سازی مرورگر</span>
                </div>
                <span className="font-mono text-[11px] text-teal-700 dark:text-teal-300">
                  {storageStatus.usageMB} مگابایت مصرف‌شده
                  {Number(storageStatus.quotaMB) > 0 && ` از ${storageStatus.quotaMB} MB`}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-1.5">
                  {storageStatus.isPersisted ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-[11px]">
                    {storageStatus.isPersisted
                      ? 'ماندگاری دائم فعال است (داده‌ها در پاکسازی مرورگر حذف نمی‌شوند)'
                      : 'ماندگاری موقت است (مرورگر ممکن است در کمبود فضا پاک کند)'}
                  </span>
                </div>
                {!storageStatus.isPersisted && (
                  <button
                    onClick={handleRequestPersistence}
                    disabled={requestingPersist}
                    className="px-2 py-1 rounded-lg bg-teal-600 text-white font-bold text-[10px] hover:bg-teal-700 transition disabled:opacity-50 shrink-0 mr-2"
                  >
                    {requestingPersist ? 'در حال ثبت...' : 'دائمی کردن'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
            darkMode ? 'bg-slate-800/40 border-slate-700 text-slate-300' : 'bg-stone-50 border-stone-200 text-slate-600'
          }`}>
            <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">منبع دادهٔ فعلی</div>
            <p>
              {contentMetadata
                ? `${contentMetadata.sourceName} • ${contentMetadata.datasetVersion}`
                : 'پس از نخستین دریافت کامل آیات، منبع و زمان همگام‌سازی اینجا ثبت می‌شود.'}
            </p>
            {contentMetadata && (
              <p className="mt-1 text-[11px] text-slate-400">
                آخرین همگام‌سازی: {new Date(contentMetadata.lastSyncedAt).toLocaleString('fa-IR')} • وضعیت مجوز: در حال بررسی
              </p>
            )}
          </div>

          {/* ——— کش صوتی (P5-T2) ——— */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-stone-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">صوت ترتیل آفلاین</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    دانلود صوت هر سوره جهت پخش بدون اینترنت (هر قاری)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('همهٔ صوت‌های دانلودشده با قاری انتخاب‌شده حذف می‌شوند. ادامه می‌دهید؟')) {
                    deleteAllAudioForReciter(audioReciterId).then(refreshAudioStatus);
                  }
                }}
                disabled={isAudioDownloading || (audioStatus?.records.filter((r) => r.reciterId === audioReciterId).length ?? 0) === 0}
                className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                title="حذف همهٔ صوت‌های این قاری"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* انتخاب قاری */}
            <div className="flex flex-wrap gap-1.5">
              {(['parhizgar', 'abdulbasit', 'minshawi', 'afasy'] as ReciterId[]).map((rid) => {
                const reciter = getSourcesForReciter(rid)[0];
                const isActive = rid === audioReciterId;
                return (
                  <button
                    key={rid}
                    onClick={() => setAudioReciterId(rid)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {reciter.name.replace('استاد ', '').replace('مشاری بن راشد العفاسی', 'العفاسی')}
                  </button>
                );
              })}
            </div>

            {/* وضعیت حجم کش صوتی */}
            {audioStatus && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Music2 className="w-3.5 h-3.5" />
                  {audioStatus.totalVerses} آیه ذخیره‌شده
                  {audioStatus.totalBytes > 0 && ` • ${formatBytes(audioStatus.totalBytes)}`}
                </span>
                <span className="text-slate-400">
                  سقف نرم: {formatBytes(audioStatus.softLimitBytes)}
                </span>
              </div>
            )}

            {/* دکمه‌های دانلود صوت */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => currentSurahId && handleDownloadAudioSurahs([currentSurahId], `سورهٔ ${currentSurahId}`, audioReciterId)}
                disabled={!currentSurahId || isAudioDownloading}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all active:scale-95"
              >
                <DownloadCloud className="w-4 h-4" />
                {currentSurahId ? `دانلود سورهٔ انتخابی` : 'سوره‌ای انتخاب نشده'}
              </button>
              <button
                onClick={() => {
                  const ids: number[] = [];
                  for (let i = 78; i <= 114; i++) ids.push(i);
                  handleDownloadAudioSurahs(ids, 'صوت جزء ۳۰', audioReciterId);
                }}
                disabled={isAudioDownloading}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                صوت جزء ۳۰
              </button>
              <button
                onClick={() => {
                  const ids: number[] = [];
                  for (let i = 1; i <= 114; i++) ids.push(i);
                  handleDownloadAudioSurahs(ids, 'کل قرآن', audioReciterId);
                }}
                disabled={isAudioDownloading}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                کل قرآن (پرهزینه)
              </button>
            </div>

            {/* پیشرفت دانلود صوت */}
            {isAudioDownloading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {audioDownloadingSurah || 'در حال آماده‌سازی...'}
                  </span>
                  <span>{Math.round((audioProgress.current / (audioProgress.total || 1)) * 100)}٪</span>
                </div>
                <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(audioProgress.current / (audioProgress.total || 1)) * 100}%` }}
                  />
                </div>
                <button
                  onClick={() => { cancelAudioDownloadRef.current = true; }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:underline"
                >
                  توقف دانلود
                </button>
              </div>
            )}

            {audioNotice && (
              <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed border ${
                audioNotice.includes('سقف')
                  ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200'
                  : 'bg-teal-50 border-teal-200 text-teal-900 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-200'
              }`}>
                {audioNotice}
              </div>
            )}

            {/* لیست سوره‌های دانلودشده صوتی */}
            {audioStatus && audioStatus.records.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                {audioStatus.records
                  .filter((r) => r.reciterId === audioReciterId)
                  .map((rec) => {
                    const surah = ALL_SURAHS.find((s) => s.id === rec.surahId);
                    const isComplete = rec.downloadedVerses === rec.totalVerses;
                    return (
                      <div key={rec.key} className="flex items-center justify-between text-[11px] px-1.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {isComplete ? (
                            <CheckCircle className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className="truncate">{surah?.nameArabic ?? `سوره ${rec.surahId}`}</span>
                          <span className="text-slate-400 shrink-0">
                            {rec.downloadedVerses}/{rec.totalVerses}
                          </span>
                        </span>
                        <button
                          onClick={() => deleteSurahAudio(audioReciterId, rec.surahId).then(refreshAudioStatus)}
                          disabled={isAudioDownloading}
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                          title="حذف صوت این سوره"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            <p className="text-[10px] text-slate-400 leading-normal flex gap-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              صوت از منابع مجاز (everyayah و آینهٔ Maqra) کش می‌شود و فقط برای قاری انتخابی ذخیره می‌شود. برای پخش آفلاین، سوره را دانلود کنید.
            </p>
          </div>

          {/* ——— گزارش خطاهای صوتی (P5-T5) ——— */}
          <div className={`p-4 rounded-2xl border space-y-2.5 ${
            darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-stone-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">گزارش خطاهای صوت</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {audioErrors.length === 0
                      ? 'هنوز خطایی ثبت نشده است.'
                      : `${audioErrors.length} خطای اخیر (مشاهده‌پذیری)`}
                  </p>
                </div>
              </div>
              {audioErrors.length > 0 && (
                <button
                  onClick={async () => {
                    if (window.confirm('همهٔ گزارش‌های خطای صوت حذف می‌شوند. ادامه می‌دهید؟')) {
                      await clearAudioErrorLog();
                      refreshAudioErrors();
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="پاک کردن گزارش"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {audioErrors.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1.5 border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                {audioErrors.map((e) => (
                  <div
                    key={e.id}
                    className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${
                      e.kind === 'network'
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                        : e.kind === 'corrupt'
                        ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800'
                        : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        سوره {e.surahId} : آیه {e.verseNumber}
                      </span>
                      <span className="font-bold shrink-0">
                        <BadgeKind kind={e.kind} />
                      </span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                      {e.message}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 text-left" dir="ltr">
                      {new Date(e.createdAt).toLocaleString('fa-IR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* نوار پیشرفت در حین دانلود */}
          {isDownloading && (
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-teal-800 dark:text-teal-300">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>در حال دانلود: {downloadProgress.surahName}</span>
                </div>
                <span>
                  {downloadProgress.current} از {downloadProgress.total} ({percent}٪)
                </span>
              </div>
              <div className="w-full bg-teal-200/60 dark:bg-teal-900/60 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <button
                onClick={() => { cancelDownloadRef.current = true; }}
                className="text-xs font-bold text-teal-700 dark:text-teal-300 hover:underline"
              >
                توقف پس از پایان سورهٔ جاری
              </button>
            </div>
          )}

          {downloadNotice && (
            <div className={`p-3 rounded-xl text-xs leading-relaxed border ${
              failedSurahIds.length > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200'
                : 'bg-teal-50 border-teal-200 text-teal-900 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-200'
            }`}>
              <p>{downloadNotice}</p>
              {failedSurahIds.length > 0 && (
                <button onClick={handleRetryFailed} className="mt-2 font-bold underline">
                  تلاش مجدد برای {failedSurahIds.length} سوره
                </button>
              )}
            </div>
          )}

          {/* لیست بسته‌های دانلود پیشنهادی */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-500 dark:text-slate-400">
              بسته‌های دانلود پیشنهادی:
            </h4>

            {/* بسته ۱: جزء ۳۰ */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                darkMode
                  ? 'bg-slate-800/40 border-slate-700'
                  : 'bg-white border-stone-200'
              }`}
            >
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  بسته جزء ۳۰ (۳۷ سوره پرکاربرد)
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  سوره‌های نبأ تا ناس، مناسب برای حفظ، نماز و قرائت روزانه
                </p>
              </div>
              <button
                onClick={handleDownloadJuz30}
                disabled={isDownloading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>دانلود بسته</span>
              </button>
            </div>

            {/* بسته ۲: سوره‌های منتخب و پرفضیلت */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                darkMode
                  ? 'bg-slate-800/40 border-slate-700'
                  : 'bg-white border-stone-200'
              }`}
            >
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  سوره‌های پرفضیلت
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  یس، الرحمن، واقعه، ملک، کهف، نور و جمعه
                </p>
              </div>
              <button
                onClick={handleDownloadVirtueSurahs}
                disabled={isDownloading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>دانلود بسته</span>
              </button>
            </div>

            {/* بسته ۳: کل قرآن کریم */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                darkMode
                  ? 'bg-slate-800/40 border-slate-700'
                  : 'bg-white border-stone-200'
              }`}
            >
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  دانلود کامل کل قرآن کریم
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تمامی ۱۱۴ سوره و ۶۲۳۶ آیه به همراه ۳ ترجمه رسمی (~۱۰ مگابایت)
                </p>
              </div>
              <button
                onClick={handleDownloadAllQuran}
                disabled={isDownloading || (cachedSurahIds.size === 114 && totalVersesCount >= 6236)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                  cachedSurahIds.size === 114 && totalVersesCount >= 6236
                    ? 'bg-stone-100 dark:bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                }`}
              >
                {cachedSurahIds.size === 114 && totalVersesCount >= 6236 ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
                    <span>کامل ذخیره شد</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>دانلود کل مصحف</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal pt-1">
            * فقط سوره‌هایی که شمار کامل آیاتشان ذخیره شده باشد «دانلودشده» محسوب می‌شوند. صوت و پاسخ هوش مصنوعی همچنان به اینترنت نیاز دارند.
          </p>
        </div>
      </div>
    </div>
  );
};

const KIND_LABELS: Record<AudioErrorKind, string> = {
  network: 'شبکه',
  'not-found': '۴۰۴',
  corrupt: 'خراب',
  cors: 'CORS',
  cancelled: 'لغو',
  unknown: 'نامشخص',
};

const BadgeKind: React.FC<{ kind: AudioErrorKind }> = ({ kind }) => {
  return (
    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px]">
      {KIND_LABELS[kind] ?? KIND_LABELS.unknown}
    </span>
  );
};
