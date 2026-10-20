import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, RotateCcw, X as XIcon } from 'lucide-react';
import type { Surah } from '../types';
import { ALL_SURAHS } from '../data/surahs';
import { quizAudio } from '../utils/quizAudio';
import { toPersianDigits } from '../utils/textNormalization';
import { recordMemoSession } from '../services/memorizationStorage';
import { recordUserActivity } from '../services/activityTracker';
import { addVerseToReview, getProgress, gradeReview } from '../services/progress/progressStore';
import { QuizQuestion } from '../services/memorization/similarQuiz';
import { QuizScope, buildSessionQuiz } from '../services/memorization/similarQuizClient';
import { SessionResult, groupBySurah, totalsOf } from '../services/progress/reviewSession';

interface SimilarAyahQuizProps {
  /** سورهٔ فعلی صفحهٔ حفظ (برای حالت «آیه‌های این سوره») */
  surah: Surah;
  darkMode: boolean;
  arabicFontFamily: string;
  onBack: () => void;
}

const COUNTS = [5, 10, 15] as const;
const surahNameOf = (id: number) => ALL_SURAHS.find((s) => s.id === id)?.nameArabic ?? `سوره ${id}`;

const chip = (active: boolean) =>
  `p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
    active
      ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500'
      : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  }`;

/** تمرین متشابهات: ادامه یا آغاز درست آیه را از میان گزینه‌های واقعاً مشابه پیدا کن */
export const SimilarAyahQuiz: React.FC<SimilarAyahQuizProps> = ({ surah, darkMode, arabicFontFamily, onBack }) => {
  const [step, setStep] = useState<'options' | 'running' | 'done'>('options');
  const [scope, setScope] = useState<QuizScope>('mine');
  const [count, setCount] = useState<number>(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resultsRef = useRef<SessionResult[]>([]);
  resultsRef.current = results;
  const savedRef = useRef(false);

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
        mode: 'test',
      });
    }
    recordUserActivity('memorize');
  }, []);

  // خروج ناگهانی (دکمهٔ بازگشت صفحه): نتیجهٔ ثبت‌شده تا اینجا ذخیره می‌شود
  useEffect(() => () => saveSession(resultsRef.current), [saveSession]);

  const start = async () => {
    setBuilding(true);
    setMessage(null);
    const qs = await buildSessionQuiz({ scope, surahId: surah.id, count }).catch(() => []);
    setBuilding(false);
    if (qs.length === 0) {
      setMessage(
        scope === 'mine'
          ? 'میان آیه‌های حفظ‌شده یا در مرور شما، آیه‌ای با شباهت قابل‌پرسش پیدا نشد. «آیه‌های این سوره» را امتحان کنید.'
          : 'در این سوره آیهٔ دارای شباهت قابل‌پرسش پیدا نشد؛ سورهٔ دیگری را انتخاب کنید.'
      );
      return;
    }
    savedRef.current = false;
    setQuestions(qs);
    setResults([]);
    setIndex(0);
    setChosen(null);
    setStep('running');
  };

  const q = step === 'running' ? questions[index] : undefined;

  const choose = (ref: string) => {
    if (!q || chosen) return;
    setChosen(ref);
    const correct = q.options.find((o) => o.ref === ref)?.correct === true;
    if (correct) quizAudio.playCorrect();
    else {
      quizAudio.playIncorrect();
      // اشتباه گرفتن آیه: به مرور برمی‌گردد (یا اگر در مرور است یک «فراموشی» ثبت می‌شود)
      const p = getProgress(q.surahId, q.verseNumber);
      if (p?.inReview) gradeReview(p.key, 'again');
      else addVerseToReview(q.surahId, surahNameOf(q.surahId), q.verseNumber, true);
    }
    setResults((prev) => [
      ...prev,
      { surahId: q.surahId, surahName: surahNameOf(q.surahId), verseNumber: q.verseNumber, grade: correct ? 'good' : 'again' },
    ]);
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      saveSession(resultsRef.current);
      setStep('done');
    } else {
      setIndex(index + 1);
      setChosen(null);
    }
  };

  const card = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-stone-200 text-slate-900';
  const totals = totalsOf(results);

  const header = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
        aria-label="بازگشت به منوی حفظ"
      >
        <ArrowRight className="w-4 h-4" />
      </button>
      <div>
        <h2 className="font-bold text-base">تمرین متشابهات</h2>
        <p className="text-xs text-slate-400">ادامه یا آغاز درست آیه را از میان آیه‌های مشابه پیدا کنید</p>
      </div>
    </div>
  );

  if (step === 'options') {
    return (
      <div className="space-y-4" dir="rtl">
        {header}
        <div className={`p-4 rounded-3xl border space-y-5 ${card}`}>
          <section className="space-y-2">
            <h3 className="text-xs font-bold">آیه‌های پرسش</h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setScope('mine')} className={chip(scope === 'mine')}>
                <span className="block font-black">حفظیات من</span>
                <span className="text-[10px] opacity-75 font-normal block mt-0.5">اول آیه‌های پرخطا و در مرور</span>
              </button>
              <button type="button" onClick={() => setScope('surah')} className={chip(scope === 'surah')}>
                <span className="block font-black">آیه‌های این سوره</span>
                <span className="text-[10px] opacity-75 font-normal block mt-0.5">سورهٔ {surah.nameArabic}</span>
              </button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-bold">تعداد پرسش</h3>
            <div className="grid grid-cols-3 gap-2">
              {COUNTS.map((c) => (
                <button key={c} type="button" onClick={() => setCount(c)} className={chip(count === c)}>
                  {toPersianDigits(c)} پرسش
                </button>
              ))}
            </div>
          </section>
        </div>
        {message && (
          <p role="status" className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed px-1">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={start}
          disabled={building}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold text-sm cursor-pointer active:scale-[0.99] transition-all"
        >
          {building ? 'در حال آماده‌سازی…' : 'شروع تمرین'}
        </button>
      </div>
    );
  }

  if (step === 'done') {
    const wrong = results.filter((r) => r.grade === 'again');
    return (
      <div className="space-y-4" dir="rtl">
        {header}
        <div className={`p-6 rounded-3xl border text-center space-y-4 ${card}`}>
          <Check className="w-12 h-12 text-violet-600 mx-auto" />
          <h3 className="font-bold text-base">تمرین تمام شد</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{toPersianDigits(totals.good)}</div>
              <div className="text-slate-500 dark:text-slate-400">درست</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10">
              <div className="text-lg font-black text-rose-700 dark:text-rose-300">{toPersianDigits(totals.again)}</div>
              <div className="text-slate-500 dark:text-slate-400">اشتباه</div>
            </div>
          </div>
          {wrong.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              این آیه‌ها به مرور اضافه شدند:{' '}
              {wrong.map((r) => `${r.surahName} ${toPersianDigits(r.verseNumber)}`).join('، ')}
            </p>
          )}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setStep('options')}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>تمرین دوباره</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 font-bold text-xs cursor-pointer"
            >
              بازگشت
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const answered = chosen !== null;
  const progress = Math.round((index / questions.length) * 100);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="p-4 rounded-3xl bg-violet-600 text-white shadow-md space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-sm">
            پرسش {toPersianDigits(index + 1)} از {toPersianDigits(questions.length)}
          </div>
          <button
            type="button"
            onClick={() => {
              saveSession(resultsRef.current);
              onBack();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold cursor-pointer"
          >
            پایان
          </button>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={`p-5 rounded-3xl border space-y-4 ${card}`}>
        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
          سورهٔ {surahNameOf(q.surahId)}، آیهٔ {toPersianDigits(q.verseNumber)} —{' '}
          {q.mode === 'continue' ? 'ادامهٔ درست کدام است؟' : 'آغاز درست کدام است؟'}
        </p>
        <div className="text-2xl leading-[2.3] text-center py-1" style={{ fontFamily: arabicFontFamily }} dir="rtl">
          {q.promptText}
        </div>

        <div className="space-y-2">
          {q.options.map((o) => {
            const isChosen = chosen === o.ref;
            const state = !answered
              ? 'border-stone-200 dark:border-slate-700 hover:border-violet-400'
              : o.correct
              ? 'border-emerald-500 bg-emerald-500/10'
              : isChosen
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-stone-200 dark:border-slate-700 opacity-70';
            return (
              <button
                key={o.ref}
                type="button"
                onClick={() => choose(o.ref)}
                disabled={answered}
                className={`w-full text-right p-3 rounded-2xl border transition-all ${state} ${answered ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'}`}
              >
                <div className="text-xl leading-[2.2]" style={{ fontFamily: arabicFontFamily }} dir="rtl">
                  {o.text}
                </div>
                {answered && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-0.5">
                    {o.correct ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : isChosen ? <XIcon className="w-3.5 h-3.5 text-rose-600" /> : null}
                    <span>
                      سورهٔ {surahNameOf(o.surahId)}، آیهٔ {toPersianDigits(o.verseNumber)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <button
            type="button"
            onClick={next}
            className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm cursor-pointer active:scale-[0.99] transition-all"
          >
            {index + 1 >= questions.length ? 'مشاهدهٔ نتیجه' : 'پرسش بعد'}
          </button>
        )}
      </div>
    </div>
  );
};
