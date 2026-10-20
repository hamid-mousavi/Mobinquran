import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bot, Check, Eye, EyeOff, Headphones, Pause, RotateCcw, User, Mic } from 'lucide-react';
import type { Surah, Verse } from '../types';
import { ReciterId, getAudioSourceUrl } from '../services/audioSources';
import { evaluateRecitation, RecitationEvaluation } from '../utils/quranRecitationEvaluator';
import { quizAudio } from '../utils/quizAudio';
import { toPersianDigits } from '../utils/textNormalization';
import { useSpeechRecitation } from '../hooks/useSpeechRecitation';
import { recordMemoSession } from '../services/memorizationStorage';
import { recordUserActivity } from '../services/activityTracker';
import {
  DEFAULT_SELF_TEST_OPTIONS,
  SelfTestOptions,
  SelfTestResult,
  SelfTestVerdict,
  tallySelfTest,
  turnFor,
} from '../services/memorization/selfTestPlan';
import { SmartRecitationFeedbackPanel } from './voiceDiscussion/SmartRecitationFeedbackPanel';

interface MemorizationSelfTestProps {
  surah: Surah;
  verses: Verse[];
  /** آیه‌های محدودهٔ انتخاب‌شده به ترتیب */
  ayahNumbers: number[];
  reciterId: ReciterId;
  darkMode: boolean;
  arabicFontFamily: string;
  /** ثبت وضعیت آیه (حفظ‌شده / نیاز به مرور) در ذخیره‌گاه پیشرفت */
  onVerdict: (verseNumber: number, verdict: SelfTestVerdict) => void;
  onExit: () => void;
}

const EMPTY_EVALUATION: RecitationEvaluation = {
  accuracy: 0,
  isPass: false,
  totalTargetWords: 0,
  matchedWordsCount: 0,
  missedWordsCount: 0,
  wordResults: [],
  message: '',
  verdictType: 'empty',
};

const chip = (active: boolean) =>
  `p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
    active
      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
      : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  }`;

export const MemorizationSelfTest: React.FC<MemorizationSelfTestProps> = ({
  surah,
  verses,
  ayahNumbers,
  reciterId,
  darkMode,
  arabicFontFamily,
  onVerdict,
  onExit,
}) => {
  const [opts, setOpts] = useState<SelfTestOptions>(DEFAULT_SELF_TEST_OPTIONS);
  const [step, setStep] = useState<'options' | 'running' | 'done'>('options');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<SelfTestResult[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const speech = useSpeechRecitation(opts.speechDialect);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savedRef = useRef(false);
  const passedRef = useRef(false);
  const advanceTimer = useRef<number | null>(null);

  const set = <K extends keyof SelfTestOptions>(key: K, value: SelfTestOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const verseNumber = ayahNumbers[index];
  const verse = verses.find((v) => v.verseNumber === verseNumber);
  const turn = step === 'running' ? turnFor(index, opts.turnMode) : 'user';
  const tally = tallySelfTest(results);
  const voiceUsable = opts.answerMethod === 'voice' && speech.supported;

  // -------------------- صوت --------------------
  const stopAudio = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const playAyah = useCallback(() => {
    const url = getAudioSourceUrl(reciterId, surah.id, verseNumber, 0);
    if (!url || !audioRef.current) {
      setAudioError(true);
      return;
    }
    setAudioError(false);
    audioRef.current.src = url;
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setIsPlaying(false);
        setAudioError(true);
      });
  }, [reciterId, surah.id, verseNumber]);

  const toggleListen = () => {
    if (isPlaying) stopAudio();
    else playAyah();
  };

  // -------------------- ثبت نتیجه و پیشروی --------------------
  const saveSession = useCallback(
    (done: SelfTestResult[]) => {
      if (savedRef.current || done.length === 0) return;
      savedRef.current = true;
      const t = tallySelfTest(done);
      const nums = done.map((r) => r.verseNumber);
      recordMemoSession({
        surahId: surah.id,
        surahNameArabic: surah.nameArabic,
        range: { start: Math.min(...nums), end: Math.max(...nums) },
        correct: t.memorized,
        wrong: t.review,
        mode: 'test',
      });
      recordUserActivity('memorize');
    },
    [surah.id, surah.nameArabic]
  );

  const goNext = useCallback(
    (nextResults: SelfTestResult[]) => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      stopAudio();
      speech.reset();
      passedRef.current = false;
      setRevealed(false);
      if (index + 1 >= ayahNumbers.length) {
        saveSession(nextResults);
        setStep('done');
      } else {
        setIndex(index + 1);
      }
    },
    [ayahNumbers.length, index, saveSession, speech, stopAudio]
  );

  const answer = useCallback(
    (verdict: SelfTestVerdict) => {
      if (!verse) return;
      onVerdict(verse.verseNumber, verdict);
      const next = [...results, { verseNumber: verse.verseNumber, verdict }];
      setResults(next);
      goNext(next);
    },
    [goNext, onVerdict, results, verse]
  );

  const start = () => {
    savedRef.current = false;
    setResults([]);
    setIndex(0);
    setRevealed(false);
    setStep('running');
  };

  const exit = () => {
    stopAudio();
    speech.reset();
    saveSession(results);
    onExit();
  };

  // ورود به هر آیه: نوبت سیستم ← پخش خودکار؛ نوبت کاربر + «اول گوش بده» ← پخش
  useEffect(() => {
    if (step !== 'running' || !verse) return;
    if (turn === 'system' || (turn === 'user' && opts.listenFirst)) playAyah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, index]);

  // پایان پخش صوت: در نوبت سیستم، پس از مکثی کوتاه خودکار به آیهٔ بعد
  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (step === 'running' && turn === 'system') {
      advanceTimer.current = window.setTimeout(() => goNext(results), 700);
    }
  };

  // خروج ناگهانی (مثلاً دکمهٔ بازگشت صفحه): نتیجهٔ ثبت‌شده تا اینجا ذخیره می‌شود
  const resultsRef = useRef<SelfTestResult[]>([]);
  resultsRef.current = results;
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      saveSession(resultsRef.current);
    },
    [saveSession]
  );

  // -------------------- ارزیابی تلاوت --------------------
  const evaluation = useMemo<RecitationEvaluation>(() => {
    if (!verse || !speech.transcript) return EMPTY_EVALUATION;
    return evaluateRecitation(verse.textArabic, speech.transcript, opts.strictness);
  }, [verse, speech.transcript, opts.strictness]);

  useEffect(() => {
    if (step !== 'running' || turn !== 'user' || !voiceUsable) return;
    if (evaluation.isPass && !passedRef.current) {
      passedRef.current = true;
      if (opts.soundFeedback) quizAudio.playCorrect();
      if (opts.autoAdvanceOnPass) {
        advanceTimer.current = window.setTimeout(() => answer('memorized'), 1200);
      }
    }
  }, [evaluation.isPass, step, turn, voiceUsable, opts.soundFeedback, opts.autoAdvanceOnPass, answer]);

  const card = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-stone-200 text-slate-900';

  // ======================= مرحلهٔ گزینه‌ها =======================
  if (step === 'options') {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="p-2 rounded-xl hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-bold text-base">خودآزمایی و سنجش</h2>
            <p className="text-xs text-slate-400">
              سورهٔ {surah.nameArabic} • {toPersianDigits(ayahNumbers.length)} آیه
            </p>
          </div>
        </div>

        <div className={`p-4 rounded-3xl border space-y-5 ${card}`}>
          <section className="space-y-2">
            <h3 className="text-xs font-bold">روش پاسخ</h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set('answerMethod', 'self')} className={chip(opts.answerMethod === 'self')}>
                <span className="block font-black">ارزیابی خودم</span>
                <span className="text-[10px] opacity-75 font-normal block mt-0.5">نمایش آیه و ثبت با دکمه</span>
              </button>
              <button
                type="button"
                onClick={() => set('answerMethod', 'voice')}
                disabled={!speech.supported}
                className={`${chip(opts.answerMethod === 'voice')} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="block font-black">تلاوت با صدا</span>
                <span className="text-[10px] opacity-75 font-normal block mt-0.5">ارزیابی خودکار با میکروفون</span>
              </button>
            </div>
            {!speech.supported && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                مرورگر شما تشخیص گفتار را پشتیبانی نمی‌کند؛ فقط «ارزیابی خودم» در دسترس است.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold">نوبت‌ها</h3>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => set('turnMode', 'all_me')} className={chip(opts.turnMode === 'all_me')}>
                <User className="w-4 h-4 mx-auto mb-0.5" />
                همهٔ آیه‌ها با من
              </button>
              <button type="button" onClick={() => set('turnMode', 'system_first')} className={chip(opts.turnMode === 'system_first')}>
                <Bot className="w-4 h-4 mx-auto mb-0.5" />
                سیستم شروع کند
              </button>
              <button type="button" onClick={() => set('turnMode', 'me_first')} className={chip(opts.turnMode === 'me_first')}>
                <User className="w-4 h-4 mx-auto mb-0.5" />
                من شروع کنم
              </button>
            </div>
            {opts.turnMode !== 'all_me' && (
              <p className="text-[11px] text-slate-400">در نوبت سیستم، تلاوت قاری پخش می‌شود و نوبت بعدی با شماست.</p>
            )}
          </section>

          <section className="space-y-2 text-xs">
            <h3 className="text-xs font-bold">گزینه‌های کمکی</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={opts.hideUserText} onChange={(e) => set('hideUserText', e.target.checked)} />
              <span>مخفی‌سازی متن آیهٔ من (تلاوت از حفظ)</span>
            </label>
            {opts.turnMode !== 'all_me' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={opts.hideSystemText} onChange={(e) => set('hideSystemText', e.target.checked)} />
                <span>مخفی‌سازی متن آیهٔ سیستم (تقویت حافظهٔ شنیداری)</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={opts.listenFirst} onChange={(e) => set('listenFirst', e.target.checked)} />
              <span className="flex items-center gap-1">
                <Headphones className="w-3.5 h-3.5" />
                پیش از نوبت من، تلاوت قاری را گوش بده
              </span>
            </label>
          </section>

          {opts.answerMethod === 'voice' && (
            <section className="space-y-2.5 pt-3 border-t border-stone-100 dark:border-slate-800">
              <h3 className="text-xs font-bold">دقت ارزیابی صدا</h3>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['easy', 'آسان', 'اغماض در لهجه و تجوید'],
                    ['normal', 'استاندارد', 'تطابق دقیق کلمات'],
                    ['strict', 'مسابقه‌ای', 'بدون کلمهٔ جاافتاده'],
                  ] as const
                ).map(([key, title, hint]) => (
                  <button key={key} type="button" onClick={() => set('strictness', key)} className={chip(opts.strictness === key)}>
                    <span className="block font-black">{title}</span>
                    <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">{hint}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <span className="font-bold">لهجهٔ تشخیص:</span>
                <button type="button" onClick={() => set('speechDialect', 'ar-EG')} className={`px-3 py-1.5 rounded-xl border ${opts.speechDialect === 'ar-EG' ? 'border-emerald-500 bg-emerald-500/15' : 'border-stone-200 dark:border-slate-700'} cursor-pointer`}>
                  مصر
                </button>
                <button type="button" onClick={() => set('speechDialect', 'ar-SA')} className={`px-3 py-1.5 rounded-xl border ${opts.speechDialect === 'ar-SA' ? 'border-emerald-500 bg-emerald-500/15' : 'border-stone-200 dark:border-slate-700'} cursor-pointer`}>
                  حجاز / سعودی
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={opts.soundFeedback} onChange={(e) => set('soundFeedback', e.target.checked)} />
                <span>افکت صوتی برای تلاوت درست</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={opts.autoAdvanceOnPass} onChange={(e) => set('autoAdvanceOnPass', e.target.checked)} />
                <span>پس از تلاوت درست، خودکار «حفظ بودم» ثبت شود و آیهٔ بعد بیاید</span>
              </label>
            </section>
          )}
        </div>

        <button
          type="button"
          onClick={start}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
        >
          <Mic className="w-4 h-4" />
          <span>شروع خودآزمایی</span>
        </button>
      </div>
    );
  }

  // ======================= پایان =======================
  if (step === 'done') {
    const review = results.filter((r) => r.verdict === 'review').map((r) => r.verseNumber);
    return (
      <div className={`p-6 rounded-3xl border text-center space-y-4 ${card}`} dir="rtl">
        <Check className="w-12 h-12 text-teal-600 mx-auto" />
        <h3 className="font-bold text-base">خودآزمایی تمام شد</h3>
        {tally.tested > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{toPersianDigits(tally.memorized)}</div>
                <div className="text-slate-500 dark:text-slate-400">حفظ بودم</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <div className="text-lg font-black text-amber-700 dark:text-amber-300">{toPersianDigits(tally.review)}</div>
                <div className="text-slate-500 dark:text-slate-400">نیاز به مرور</div>
              </div>
              <div className="p-2.5 rounded-xl bg-teal-500/10">
                <div className="text-lg font-black text-teal-700 dark:text-teal-300">{toPersianDigits(tally.percent)}٪</div>
                <div className="text-slate-500 dark:text-slate-400">تسلط</div>
              </div>
            </div>
            {review.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                آیه‌های نیازمند مرور (به جعبهٔ مرور اضافه شدند): {review.map((n) => toPersianDigits(n)).join('، ')}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-400">در این جلسه آیه‌ای برای سنجش نبود (همه نوبت سیستم بود).</p>
        )}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setStep('options')}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>آزمون دوباره</span>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-slate-600 font-bold text-xs cursor-pointer"
          >
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  // ======================= جلسهٔ در حال اجرا =======================
  const hidden = turn === 'user' ? opts.hideUserText && !revealed : opts.hideSystemText && !revealed;
  const progress = Math.round((index / ayahNumbers.length) * 100);

  return (
    <div className="space-y-3" dir="rtl">
      <audio ref={audioRef} onEnded={handleAudioEnded} onPause={() => setIsPlaying(false)} preload="none" />

      <div className="p-4 rounded-3xl bg-teal-600 text-white shadow-md space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-sm">
            آیهٔ {toPersianDigits(verseNumber)} ({toPersianDigits(index + 1)} از {toPersianDigits(ayahNumbers.length)})
          </div>
          <button
            type="button"
            onClick={exit}
            className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold cursor-pointer"
          >
            پایان جلسه
          </button>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={`p-5 sm:p-7 rounded-3xl border text-center space-y-4 ${card}`}>
        <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
          <span className="text-amber-600 dark:text-amber-400">
            سورهٔ {surah.nameArabic} • آیهٔ {toPersianDigits(verseNumber)}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${
              turn === 'user' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
            }`}
          >
            {turn === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            {turn === 'user' ? 'نوبت شما' : 'نوبت سیستم'}
          </span>
        </div>

        {/* متن آیه */}
        <div className="relative">
          <div
            className={`text-2xl sm:text-3xl font-medium leading-[2.4] py-3 transition-all ${
              hidden ? 'opacity-20 blur-sm select-none' : ''
            }`}
            style={{ fontFamily: arabicFontFamily }}
            dir="rtl"
            aria-hidden={hidden}
          >
            {verse?.textArabic ?? '—'}
          </div>
          {hidden && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300">
              متن آیه پنهان است
            </div>
          )}
        </div>

        {/* کنترل‌های مشترک: نمایش/پنهان + گوش دادن */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {(turn === 'user' ? opts.hideUserText : opts.hideSystemText) && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{revealed ? 'پنهان کردن آیه' : 'نمایش آیه'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleListen}
            disabled={speech.isRecording}
            className="px-3 py-2 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={speech.isRecording ? 'هنگام ضبط، پخش تلاوت غیرفعال است' : undefined}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
            <span>{isPlaying ? 'توقف تلاوت' : 'گوش دادن به تلاوت'}</span>
          </button>
        </div>
        {audioError && <p className="text-[11px] text-rose-500">فایل صوتی این آیه برای قاری انتخاب‌شده یافت نشد.</p>}

        {/* پاسخ */}
        {turn === 'system' ? (
          <div className="pt-3 border-t border-stone-200 dark:border-slate-800 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => goNext(results)}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
            >
              ادامه (نوبت بعد)
            </button>
          </div>
        ) : voiceUsable ? (
          <div className="pt-3 border-t border-stone-200 dark:border-slate-800 text-right">
            <SmartRecitationFeedbackPanel
              evaluation={evaluation}
              transcribedText={speech.transcript}
              isRecording={speech.isRecording}
              onToggleRecording={speech.toggle}
              onRetry={() => {
                if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
                passedRef.current = false;
                speech.reset();
              }}
              onAccept={() => answer('memorized')}
              onReject={() => answer('review')}
              acceptLabel="حفظ بودم (آیهٔ بعد)"
              rejectLabel="نیاز به مرور دارم"
              targetText={verse?.textArabic}
              surahName={surah.nameArabic}
              verseNumber={toPersianDigits(verseNumber)}
              surahId={surah.id}
              rawVerseNumber={verseNumber}
            />
          </div>
        ) : (
          <div className="pt-3 border-t border-stone-200 dark:border-slate-800 space-y-2">
            {!revealed && opts.hideUserText ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                آیه را از حفظ بخوانید، سپس «نمایش آیه» را بزنید و نتیجه را ثبت کنید.
              </p>
            ) : (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => answer('memorized')}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ کامل بودم</span>
                </button>
                <button
                  type="button"
                  onClick={() => answer('review')}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>نیاز به مرور دارم</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
