import React, { useRef, useState } from 'react';
import { DatabaseBackup, Download, Copy, Upload, ClipboardPaste } from 'lucide-react';
import {
  copyTextToClipboard,
  createBackupText,
  downloadBackupFile,
  restoreFromText,
} from '../services/backup/backupService';
import { toPersianDigits } from '../utils/textNormalization';

interface BackupSectionProps {
  darkMode: boolean;
}

type Msg = { kind: 'ok' | 'error'; text: string } | null;

export const BackupSection: React.FC<BackupSectionProps> = ({ darkMode }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'عملیات ناموفق بود.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () =>
    run(async () => {
      downloadBackupFile(await createBackupText());
      setMsg({ kind: 'ok', text: 'فایل پشتیبان ساخته شد. اگر دانلود شروع نشد، از «کپی متن» استفاده کنید.' });
    });

  const handleCopy = () =>
    run(async () => {
      const ok = await copyTextToClipboard(await createBackupText());
      if (!ok) throw new Error('کپی انجام نشد. از «ذخیره فایل» استفاده کنید.');
      setMsg({ kind: 'ok', text: 'متن پشتیبان کپی شد. آن را در جایی امن (مثلاً یادداشت یا پیام به خودتان) نگه دارید.' });
    });

  const restore = (text: string) =>
    run(async () => {
      const r = await restoreFromText(text);
      const parts = [
        `${toPersianDigits(r.progressMerged)} آیه`,
        `${toPersianDigits(r.bookmarksAdded)} نشانه`,
        `${toPersianDigits(r.khatmPlansAdded)} برنامهٔ ختم`,
      ];
      setMsg({
        kind: 'ok',
        text: `بازیابی شد: ${parts.join('، ')}. داده‌های فعلی شما حذف نشدند. برای دیدن همهٔ تغییرات، برنامه را یک‌بار ببندید و باز کنید.`,
      });
      setPasteText('');
      setShowPaste(false);
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8_000_000) {
      setMsg({ kind: 'error', text: 'فایل پشتیبان بیش از حد بزرگ است.' });
      return;
    }
    await restore(await file.text());
  };

  const btn =
    'px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-50';

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
      <div
        className={`p-3 rounded-xl border text-xs space-y-2.5 ${
          darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">پشتیبان‌گیری از پیشرفت</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              حفظ، مرور، ختم، نشانه‌ها و استمرار شما
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleDownload} disabled={busy} className={`${btn} bg-teal-600 hover:bg-teal-700 text-white`}>
            <Download className="w-3.5 h-3.5" />
            <span>ذخیره فایل</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={busy}
            className={`${btn} border border-teal-600/40 text-teal-700 dark:text-teal-300 hover:bg-teal-600/10`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>کپی متن</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={`${btn} border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-500/10`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>بازیابی از فایل</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            disabled={busy}
            className={`${btn} border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-500/10`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>بازیابی از متن</span>
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
        </div>

        {showPaste && (
          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              dir="ltr"
              rows={4}
              placeholder="متن پشتیبان را اینجا بچسبانید"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-[11px] font-mono"
            />
            <button
              type="button"
              onClick={() => restore(pasteText)}
              disabled={busy || !pasteText.trim()}
              className={`${btn} bg-teal-600 hover:bg-teal-700 text-white`}
            >
              <span>بازیابی</span>
            </button>
          </div>
        )}

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          بازیابی فقط داده‌های جاافتاده را اضافه می‌کند و چیزی را پاک نمی‌کند.
        </p>

        {msg && (
          <div
            role="status"
            className={`text-[11px] font-semibold pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 ${
              msg.kind === 'ok' ? 'text-teal-700 dark:text-teal-300' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
};
