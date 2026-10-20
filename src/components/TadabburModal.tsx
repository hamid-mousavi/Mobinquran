import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Flame, Play, X } from 'lucide-react';
import { ALL_SURAHS } from '../data/surahs';
import { localDateKey } from '../utils/date';
import { toPersianDigits } from '../utils/textNormalization';
import { useModalA11y } from '../hooks/useModalA11y';
import { getVerseReflection, saveVerseReflection } from '../services/aiReflectionStorage';
import { consecutiveDays, isDoneOn, questionFor } from '../services/tadabbur/tadabburCore';
import { EVENT_TADABBUR, getTadabburLog, markTadabburDone } from '../services/tadabbur/tadabburStore';

export interface TadabburVerse {
  surahId: number;
  surahNameArabic: string;
  verseNumber: number;
  textArabic: string;
  translationPersian: string;
  theme: string;
}

interface TadabburModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  verse: TadabburVerse;
  onPlayVerseAudio: (surahId: number, verseNumber: number) => void;
  onNavigateToVerse: (surahId: number, verseNumber: number) => void;
}

const MAX_NOTE = 2000;
const surahNameOf = (id: number) => ALL_SURAHS.find((s) => s.id === id)?.nameArabic ?? `سوره ${id}`;

const formatDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  try {
    return new Date(y, m - 1, d).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
  } catch {
    return key;
  }
};

export const TadabburModal: React.FC<TadabburModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  verse,
  onPlayVerseAudio,
  onNavigateToVerse,
}) => {
  const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });
  const [note, setNote] = useState('');
  const [log, setLog] = useState(getTadabburLog());
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const today = localDateKey();

  // با باز شدن یا تغییر آیه، یادداشت قبلی همین آیه بارگذاری می‌شود
  useEffect(() => {
    if (!isOpen) return;
    setNote(getVerseReflection(verse.surahId, verse.verseNumber));
    setSavedHint(null);
    setLog(getTadabburLog());
    const onUpdate = () => setLog(getTadabburLog());
    window.addEventListener(EVENT_TADABBUR, onUpdate);
    return () => window.removeEventListener(EVENT_TADABBUR, onUpdate);
  }, [isOpen, verse.surahId, verse.verseNumber]);

  const question = useMemo(() => questionFor(today, verse.surahId, verse.verseNumber), [today, verse.surahId, verse.verseNumber]);
  const doneToday = isDoneOn(log, today);
  const streak = consecutiveDays(log, today);

  if (!isOpen) return null;

  const flash = (text: string) => {
    setSavedHint(text);
    window.setTimeout(() => setSavedHint(null), 2500);
  };

  const saveNote = () => {
    const ok = saveVerseReflection(verse.surahId, verse.verseNumber, note);
    flash(ok ? 'یادداشت ذخیره شد.' : 'ذخیره انجام نشد؛ حافظهٔ دستگاه را بررسی کنید.');
    return ok;
  };

  const complete = () => {
    if (note.trim() || getVerseReflection(verse.surahId, verse.verseNumber)) saveNote();
    if (markTadabburDone(verse.surahId, verse.verseNumber)) flash('تدبر امروز ثبت شد. قبول باشد.');
  };

  const card = darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-stone-200 shadow-sm';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl border-2 overflow-hidden ${
          darkMode ? 'bg-slate-900 border-teal-500/40 text-slate-100' : 'bg-[#f7f3e8] border-teal-700 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="تدبر روزانه"
      >
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold">تدبر روزانه</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {streak > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  {toPersianDigits(streak)} روز پیاپی
                </span>
              ) : (
                'یک آیه، یک پرسش، چند جمله یادداشت'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-[max(env(safe-area-inset-bottom,0px),24px)] space-y-4">
          {/* آیه */}
          <div className={`p-4 rounded-2xl border space-y-3 ${card}`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-teal-700 dark:text-teal-400">{verse.theme}</span>
              <span className="text-slate-500 dark:text-slate-400 shrink-0">
                سورهٔ {verse.surahNameArabic}، آیهٔ {toPersianDigits(verse.verseNumber)}
              </span>
            </div>
            <p className="text-right text-2xl leading-[2.2]" style={{ fontFamily: "'Amiri', 'Amiri Quran', serif" }} dir="rtl">
              {verse.textArabic}
            </p>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">«{verse.translationPersian}»</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onPlayVerseAudio(verse.surahId, verse.verseNumber)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current text-teal-600" />
                <span>گوش دادن</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigateToVerse(verse.surahId, verse.verseNumber);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                <span>دیدن در سوره</span>
              </button>
            </div>
          </div>

          {/* پرسش + یادداشت */}
          <div className={`p-4 rounded-2xl border space-y-3 ${card}`}>
            <p className="text-sm font-bold leading-relaxed text-amber-800 dark:text-amber-300">{question}</p>
            <label htmlFor="tadabbur-note" className="sr-only">
              یادداشت تدبر
            </label>
            <textarea
              id="tadabbur-note"
              value={note}
              maxLength={MAX_NOTE}
              rows={5}
              onChange={(e) => setNote(e.target.value)}
              placeholder="هر چه به دلتان آمد بنویسید؛ فقط روی همین دستگاه می‌ماند."
              className="w-full rounded-xl border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {toPersianDigits(note.length)} / {toPersianDigits(MAX_NOTE)}
              </span>
              {savedHint && (
                <span role="status" className="text-teal-700 dark:text-teal-300 font-bold">
                  {savedHint}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={complete}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                  doneToday
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-teal-700 hover:bg-teal-800 text-white'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{doneToday ? 'تدبر امروز ثبت شد (به‌روزرسانی)' : 'ثبت تدبر امروز'}</span>
              </button>
              <button
                type="button"
                onClick={saveNote}
                className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 text-xs font-bold cursor-pointer"
              >
                فقط ذخیره یادداشت
              </button>
            </div>
          </div>

          {/* تاریخچه */}
          {log.length > 0 && (
            <div className={`p-4 rounded-2xl border space-y-2 ${card}`}>
              <h3 className="text-xs font-bold">تدبرهای اخیر</h3>
              <ul className="space-y-1.5">
                {log.slice(0, 14).map((entry) => {
                  const excerpt = getVerseReflection(entry.surahId, entry.verseNumber);
                  return (
                    <li key={entry.date} className="text-[11px] leading-relaxed border-b border-stone-100 dark:border-slate-800 pb-1.5 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{formatDate(entry.date)}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {surahNameOf(entry.surahId)} {toPersianDigits(entry.verseNumber)}
                        </span>
                      </div>
                      {excerpt && (
                        <p className="text-slate-500 dark:text-slate-400 truncate">{excerpt}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
