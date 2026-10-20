import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X, RotateCcw, Check, Flame, Lightbulb } from 'lucide-react';
import { QuranService } from '../services/quranService';
import { MemorizationHelpCard } from './MemorizationHelpCard';
import { gradeAyahReview, recordUserActivity, ReviewAyahItem } from '../services/activityTracker';
import { recordMemoSession } from '../services/memorizationStorage';
import { groupBySurah, totalsOf, SessionResult } from '../services/progress/reviewSession';
import type { ReviewGrade } from '../services/progress/progressCore';
import { getArabicFontFamily } from '../utils/fontHelper';
import { toPersianDigits } from '../utils/textNormalization';
import type { Verse } from '../types';

interface ReviewSessionProps {
  /** تصویر لحظه‌ای صف امروز؛ با ثبت پاسخ‌ها جابه‌جا نمی‌شود */
  items: ReviewAyahItem[];
  onExit: () => void;
  darkMode: boolean;
}

interface Loaded {
  cue?: Verse;
  target?: Verse;
}

export const ReviewSession: React.FC<ReviewSessionProps> = ({ items, onExit, darkMode }) => {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loaded, setLoaded] = useState<Loaded>({});
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const savedRef = useRef(false);

  const finished = index >= items.length;
  const item = finished ? undefined : items[index];

  // بارگذاری متن آیهٔ هدف و آیهٔ قبلی (سرنخ)
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setLoading(true);
    setLoaded({});
    (async () => {
      const [target, cue] = await Promise.all([
        QuranService.getVerseBySurahAndNumber(item.surahId, item.verseNumber).catch(() => undefined),
        item.verseNumber > 1
          ? QuranService.getVerseBySurahAndNumber(item.surahId, item.verseNumber - 1).catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      if (!cancelled) {
        setLoaded({ target, cue });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item]);

  /** ثبت یک‌باره‌ی جلسه (آمار + استمرار)؛ هم در پایان و هم با خروج زودهنگام */
  const saveSession = useCallback((done: SessionResult[]) => {
    if (savedRef.current || done.length === 0) return;
    savedRef.current = true;
    for (const rec of groupBySurah(done)) {
      recordMemoSession({
        surahId: rec.surahId,
        surahNameArabic: rec.surahNameArabic,
        range: rec.range,
        correct: rec.correct,
        wrong: rec.wrong,
        mode: 'review',
      });
    }
    recordUserActivity('memorize');
  }, []);

  useEffect(() => {
    if (finished) saveSession(results);
  }, [finished, results, saveSession]);

  const handleGrade = (grade: ReviewGrade) => {
    if (!item) return;
    gradeAyahReview(item.id, grade);
    setResults((prev) => [
      ...prev,
      { surahId: item.surahId, surahName: item.surahNameArabic, verseNumber: item.verseNumber, grade },
    ]);
    setRevealed(false);
    setHelpOpen(false);
    setIndex((i) => i + 1);
  };

  const handleExit = () => {
    saveSession(results);
    onExit();
  };

  const fontFamily = getArabicFontFamily();
  const totals = totalsOf(results);
  const progressPct = items.length > 0 ? Math.round((index / items.length) * 100) : 0;

  const card = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-stone-200 text-slate-900';
  const btn = 'px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all';

  const body = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="مرور امروز"
      dir="rtl"
      // پورتال در درخت React به والد وصل می‌ماند؛ بدون این، کلیک داخل مرور مودال میزبان را می‌بست
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border shadow-2xl p-4 sm:p-5 space-y-4 ${card}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm sm:text-base font-bold">مرور امروز</h2>
          <button
            type="button"
            onClick={handleExit}
            className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 cursor-pointer"
            aria-label="خروج از مرور"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!finished && item ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  آیهٔ {toPersianDigits(index + 1)} از {toPersianDigits(items.length)}
                </span>
                <span>جعبهٔ {toPersianDigits(item.box)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-teal-500 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-2 flex-wrap">
                <span>
                  سورهٔ {item.surahNameArabic}، آیهٔ {toPersianDigits(item.verseNumber)}
                </span>
                {item.isLeech && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[10px] flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    نیاز به توجه ویژه
                  </span>
                )}
              </div>

              {/* سرنخ: آیهٔ قبل (یا آغاز سوره) */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/70 text-center space-y-1">
                <div className="text-[10px] text-slate-400">
                  {item.verseNumber > 1 ? `آیهٔ قبل (${toPersianDigits(item.verseNumber - 1)})` : 'آغاز سوره'}
                </div>
                {loading ? (
                  <div className="text-xs text-slate-400 py-3">در حال بارگذاری…</div>
                ) : item.verseNumber > 1 ? (
                  <div className="text-xl leading-loose" style={{ fontFamily }} dir="rtl">
                    {loaded.cue?.textArabic ?? '—'}
                  </div>
                ) : (
                  <div className="text-lg py-1" style={{ fontFamily }}>
                    سورهٔ {item.surahNameArabic}
                  </div>
                )}
              </div>

              {!revealed ? (
                <div className="text-center space-y-3 py-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    آیهٔ بعد را از حفظ بخوانید، سپس آن را آشکار کنید.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className={`${btn} w-full bg-teal-600 hover:bg-teal-700 text-white`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>نمایش آیه</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                    {loaded.target ? (
                      <>
                        <div className="text-2xl leading-loose" style={{ fontFamily }} dir="rtl">
                          {loaded.target.textArabic}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {loaded.target.translationMakarem || loaded.target.translationFooladvand}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        متن این آیه در دسترس نیست؛ با مصحف تطبیق دهید و پاسخ را ثبت کنید.
                      </div>
                    )}
                  </div>

                  {(item.lapses ?? 0) >= 2 &&
                    (helpOpen ? (
                      <MemorizationHelpCard
                        surahId={item.surahId}
                        verseNumber={item.verseNumber}
                        surahName={item.surahNameArabic}
                        lapses={item.lapses ?? 0}
                        arabicFontFamily={fontFamily}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        className={`${btn} w-full border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10`}
                      >
                        <Lightbulb className="w-4 h-4" />
                        <span>
                          این آیه را {toPersianDigits(item.lapses ?? 0)} بار فراموش کرده‌اید؛ کمک برای حفظ
                        </span>
                      </button>
                    ))}

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleGrade('again')}
                      className={`${btn} border border-stone-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-700 dark:text-slate-200`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>نیاز به تکرار</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGrade('hard')}
                      className={`${btn} border border-stone-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-700 dark:text-slate-200`}
                    >
                      <span>سخت بود</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGrade('good')}
                      className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تثبیت شد</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">مرور امروز تمام شد</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{toPersianDigits(totals.good)}</div>
                <div className="text-slate-500 dark:text-slate-400">تثبیت شد</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <div className="text-lg font-black text-amber-700 dark:text-amber-300">{toPersianDigits(totals.hard)}</div>
                <div className="text-slate-500 dark:text-slate-400">سخت بود</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10">
                <div className="text-lg font-black text-rose-700 dark:text-rose-300">{toPersianDigits(totals.again)}</div>
                <div className="text-slate-500 dark:text-slate-400">نیاز به تکرار</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExit}
              className={`${btn} w-full bg-teal-600 hover:bg-teal-700 text-white`}
            >
              بازگشت
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : null;
};
