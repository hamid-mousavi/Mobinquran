import React, { useState, useEffect } from 'react';
import { DownloadCloud, CheckCircle, Database, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';
import { db } from '../db/quranDb';
import { ALL_SURAHS } from '../data/surahs';
import { QuranService } from '../services/quranService';

interface OfflineDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onDownloadedCountChange?: (count: number) => void;
}

export const OfflineDownloadModal: React.FC<OfflineDownloadModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  onDownloadedCountChange,
}) => {
  const [cachedSurahIds, setCachedSurahIds] = useState<Set<number>>(new Set());
  const [totalVersesCount, setTotalVersesCount] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; surahName: string }>({
    current: 0,
    total: 0,
    surahName: '',
  });

  const checkStorage = async () => {
    try {
      const allVerses = await db.verses.toArray();
      setTotalVersesCount(allVerses.length);
      const surahIds = new Set<number>();
      allVerses.forEach((v) => surahIds.add(v.surahId));
      setCachedSurahIds(surahIds);
      if (onDownloadedCountChange) {
        onDownloadedCountChange(surahIds.size);
      }
    } catch (err) {
      console.error('Error checking db cache:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStorage();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadBatch = async (surahList: number[]) => {
    setIsDownloading(true);
    const needed = surahList.filter((id) => !cachedSurahIds.has(id));

    if (needed.length === 0) {
      alert('تمامی سوره‌های این بسته قبلاً دانلود و ذخیره شده‌اند.');
      setIsDownloading(false);
      return;
    }

    setDownloadProgress({ current: 0, total: needed.length, surahName: '' });

    for (let i = 0; i < needed.length; i++) {
      const sId = needed[i];
      const sMeta = ALL_SURAHS.find((s) => s.id === sId);
      setDownloadProgress({
        current: i + 1,
        total: needed.length,
        surahName: sMeta ? `سوره ${sMeta.nameArabic}` : `سوره شماره ${sId}`,
      });

      try {
        await QuranService.getVersesBySurah(sId);
      } catch (e) {
        console.warn(`Failed downloading surah ${sId}:`, e);
      }

      // توقف کوتاه برای جلوگیری از فشار روی سرور
      await new Promise((r) => setTimeout(r, 60));
    }

    await checkStorage();
    setIsDownloading(false);
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

  const handleClearCache = async () => {
    if (window.confirm('آیا از پاکسازی تمام سوره‌ها و آیات ذخیره‌شده آفلاین اطمینان دارید؟ (تنظیمات و نشانه‌گذاری‌ها محفوظ خواهند ماند)')) {
      await db.verses.clear();
      await checkStorage();
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
                disabled={isDownloading || cachedSurahIds.size === 114}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                  cachedSurahIds.size === 114
                    ? 'bg-stone-100 dark:bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                }`}
              >
                {cachedSurahIds.size === 114 ? (
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
            * با دانلود هر بسته، نیازی به اینترنت نخواهید داشت و برنامه به صورت کاملاً آفلاین در حالت پرواز نیز کار می‌کند.
          </p>
        </div>
      </div>
    </div>
  );
};
