import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Headphones,
  Music2,
  Download,
  Check,
  Trash2,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { ALL_SURAHS } from '../data/surahs';
import { ReciterId, RECITER_NAMES } from '../services/audioSources';
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
import { getStorageStatus, requestStoragePersistence, StorageStatus } from '../services/pwaManager';
import { toPersianDigits } from '../utils/textNormalization';
import { QuranicCard } from './QuranicOrnament';

interface OfflinePageProps {
  darkMode: boolean;
  onBack: () => void;
}

const AVAILABLE_RECITERS: { id: ReciterId; name: string; style: string }[] = (
  Object.keys(RECITER_NAMES) as ReciterId[]
).map((id) => ({
  id,
  name: RECITER_NAMES[id].name,
  style: RECITER_NAMES[id].title,
}));

export interface AudioBundle {
  id: string;
  title: string;
  desc: string;
  surahIds: number[];
  estimatedSizeMb: number;
  badge: string;
}

export const AUDIO_BUNDLES: AudioBundle[] = [
  {
    id: 'juz30',
    title: 'بسته جزء ۳۰ (عمّ جزء)',
    desc: '۳۷ سوره (از نبأ تا ناس) — پرکاربردترین سوره‌ها برای نماز و تلاوت روزانه',
    surahIds: Array.from({ length: 37 }, (_, i) => 78 + i),
    estimatedSizeMb: 25,
    badge: 'پیشنهادی ویژه',
  },
  {
    id: 'virtue',
    title: 'بسته سوره‌های پرفضیلت',
    desc: 'یس، الرحمن، واقعه، ملک، کهف، انسان، جمعه',
    surahIds: [36, 55, 56, 67, 18, 76, 62],
    estimatedSizeMb: 30,
    badge: 'محبوب‌ترین‌ها',
  },
  {
    id: 'juz1',
    title: 'بسته جزء اول قرآن',
    desc: 'سوره مبارکه فاتحه و نیمه نخست سوره بقره (تا آیه ۱۴۱)',
    surahIds: [1, 2],
    estimatedSizeMb: 18,
    badge: 'شروع قرآن',
  },
  {
    id: 'noorani',
    title: 'بسته سوره‌های نورانی و آرامش‌بخش',
    desc: 'یوسف، مریم، طه، اسراء — داستان‌های حکمت‌آموز و تلاوت‌های خاشعانه',
    surahIds: [12, 17, 19, 20],
    estimatedSizeMb: 28,
    badge: 'آرامش دل',
  },
  {
    id: 'full_quran',
    title: 'بسته کامل قرآن کریم',
    desc: 'تمامی ۱۱۴ سوره قرآن کریم با ترتیل کامل قاری انتخابی',
    surahIds: Array.from({ length: 114 }, (_, i) => 1 + i),
    estimatedSizeMb: 520,
    badge: 'کامل‌ترین',
  },
];

export const OfflinePage: React.FC<OfflinePageProps> = ({ darkMode, onBack }) => {
  const [selectedReciterId, setSelectedReciterId] = useState<ReciterId>('parhizgar');
  const [audioStatus, setAudioStatus] = useState<AudioCacheStatus | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingSurahName, setDownloadingSurahName] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [requestingPersist, setRequestingPersist] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const cancelDownloadRef = useRef(false);

  const refreshStatus = async () => {
    try {
      const [status, storage] = await Promise.all([
        getAudioCacheStatus(),
        getStorageStatus(),
      ]);
      setAudioStatus(status);
      setStorageStatus(storage);
    } catch (err) {
      console.error('Error refreshing offline audio status:', err);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, [selectedReciterId]);

  const handleRequestPersistence = async () => {
    setRequestingPersist(true);
    await requestStoragePersistence();
    await refreshStatus();
    setRequestingPersist(false);
  };

  const handleDownloadSurah = async (surahId: number, versesCount: number, surahName: string) => {
    setIsDownloading(true);
    cancelDownloadRef.current = false;
    setDownloadingSurahName(surahName);
    setDownloadProgress({ current: 0, total: versesCount });
    setNoticeMessage(null);

    const result = await downloadSurahAudio(
      selectedReciterId,
      surahId,
      (current: number, total: number) => setDownloadProgress({ current, total }),
      () => cancelDownloadRef.current,
    );

    setIsDownloading(false);
    setDownloadingSurahName('');
    await refreshStatus();

    if (cancelDownloadRef.current) {
      setNoticeMessage('دانلود متوقف شد.');
    } else if (result.downloadedVerses > 0 && result.failedVerses.length === 0) {
      setNoticeMessage(`صوت سوره ${surahName} با موفقیت در حافظه آفلاین ذخیره شد.`);
    } else {
      setNoticeMessage(`خطا در دانلود سوره ${surahName}. اتصال اینترنت را بررسی فرمایید.`);
    }
  };

  const handleDeleteSurahAudio = async (surahId: number, surahName: string) => {
    await deleteSurahAudio(selectedReciterId, surahId);
    await refreshStatus();
    setNoticeMessage(`فایل‌های صوتی سوره ${surahName} از حافظه پاک شد.`);
  };

  const handleDeleteAllForReciter = async () => {
    const reciterName = AVAILABLE_RECITERS.find((r) => r.id === selectedReciterId)?.name || '';
    if (confirm(`آیا از حذف تمام صوت‌های ذخیره‌شدهٔ ${reciterName} اطمینان دارید؟`)) {
      await deleteAllAudioForReciter(selectedReciterId);
      await refreshStatus();
      setNoticeMessage(`تمام فایل‌های صوتی ${reciterName} پاک شد.`);
    }
  };

  const handleDownloadBundleBatch = async (bundle: AudioBundle) => {
    const unCached = bundle.surahIds.filter((id) => !cachedSurahIds.has(id));
    if (unCached.length === 0) {
      setNoticeMessage(`تمام سوره‌های ${bundle.title} قبلاً برای این قاری دانلود شده‌اند.`);
      return;
    }

    setIsDownloading(true);
    cancelDownloadRef.current = false;
    setNoticeMessage(null);

    let completedSurahs = 0;
    for (const sid of unCached) {
      if (cancelDownloadRef.current) break;
      const surahMeta = ALL_SURAHS.find((s) => s.id === sid);
      const surahName = surahMeta ? `سوره ${surahMeta.nameArabic}` : `سوره ${sid}`;
      setDownloadingSurahName(`${bundle.title} • ${surahName} (${toPersianDigits(completedSurahs + 1)} از ${toPersianDigits(unCached.length)})`);
      setDownloadProgress({ current: 0, total: surahMeta?.versesCount || 1 });

      await downloadSurahAudio(
        selectedReciterId,
        sid,
        (current: number, total: number) => setDownloadProgress({ current, total }),
        () => cancelDownloadRef.current
      );
      completedSurahs++;
    }

    setIsDownloading(false);
    setDownloadingSurahName('');
    await refreshStatus();

    if (cancelDownloadRef.current) {
      setNoticeMessage(`دانلود ${bundle.title} متوقف شد.`);
    } else {
      setNoticeMessage(`دانلود کامل ${bundle.title} با موفقیت انجام شد.`);
    }
  };

  const cachedSurahIds = new Set(
    audioStatus?.records
      ?.filter((r) => r.reciterId === selectedReciterId && r.downloadedVerses > 0)
      .map((r) => r.surahId) || []
  );

  const filteredSurahs = ALL_SURAHS.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      s.nameArabic.toLowerCase().includes(q) ||
      (s.namePersian && s.namePersian.toLowerCase().includes(q)) ||
      String(s.id).includes(q)
    );
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-28 space-y-6" dir="rtl">
      {/* سربرگ صفحه با بازگشت به قرآن */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
            title="بازگشت به قرائت قرآن"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Headphones className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              <span>دانلود صوت‌های آفلاین</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              متن کامل و ترجمه‌ها در برنامه موجود است؛ ترتیل صوتی قاریان را برای استفاده بدون اینترنت دریافت کنید.
            </p>
          </div>
        </div>

        <button
          onClick={refreshStatus}
          className="p-2.5 rounded-2xl border border-stone-200 dark:border-slate-800 text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all"
          title="به‌روزرسانی وضعیت حافظه"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* وضعیت حافظه و ماندگاری مرورگر */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <QuranicCard darkMode={darkMode} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  فضای مصرفی صوت در مرورگر
                </div>
                <div className="text-lg font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                  {formatBytes(audioStatus?.totalBytes || 0)}
                </div>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {toPersianDigits(audioStatus?.totalVerses || 0)} آیه آفلاین
            </span>
          </div>
        </QuranicCard>

        <QuranicCard darkMode={darkMode} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {storageStatus?.isPersisted ? (
                  <ShieldCheck className="w-5 h-5 text-teal-600" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  وضعیت ماندگاری حافظه مرورگر
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {storageStatus?.isPersisted
                    ? 'پایدار و محافظت‌شده در برابر پاک‌سازی'
                    : 'حالت موقت (مرورگر ممکن است فایل‌ها را پاک کند)'}
                </div>
              </div>
            </div>
            {!storageStatus?.isPersisted && (
              <button
                onClick={handleRequestPersistence}
                disabled={requestingPersist}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] transition-all"
              >
                {requestingPersist ? 'ثبت…' : 'قفل حافظه'}
              </button>
            )}
          </div>
        </QuranicCard>
      </div>

      {/* انتخاب قاری */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          انتخاب قاری جهت مدیریت صوت‌های آفلاین:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AVAILABLE_RECITERS.map((r) => {
            const isSelected = r.id === selectedReciterId;
            const count =
              audioStatus?.records?.filter((rec) => rec.reciterId === r.id && rec.downloadedVerses > 0)
                .length || 0;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedReciterId(r.id)}
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-500/30'
                    : darkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                    : 'bg-white border-stone-200 text-slate-800 hover:border-stone-300 shadow-xs'
                }`}
              >
                <div className="font-bold text-xs sm:text-sm">{r.name}</div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/10 dark:border-white/10 text-[10px]">
                  <span className={isSelected ? 'text-teal-100' : 'text-slate-400'}>{r.style}</span>
                  <span className={`font-bold ${isSelected ? 'text-amber-200' : 'text-teal-600 dark:text-teal-400'}`}>
                    {toPersianDigits(count)} سوره
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* کارت عملیات کلی قاری انتخابی */}
      {audioStatus?.records &&
        audioStatus.records.some((r) => r.reciterId === selectedReciterId && r.downloadedVerses > 0) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
            {toPersianDigits(
              audioStatus.records.filter((r) => r.reciterId === selectedReciterId && r.downloadedVerses > 0).length
            )}{' '}
            سوره برای این قاری در حافظه آفلاین ذخیره است.
          </div>
          <button
            onClick={handleDeleteAllForReciter}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف تمام صوت‌های این قاری</span>
          </button>
        </div>
      )}

      {/* نوار وضعیت دانلود فعال */}
      {isDownloading && (
        <div className="p-4 rounded-2xl bg-teal-600 text-white shadow-lg space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>در حال دانلود صوت {downloadingSurahName}…</span>
            </div>
            <span>
              {toPersianDigits(downloadProgress.current)} از {toPersianDigits(downloadProgress.total)} آیه
            </span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-400 h-full transition-all duration-200"
              style={{
                width: `${downloadProgress.total ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="text-left">
            <button
              onClick={() => {
                cancelDownloadRef.current = true;
              }}
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all"
            >
              لغو دانلود
            </button>
          </div>
        </div>
      )}

      {/* پیام بازخورد */}
      {noticeMessage && (
        <div className="p-3 rounded-xl bg-stone-100 dark:bg-slate-800 text-xs font-bold text-center text-slate-700 dark:text-slate-300 border border-stone-200 dark:border-slate-700">
          {noticeMessage}
        </div>
      )}

      {/* بسته‌های پیشنهادی دانلود صوت (درخواست کاربر) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              بسته‌های پیشنهادی دانلود صوت ({RECITER_NAMES[selectedReciterId]?.shortName || ''})
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            دانلود یک‌کلیکه با مدیریت هوشمند کش
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AUDIO_BUNDLES.map((bundle) => {
            const downloadedCount = bundle.surahIds.filter((id) => cachedSurahIds.has(id)).length;
            const isAllDownloaded = downloadedCount === bundle.surahIds.length;
            const hasPartial = downloadedCount > 0 && !isAllDownloaded;

            return (
              <div
                key={bundle.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                  isAllDownloaded
                    ? 'bg-teal-500/10 border-teal-500/30 dark:bg-teal-950/20'
                    : darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-stone-200 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      {bundle.badge}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      حجم تقریبی: ~{toPersianDigits(bundle.estimatedSizeMb)} مگابایت
                    </span>
                  </div>

                  <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                    {bundle.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {bundle.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-200/70 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-[11px]">
                    {isAllDownloaded ? (
                      <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        کامل دانلود شد ({toPersianDigits(bundle.surahIds.length)} سوره)
                      </span>
                    ) : hasPartial ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {toPersianDigits(downloadedCount)} از {toPersianDigits(bundle.surahIds.length)} سوره ذخیره است
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        {toPersianDigits(bundle.surahIds.length)} سوره
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownloadBundleBatch(bundle)}
                    disabled={isDownloading || isAllDownloaded}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      isAllDownloaded
                        ? 'bg-stone-200 dark:bg-slate-800 text-slate-400 cursor-default'
                        : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95 shadow-xs'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isAllDownloaded ? 'تکمیل' : hasPartial ? 'تکمیل باقی' : 'دانلود بسته'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* جستجو و لیست سوره‌ها برای دانلود صوت */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            فهرست سوره‌ها جهت دانلود صوت ترتیل:
          </div>
          <div className="relative w-48 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی سوره…"
              className="w-full pr-8 pl-3 py-1.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
          </div>
        </div>

        <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
          {filteredSurahs.map((surah) => {
            const isCached = cachedSurahIds.has(surah.id);
            const estBytes = estimateSurahAudioBytes(selectedReciterId, surah.id);
            return (
              <div
                key={surah.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isCached
                    ? darkMode
                      ? 'bg-teal-950/20 border-teal-800/40'
                      : 'bg-teal-50/50 border-teal-200'
                    : darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-stone-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                    {toPersianDigits(surah.id)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                      سوره {surah.nameArabic} ({surah.namePersian})
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {toPersianDigits(surah.versesCount)} آیه • تخمین حجم: {formatBytes(estBytes)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCached ? (
                    <>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400 text-xs font-bold border border-teal-500/20">
                        <Check className="w-3.5 h-3.5" />
                        <span>آفلاین</span>
                      </span>
                      <button
                        onClick={() => handleDeleteSurahAudio(surah.id, surah.nameArabic)}
                        className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition-colors"
                        title="حذف فایل‌های صوتی این سوره"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDownloadSurah(surah.id, surah.versesCount, surah.nameArabic)}
                      disabled={isDownloading}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>دانلود صوت</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
