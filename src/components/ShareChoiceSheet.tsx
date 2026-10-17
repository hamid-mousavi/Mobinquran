import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, X, Loader2 } from 'lucide-react';
import {
  shareAyahAsImage,
  shareAyahAsText,
  type ShareAyahRequest,
} from '../utils/shareAyah';

/**
 * پنجرهٔ انتخاب نوع اشتراک آیه («تصویر» یا «متن»).
 * با رویداد mobin-share-ayah (از shareAyah) باز می‌شود و با دکمهٔ Back بسته می‌شود.
 */
export const ShareChoiceSheet: React.FC = () => {
  const [request, setRequest] = useState<ShareAyahRequest | null>(null);
  const [busy, setBusy] = useState<'image' | 'text' | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onShare = (e: Event) => {
      setNotice('');
      setBusy(null);
      setRequest((e as CustomEvent<ShareAyahRequest>).detail);
    };
    window.addEventListener('mobin-share-ayah', onShare);
    return () => window.removeEventListener('mobin-share-ayah', onShare);
  }, []);

  useEffect(() => {
    if (!request) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      setRequest(null);
    };
    window.addEventListener('mobin-back', onBack);
    return () => window.removeEventListener('mobin-back', onBack);
  }, [request]);

  if (!request) return null;

  const close = () => setRequest(null);

  const run = async (kind: 'image' | 'text') => {
    setBusy(kind);
    const { verse, translation, surah } = request;
    const result =
      kind === 'image'
        ? await shareAyahAsImage(verse, translation, surah)
        : await shareAyahAsText(verse, translation, surah);
    setBusy(null);
    if (result === 'shared') {
      close();
    } else if (result === 'downloaded') {
      setNotice('تصویر آیه در دستگاه ذخیره شد.');
      setTimeout(close, 1400);
    } else if (result === 'copied') {
      setNotice('متن آیه کپی شد.');
      setTimeout(close, 1400);
    }
    // failed: کاربر لغو کرده یا خطا بوده؛ پنجره باز می‌ماند تا گزینهٔ دیگر را بزند
  };

  const optionClass =
    'w-full min-h-[64px] flex items-center gap-3 px-4 rounded-2xl border border-amber-300/70 dark:border-slate-700 bg-white dark:bg-slate-800 text-right cursor-pointer active:scale-[0.99] transition-transform disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 animate-fadeIn" onClick={close} dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="اشتراک‌گذاری آیه"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t-2 border-amber-600 bg-stone-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-5 pt-3 space-y-3 font-['Vazirmatn']"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-stone-300 dark:bg-slate-600" />
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold">آیه را چگونه به اشتراک بگذارید؟</div>
          <button
            onClick={close}
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button type="button" disabled={busy !== null} onClick={() => run('image')} className={optionClass}>
          <span className="w-11 h-11 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            {busy === 'image' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold">به‌صورت تصویر</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">کارت زیبا با آیه و ترجمه</span>
          </span>
        </button>

        <button type="button" disabled={busy !== null} onClick={() => run('text')} className={optionClass}>
          <span className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            {busy === 'text' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold">به‌صورت متن</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">متن عربی، ترجمه و نشانی آیه</span>
          </span>
        </button>

        {notice && <div role="status" className="text-center text-xs font-bold text-teal-700 dark:text-teal-300 pb-1">{notice}</div>}
      </div>
    </div>
  );
};
