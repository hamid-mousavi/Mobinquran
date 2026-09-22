import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Pause, RefreshCw, Check, XCircle, Eye, EyeOff, GraduationCap, Settings2, RotateCcw, SkipForward, Loader2 } from 'lucide-react';
import { Verse, Surah, AppSettings } from '../types';
import { ReciterId, getSourcesForReciter, getAudioSourceUrl } from '../services/audioSources';
import { getArabicFontFamily } from '../utils/fontHelper';
import {
  createMemoState,
  buildAyahNumbers,
  advanceAfterAyahEnded,
  revealAyah,
  recordSelfTest,
  shouldMaskAyah,
  shouldMaskTranslation,
  isSessionDone,
  MemoMode,
  MemoRange,
  MemoSession,
  MAX_REPEATS,
} from '../services/memorizationEngine';

interface MemorizationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentSurah: Surah;
  verses: Verse[];
  darkMode: boolean;
  settings: AppSettings;
  initialVerseNumber?: number | null;
}

const RECITER_IDS: ReciterId[] = ['parhizgar', 'abdulbasit', 'minshawi', 'afasy'];

const REPEAT_OPTIONS = [1, 2, 3, 5, 10];
const GAP_OPTIONS = [0, 1, 2, 3, 5, 10];

function getTranslationOf(verse: Verse, translator: AppSettings['activeTranslator']): string {
  switch (translator) {
    case 'fooladvand':
      return verse.translationFooladvand || verse.translationMakarem;
    case 'ansarian':
      return verse.translationAnsarian || verse.translationMakarem;
    case 'makarem':
    default:
      return verse.translationMakarem;
  }
}

export const MemorizationOverlay: React.FC<MemorizationOverlayProps> = ({
  isOpen,
  onClose,
  currentSurah,
  verses,
  darkMode,
  settings,
  initialVerseNumber,
}) => {
  const [mode, setMode] = useState<MemoMode>('review');
  const [range, setRange] = useState<MemoRange>({ start: 1, end: verses.length || 1 });
  const [repeats, setRepeats] = useState(3);
  const [gapSec, setGapSec] = useState(2);
  const [reciterId, setReciterId] = useState<ReciterId>('parhizgar');
  const [session, setSession] = useState<MemoSession | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gapTimerRef = useRef<number | null>(null);

  // هنگام باز شدن، بازه را روی آیهٔ فعلی (یا ابتدای سوره) تنظیم کن
  useEffect(() => {
    if (!isOpen) return;
    const start = initialVerseNumber && initialVerseNumber >= 1 ? initialVerseNumber : 1;
    setRange({ start, end: verses.length || 1 });
    setSession(null);
    setIsConfigOpen(true);
    setAudioError(false);
    return () => {
      if (gapTimerRef.current) window.clearTimeout(gapTimerRef.current);
    };
  }, [isOpen, initialVerseNumber, verses.length]);

  const ayahNumbers = buildAyahNumbers(range, verses.length);

  // قرارگیری متن: آیهٔ جاری یا undefined وقتی هنوز شروع نشده
  const currentVerse = session
    ? verses.find((v) => v.verseNumber === session.state.currentAyah)
    : undefined;

  const startSession = () => {
    if (ayahNumbers.length === 0) return;
    const state = createMemoState(mode, range, repeats, gapSec * 1000);
    // شروع فوری آیهٔ نخست
    setSession({ surahId: currentSurah.id, state: { ...state, phase: 'playing' as const }, ayahNumbers });
    setIsConfigOpen(false);
    setAudioError(false);
  };

  const stopSession = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
    if (gapTimerRef.current) window.clearTimeout(gapTimerRef.current);
    setSession(null);
    setIsConfigOpen(true);
  }, []);

  // پخش صوت آیهٔ جاری — وابسته به آیه/تکرار/قاری/فاز
  useEffect(() => {
    if (!session || !isSessionDone(session.state)) {
      // فاز playing: بارگذاری و پخش
      if (session && session.state.phase === 'playing') {
        const url = getAudioSourceUrl(reciterId, currentSurah.id, session.state.currentAyah, 0);
        if (url && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => setAudioError(true));
        } else if (!url) {
          setAudioError(true);
        }
      }
      return;
    }
  }, [session, reciterId, currentSurah.id]);

  const handleAudioEnded = () => {
    if (!session) return;
    // توقف پخش دیگری در انتظار ماندن هنگام gap
    setIsAudioPlaying(false);
    if (session.state.mode === 'test') {
      // خودآزمایی: بعد از پایان صوت، متن را برای خودسنجی نمایش بده
      setSession((prev) => (prev ? { ...prev, state: { ...prev.state, phase: 'reveal' } } : prev));
      return;
    }
    // مرور: gap بین تکرارها، سپس advance
    const next = advanceAfterAyahEnded(session.state, session.ayahNumbers);
    if (isSessionDone(next)) {
      setSession((prev) => (prev ? { ...prev, state: next } : prev));
      return;
    }
    const delay = session.state.gapMs;
    gapTimerRef.current = window.setTimeout(() => {
      setSession((prev) => (prev ? { ...prev, state: next } : prev));
    }, delay);
  };

  const handleRevealAction = () => {
    if (!session) return;
    setSession((prev) => (prev ? { ...prev, state: revealAyah(prev.state) } : prev));
  };

  const handleSelfTest = (correct: boolean) => {
    if (!session) return;
    setSession((prev) => (prev ? { ...prev, state: recordSelfTest(prev.state, prev.ayahNumbers, correct) } : prev));
  };

  const handleSkipToNextAyah = () => {
    if (!session) return;
    if (session.state.mode === 'test') {
      handleSelfTest(true);
    } else {
      const next = advanceAfterAyahEnded(session.state, session.ayahNumbers);
      setSession((prev) => (prev ? { ...prev, state: next } : prev));
    }
  };

  if (!isOpen) return null;

  const state = session?.state;
  const isNotStarted = !session;
  const arabicFontFamily = getArabicFontFamily(settings.arabicFont);
  const isMasked = state ? shouldMaskAyah(state) : false;
  const isTranslationMasked = state ? shouldMaskTranslation(state) : false;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className={`flex-1 overflow-y-auto ${darkMode ? 'bg-slate-950' : 'bg-[#faf8f5]'}`}>
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-5 space-y-4">
          {/* سربرگ */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">حالت حفظ — سوره {currentSurah.nameArabic}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  حفظ بخش دلخواه با تکرار و خودآزمایی
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {session && (
                <button
                  onClick={() => setIsConfigOpen((v) => !v)}
                  className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="تنظیمات جلسه"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => { stopSession(); onClose(); }}
                className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* صفحهٔ تنظیمات جلسه */}
          {isConfigOpen && (
            <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200 shadow-sm'
            }`}>
              <div>
                <div className="text-xs font-bold mb-2">حالت جلسه</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('review')}
                    className={`p-3 rounded-2xl border text-right transition-all ${
                      mode === 'review'
                        ? 'border-teal-600 bg-teal-600/10'
                        : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs">مرور (تدریجی)</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      متن کامل شروع می‌شود و با هر تکرار محوتر می‌شود
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('test')}
                    className={`p-3 rounded-2xl border text-right transition-all ${
                      mode === 'test'
                        ? 'border-teal-600 bg-teal-600/10'
                        : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs">خودآزمایی</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      متن پنهان پخش می‌شود؛ هر آیه را سنجش کن
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-bold mb-1.5">بازهٔ آیات</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 block mb-0.5">از آیه</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, verses.length)}
                        value={range.start}
                        onChange={(e) => setRange((r) => ({ ...r, start: Math.max(1, Number(e.target.value) || 1) }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-bold"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 block mb-0.5">تا آیه</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, verses.length)}
                        value={range.end}
                        onChange={(e) => setRange((r) => ({ ...r, end: Math.max(1, Number(e.target.value) || 1) }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {ayahNumbers.length} آیه در بازه انتخاب شد
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold mb-1.5">قاری ترتیل</div>
                  <div className="flex flex-wrap gap-1.5">
                    {RECITER_IDS.map((rid) => {
                      const name = getSourcesForReciter(rid)[0]?.name || rid;
                      return (
                        <button
                          key={rid}
                          onClick={() => setReciterId(rid)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                            reciterId === rid
                              ? 'border-teal-600 bg-teal-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {name.includes(' ') ? name.split(' ')[0] : name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold mb-1.5">تعداد تکرار هر آیه</div>
                  <div className="flex flex-wrap gap-1.5">
                    {REPEAT_OPTIONS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setRepeats(n)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          repeats === n
                            ? 'border-amber-500 bg-amber-500 text-slate-950'
                            : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {n}×
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold mb-1.5">فاصلهٔ بین تکرارها</div>
                  <div className="flex flex-wrap gap-1.5">
                    {GAP_OPTIONS.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGapSec(g)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          gapSec === g
                            ? 'border-amber-500 bg-amber-500 text-slate-950'
                            : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {g === 0 ? 'بدون' : `${g}s`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-relaxed">
                {mode === 'review'
                  ? 'در مرورِ تدریجی، تکرار نخست متن کامل را نشان می‌دهد و در هر تکرار، ترجمه و سپس متن پنهان می‌شود — گام‌به‌گام مانند حفظ سنتی.'
                  : 'خودآزمایی: آیه پخش می‌شود در حالی که متن پنهان است؛ پس از پخش، متن را نمایش می‌دهیم و شما یادگیری را ثبت می‌کنید.'}
              </div>

              <button
                onClick={startSession}
                disabled={ayahNumbers.length === 0}
                className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-current" />
                شروع جلسهٔ حفظ ({ayahNumbers.length} آیه)
              </button>
            </div>
          )}

          {/* صحنهٔ جلسهٔ حفظ */}
          {session && state && (
            <div className="rounded-3xl overflow-hidden border shadow-lg">
              {/* نوار وضعیت */}
              <div className={`px-4 py-2.5 flex items-center justify-between text-[11px] border-b ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-stone-200 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal-600 dark:text-teal-400">
                    {state.currentAyah} / {range.end}
                  </span>
                  <span className={darkMode ? 'text-slate-400' : 'text-slate-400'}>
                    تکرار {state.repetition}/{state.repeats}
                  </span>
                  {state.mode === 'test' && (
                    <span className="text-teal-600 dark:text-teal-400 font-bold">
                      ✓ {state.score.correct} • ✗ {state.score.wrong}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                    state.mode === 'test' ? 'bg-teal-600 text-white' : 'bg-amber-500 text-slate-950'
                  }`}>
                    {state.mode === 'test' ? 'خودآزمایی' : 'مرور'}
                  </span>
                  {isAudioPlaying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </div>
              </div>

              {state.phase === 'done' ? (
                /* نتیجهٔ نهایی */
                <div className={`p-8 text-center space-y-3 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-600/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    {state.mode === 'test' ? <GraduationCap className="w-7 h-7" /> : <Check className="w-7 h-7" />}
                  </div>
                  <h4 className="font-bold text-base">جلسهٔ حفظ به پایان رسید</h4>
                  <p className="text-xs text-slate-500">سوره {currentSurah.nameArabic}، آیات {range.start} تا {range.end}</p>
                  {state.mode === 'test' && (
                    <div className="text-xs font-bold">
                      خودآزمایی: {state.score.correct} صحیح • {state.score.wrong} نیازمند مرور
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={startSession}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      تکرار همین جلسه
                    </button>
                    <button
                      onClick={() => { stopSession(); onClose(); }}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs"
                    >
                      پایان
                    </button>
                  </div>
                </div>
              ) : isNotStarted ? (
                <div className={`p-10 text-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  <p className="text-sm text-slate-500">برای شروع جلسه، تنظیمات را پیکربندی و «شروع جلسهٔ حفظ» را بزنید.</p>
                </div>
              ) : (
                /* کارت اصلی آیه */
                <div className={`p-5 sm:p-8 space-y-4 relative ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  {/* محتوای آیه — با قفل انتخابی بسته به mask */}
                  {currentVerse && (
                    <>
                      <div className={`text-right font-medium transition-all ${darkMode ? 'text-slate-100' : 'text-slate-900'} leading-[2.5]`}
                        style={{ fontFamily: arabicFontFamily, fontSize: `${settings.arabicFontSize}px` }}
                        dir="rtl"
                      >
                        {isMasked && state.phase !== 'reveal' ? (
                          <span className="inline-block text-teal-600/50 dark:text-teal-400/40 select-all" dir="rtl">
                            ‿‿‿‿‿‿‿‿‿‿ (متن پنهان)
                          </span>
                        ) : (
                          <>
                            {currentVerse.textArabic}
                            <span className="inline-flex items-center justify-center mx-1.5 text-amber-600 dark:text-amber-400 font-bold opacity-85" style={{ fontSize: '0.85em' }}>
                              ﴿{currentVerse.verseNumber}﴾
                            </span>
                          </>
                        )}
                      </div>

                      {settings.showTranslation && (
                        <div className={`pt-3 border-t border-dashed ${darkMode ? 'border-slate-800' : 'border-stone-200'}`}>
                          {isTranslationMasked && state.phase !== 'reveal' ? (
                            <p className="text-sm text-slate-400 italic">ترجمه پنهان است…</p>
                          ) : (
                            <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-stone-700'}`} dir="rtl">
                              {getTranslationOf(currentVerse, settings.activeTranslator)}
                            </p>
                          )}
                        </div>
                      )}

                      {audioError && (
                        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-[11px] text-red-700 dark:text-red-300">
                          صوت این آیه در دسترس نیست؛ لطفاً اتصال را بررسی کنید یا به آیهٔ بعد بروید.
                        </div>
                      )}
                    </>
                  )}

                  {/* کنترل‌های جلسه */}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    {isAudioPlaying ? (
                      <button
                        onClick={() => {
                          if (audioRef.current) { audioRef.current.pause(); setIsAudioPlaying(false); }
                        }}
                        className="p-3 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        title="توقف"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (audioRef.current) audioRef.current.play().catch(() => setAudioError(true));
                        }}
                        className="p-3 rounded-full bg-teal-600 text-white hover:bg-teal-700"
                        title="پخش"
                      >
                        <Play className="w-4 h-4 fill-current mr-0.5" />
                      </button>
                    )}

                    {state.mode === 'test' && state.phase === 'reveal' && (
                      <>
                        <button
                          onClick={() => handleSelfTest(true)}
                          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          یادم بود
                        </button>
                        <button
                          onClick={() => handleSelfTest(false)}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          یادم نبود
                        </button>
                      </>
                    )}

                    {state.mode === 'test' && state.phase === 'playing' && (
                      <button
                        onClick={handleRevealAction}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        نمایش متن
                      </button>
                    )}

                    {/* در مرور: نمایش/حدسی متن هنگام پوشیده‌شدن */}
                    {state.mode === 'review' && isMasked && state.phase === 'playing' && (
                      <button
                        onClick={() => setSession((prev) => (prev ? { ...prev, state: { ...prev.state, phase: 'reveal', maskLevel: 0 as const } } : prev))}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        نشان دادن متن (حدس)
                      </button>
                    )}

                    {(state.phase === 'playing' || state.phase === 'reveal') && (
                      <button
                        onClick={handleSkipToNextAyah}
                        className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5"
                        title="رد کردن و رفتن به آیهٔ بعد"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        رد کردن
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* audioplayer پنهان */}
      <audio
        ref={audioRef}
        onPlaying={() => setIsAudioPlaying(true)}
        onPause={() => setIsAudioPlaying(false)}
        onEnded={handleAudioEnded}
        onError={() => setAudioError(true)}
        className="hidden"
      />
    </div>
  );
};