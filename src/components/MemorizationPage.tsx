import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight,
  GraduationCap,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  BookmarkCheck,
  Award,
  BookOpen,
  Volume2,
  ChevronDown,
  Sparkles,
  Loader2,
  Check,
  XCircle,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import { Surah, Verse, AppSettings } from '../types';
import { ReciterId, RECITER_NAMES, getAudioSourceUrl } from '../services/audioSources';
import { getArabicFontFamily } from '../utils/fontHelper';
import { toPersianDigits } from '../utils/textNormalization';
import { QuranicCard } from './QuranicOrnament';
import {
  getMemorizationProgress,
  getSurahMemorizationStats,
  setAyahMemorizationStatus,
  isVerseMemorized,
  MemorizationStats,
  MemorizationStatus,
  MemorizationProgress,
} from '../services/memorizationStorage';
import {
  createMemoState,
  buildAyahNumbers,
  advanceAfterAyahEnded,
  shouldMaskAyah,
  shouldMaskTranslation,
  isSessionDone,
  MemoMode,
  MemoRange,
  MemoSession,
} from '../services/memorizationEngine';

interface MemorizationPageProps {
  surahs: Surah[];
  currentSurah: Surah;
  verses: Verse[];
  onSelectSurah: (surah: Surah) => void;
  settings: AppSettings;
  darkMode: boolean;
  onBack: () => void;
}

const MEMO_RECITERS: { id: ReciterId; name: string }[] = [
  { id: 'parhizgar', name: RECITER_NAMES.parhizgar.name },
  { id: 'abdulbasit', name: RECITER_NAMES.abdulbasit.name },
  { id: 'minshawi', name: RECITER_NAMES.minshawi.name },
  { id: 'afasy', name: RECITER_NAMES.afasy.name },
];

const REPEAT_OPTIONS = [1, 2, 3, 5, 10];
const GAP_OPTIONS = [0, 1, 2, 3, 5];

export const MemorizationPage: React.FC<MemorizationPageProps> = ({
  surahs,
  currentSurah,
  verses,
  onSelectSurah,
  settings,
  darkMode,
  onBack,
}) => {
  // تب‌های صفحه: «خط‌بر و تمرین حفظ» یا «کارنامه و پایش پیشرفت»
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>('practice');

  // داده‌های پیشرفت حفظ
  const [overallProgress, setOverallProgress] = useState<MemorizationProgress>(getMemorizationProgress());
  const [surahStats, setSurahStats] = useState(getSurahMemorizationStats(currentSurah.id, currentSurah.versesCount));

  // تنظیمات جلسه تمرین
  const [mode, setMode] = useState<MemoMode>('review');
  const [range, setRange] = useState<MemoRange>({ start: 1, end: Math.min(10, verses.length || 7) });
  const [repeats, setRepeats] = useState(3);
  const [gapSec, setGapSec] = useState(2);
  const [reciterId, setReciterId] = useState<ReciterId>('parhizgar');
  const [session, setSession] = useState<MemoSession | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gapTimerRef = useRef<number | null>(null);

  // به‌روزرسانی آمار هنگام تغییر سوره یا رویداد تغییر حافظه
  const refreshStats = useCallback(() => {
    setOverallProgress(getMemorizationProgress());
    setSurahStats(getSurahMemorizationStats(currentSurah.id, currentSurah.versesCount));
  }, [currentSurah.id, currentSurah.versesCount]);

  useEffect(() => {
    refreshStats();
    setRange({ start: 1, end: Math.min(10, verses.length || 7) });

    const handleUpdate = () => refreshStats();
    window.addEventListener('mobin-memorization-updated', handleUpdate);
    return () => window.removeEventListener('mobin-memorization-updated', handleUpdate);
  }, [currentSurah.id, verses.length, refreshStats]);

  const ayahNumbers = buildAyahNumbers(range, verses.length);

  const currentVerse = session
    ? verses.find((v) => v.verseNumber === session.state.currentAyah)
    : undefined;

  const startSession = () => {
    if (ayahNumbers.length === 0) return;
    const state = createMemoState(mode, range, repeats, gapSec * 1000);
    setSession({ surahId: currentSurah.id, state: { ...state, phase: 'playing' as const }, ayahNumbers });
    setAudioError(false);
  };

  const stopSession = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
    if (gapTimerRef.current) window.clearTimeout(gapTimerRef.current);
    setSession(null);
  }, []);

  // پخش صوت آیه جاری
  useEffect(() => {
    if (!session || isSessionDone(session.state)) return;

    if (session.state.phase === 'playing') {
      const url = getAudioSourceUrl(reciterId, currentSurah.id, session.state.currentAyah, 0);
      if (url && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current
          .play()
          .then(() => {
            setIsAudioPlaying(true);
            setAudioError(false);
          })
          .catch(() => {
            setIsAudioPlaying(false);
            setAudioError(true);
          });
      } else {
        setAudioError(true);
      }
    }
  }, [session, reciterId, currentSurah.id]);

  const handleAudioEnded = () => {
    if (!session) return;
    setIsAudioPlaying(false);

    if (session.state.mode === 'test') {
      setSession((prev) => (prev ? { ...prev, state: { ...prev.state, phase: 'reveal' } } : prev));
      return;
    }

    const next = advanceAfterAyahEnded(session.state, session.ayahNumbers);
    if (isSessionDone(next)) {
      setSession((prev) => (prev ? { ...prev, state: next } : prev));
      return;
    }

    const delay = session.state.gapMs;
    gapTimerRef.current = window.setTimeout(() => {
      setSession((prev) => (prev ? { ...prev, state: { ...next, phase: 'playing' } } : prev));
    }, delay);
  };

  const handleToggleAyahStatus = (verseNumber: number, nextStatus: MemorizationStatus) => {
    setAyahMemorizationStatus(currentSurah.id, verseNumber, nextStatus);
    refreshStats();
  };

  const arabicFontFamily = getArabicFontFamily(settings.arabicFont);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-28 space-y-6" dir="rtl">
      {/* المان صوتی پنهان */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={() => {
          setIsAudioPlaying(false);
          setAudioError(true);
        }}
        preload="auto"
      />

      {/* سربرگ صفحه با دکمه بازگشت */}
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
              <GraduationCap className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              <span>مرکز تخصصی حفظ و تثبیت قرآن</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              خط‌بر هوشمند صوتی، پنهان‌سازی تدریجی متن و ثبت کارنامه پیشرفت
            </p>
          </div>
        </div>

        {/* سوییچ تب‌ها */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('practice')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'practice'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            جلسه تمرین
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'progress'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            پیشرفت و کارنامه
          </button>
        </div>
      </div>

      {/* کارت‌های شاخص پیشرفت حفظ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuranicCard darkMode={darkMode} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">کل آیات حفظ‌شده در قرآن</div>
              <div className="text-lg font-bold text-teal-700 dark:text-teal-300">
                {toPersianDigits(overallProgress.totalMemorized)} از {toPersianDigits(overallProgress.totalVerses || 6236)} آیه
              </div>
            </div>
          </div>
          <div className="w-full bg-stone-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-teal-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${overallProgress.percentage}%` }}
            />
          </div>
        </QuranicCard>

        <QuranicCard darkMode={darkMode} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">پیشرفت در سوره {currentSurah.nameArabic}</div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {toPersianDigits(surahStats.memorizedCount)} از {toPersianDigits(currentSurah.versesCount)} آیه ({toPersianDigits(surahStats.percentage)}٪)
              </div>
            </div>
          </div>
          <div className="w-full bg-stone-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${surahStats.percentage}%` }}
            />
          </div>
        </QuranicCard>

        <QuranicCard darkMode={darkMode} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">آیات باقی‌مانده سوره</div>
              <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                {toPersianDigits(Math.max(0, currentSurah.versesCount - surahStats.memorizedCount))} آیه
              </div>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-3 flex items-center justify-between">
            <span>حفظ‌شده: {toPersianDigits(surahStats.memorizedCount)} آیه</span>
            <span>کل آیات: {toPersianDigits(currentSurah.versesCount)} آیه</span>
          </div>
        </QuranicCard>
      </div>

      {/* انتخاب سوره هدف */}
      <div className="p-4 rounded-2xl bg-stone-100/70 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">سوره در حال تمرین:</span>
          <select
            value={currentSurah.id}
            onChange={(e) => {
              const target = surahs.find((s) => s.id === Number(e.target.value));
              if (target) {
                stopSession();
                onSelectSurah(target);
              }
            }}
            className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-teal-700 dark:text-teal-400 focus:outline-none"
          >
            {surahs.map((s) => (
              <option key={s.id} value={s.id}>
                سوره {toPersianDigits(s.id)} - {s.nameArabic} ({s.namePersian}) - {toPersianDigits(s.versesCount)} آیه
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
          جزء {toPersianDigits(currentSurah.juzNumber)} • {currentSurah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
        </span>
      </div>

      {/* محتوای تب ۱: جلسه تمرین با خط‌بر هوشمند */}
      {activeTab === 'practice' && (
        <div className="space-y-4">
          {!session ? (
            /* پنل تنظیمات شروع جلسه */
            <QuranicCard darkMode={darkMode} className="p-5 sm:p-6 space-y-5">
              <div className="border-b border-stone-200 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                  تنظیمات خط‌بر جلسه حفظ
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  بازه، شیوه تمرین و قاری مورد علاقه خود را برگزینید.
                </p>
              </div>

              {/* انتخاب حالت تمرین */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  شیوه جلسه:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setMode('review')}
                    className={`p-3.5 rounded-2xl border text-right transition-all ${
                      mode === 'review'
                        ? 'border-teal-600 bg-teal-600/10 shadow-xs'
                        : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs text-teal-700 dark:text-teal-300">
                      مرور تدریجی (پنهان‌سازی گام‌به‌گام)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      در تکرار اول متن کامل است و در هر تکرار ترجمه و کلمات پنهان می‌شوند تا ملکه ذهن شوند.
                    </div>
                  </button>

                  <button
                    onClick={() => setMode('test')}
                    className={`p-3.5 rounded-2xl border text-right transition-all ${
                      mode === 'test'
                        ? 'border-teal-600 bg-teal-600/10 shadow-xs'
                        : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="font-bold text-xs text-teal-700 dark:text-teal-300">
                      خودآزمایی و سنجش محفوظات
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      صوت آیه بدون نمایش متن پخش می‌شود؛ سپس متن آشکار می‌شود تا عملکرد خود را بسنجید.
                    </div>
                  </button>
                </div>
              </div>

              {/* انتخاب قاری ترتیل با اسامی اصیل و فارسی */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  قاری ترتیل برای خط‌بر:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MEMO_RECITERS.map((r) => {
                    const isSelected = reciterId === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setReciterId(r.id)}
                        className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-teal-600 bg-teal-600 text-white font-bold shadow-xs'
                            : 'border-stone-200 dark:border-slate-800 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <span className="text-xs truncate">{r.name}</span>
                        {isSelected && <Check className="w-4 h-4 shrink-0 mr-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* بازه آیات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-800">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    محدوده آیات سوره {currentSurah.nameArabic}:
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-400 block mb-0.5">از آیه</span>
                      <input
                        type="number"
                        min={1}
                        max={verses.length || currentSurah.versesCount}
                        value={range.start}
                        onChange={(e) => setRange((r) => ({ ...r, start: Math.max(1, Number(e.target.value) || 1) }))}
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-400 block mb-0.5">تا آیه</span>
                      <input
                        type="number"
                        min={1}
                        max={verses.length || currentSurah.versesCount}
                        value={range.end}
                        onChange={(e) => setRange((r) => ({ ...r, end: Math.max(1, Number(e.target.value) || 1) }))}
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-400 font-bold mt-2">
                    تعداد آیات منتخب: {toPersianDigits(ayahNumbers.length)} آیه
                  </div>
                </div>

                {/* تکرار و مکث */}
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-800 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      تعداد تکرار هر آیه:
                    </label>
                    <div className="flex items-center gap-1.5">
                      {REPEAT_OPTIONS.map((n) => (
                        <button
                          key={n}
                          onClick={() => setRepeats(n)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            repeats === n
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-700'
                          }`}
                        >
                          {toPersianDigits(n)} بار
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      فاصله مکث بین تکرارها:
                    </label>
                    <div className="flex items-center gap-1.5">
                      {GAP_OPTIONS.map((sec) => (
                        <button
                          key={sec}
                          onClick={() => setGapSec(sec)}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                            gapSec === sec
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-700'
                          }`}
                        >
                          {toPersianDigits(sec)}ث
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={startSession}
                disabled={ayahNumbers.length === 0}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>شروع جلسه تمرین با خط‌بر صوتی ({toPersianDigits(ayahNumbers.length)} آیه)</span>
              </button>
            </QuranicCard>
          ) : (
            /* صحنه فعال جلسه تمرین */
            <div className="space-y-4 animate-fadeIn">
              {/* نوار وضعیت جلسه */}
              <div className="p-4 rounded-2xl bg-teal-600 text-white shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="font-bold text-sm">
                    آیه {toPersianDigits(session.state.currentAyah)} از {toPersianDigits(range.end)}
                  </div>
                  <span className="text-xs opacity-90">
                    (تکرار {toPersianDigits(session.state.repetition)} از {toPersianDigits(session.state.repeats)})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isAudioPlaying && (
                    <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-2.5 py-1 rounded-xl">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      در حال تلاوت
                    </span>
                  )}
                  <button
                    onClick={stopSession}
                    className="px-3 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition-all"
                  >
                    پایان جلسه
                  </button>
                </div>
              </div>

              {/* کارت نمایش آیه جاری */}
              <QuranicCard darkMode={darkMode} className="p-6 sm:p-8 text-center space-y-4">
                {currentVerse ? (
                  <>
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      سوره {currentSurah.nameArabic} • آیه {toPersianDigits(currentVerse.verseNumber)}
                    </div>

                    {/* متن عربی با قابلیت ماسک / پنهان‌سازی */}
                    <div
                      className={`text-xl sm:text-3xl font-medium leading-[2.4] py-4 transition-all ${
                        shouldMaskAyah(session.state)
                          ? 'opacity-20 blur-sm select-none'
                          : darkMode
                          ? 'text-slate-100'
                          : 'text-slate-900'
                      }`}
                      style={{ fontFamily: arabicFontFamily }}
                      dir="rtl"
                    >
                      {currentVerse.textArabic}
                    </div>

                    {/* ترجمه آیه */}
                    <div
                      className={`text-sm text-slate-500 leading-relaxed max-w-xl mx-auto transition-all ${
                        shouldMaskTranslation(session.state) ? 'opacity-0 select-none' : 'opacity-100'
                      }`}
                    >
                      {currentVerse.translationMakarem || currentVerse.translationFooladvand}
                    </div>

                    {/* دکمه‌های ثبت وضعیت پس از خودآزمایی */}
                    {session.state.mode === 'test' && session.state.phase === 'reveal' && (
                      <div className="pt-4 border-t border-stone-200 dark:border-slate-800 flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            handleToggleAyahStatus(currentVerse.verseNumber, 'memorized');
                            handleAudioEnded();
                          }}
                          className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                        >
                          <Check className="w-4 h-4" />
                          <span>حفظ کامل بودم</span>
                        </button>
                        <button
                          onClick={() => {
                            handleToggleAyahStatus(currentVerse.verseNumber, 'review_needed');
                            handleAudioEnded();
                          }}
                          className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>نیاز به مرور دارم</span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12">
                    <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
                    <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                      جلسه تمرین به پایان رسید!
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      آیات {toPersianDigits(range.start)} تا {toPersianDigits(range.end)} سوره {currentSurah.nameArabic} با موفقیت مرور شد.
                    </p>
                    <button
                      onClick={startSession}
                      className="mt-4 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      تکرار مجدد جلسه
                    </button>
                  </div>
                )}
              </QuranicCard>
            </div>
          )}
        </div>
      )}

      {/* محتوای تب ۲: کارنامه و پایش پیشرفت حفظ تمام آیات سوره */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-100/70 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                وضعیت تک‌تک آیات سوره {currentSurah.nameArabic}
              </h3>
              <p className="text-xs text-slate-400">
                روی وضعیت هر آیه کلیک کنید تا به آسانی پیشرفت حفظ خود را ثبت و پیگیری نمایید.
              </p>
            </div>
            <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
              {toPersianDigits(surahStats.percentage)}٪ تکمیل
            </span>
          </div>

          <div className="space-y-2">
            {verses.map((verse) => {
              const isMemorized = isVerseMemorized(currentSurah.id, verse.verseNumber);
              const status = (isMemorized ? 'memorized' : 'unstarted') as MemorizationStatus;

              return (
                <div
                  key={verse.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                    status === 'memorized'
                      ? 'bg-teal-500/10 border-teal-500/30'
                      : status === 'review_needed'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : status === 'learning'
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : darkMode
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-stone-200'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {toPersianDigits(verse.verseNumber)}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-100 leading-relaxed"
                        style={{ fontFamily: arabicFontFamily }}
                        dir="rtl"
                      >
                        {verse.textArabic}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {verse.translationMakarem || verse.translationFooladvand}
                      </div>
                    </div>
                  </div>

                  {/* دکمه‌های سریع تعیین وضعیت */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() =>
                        handleToggleAyahStatus(
                          verse.verseNumber,
                          status === 'memorized' ? 'unstarted' : 'memorized'
                        )
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                        status === 'memorized'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-stone-100 dark:bg-slate-800 text-slate-500 hover:text-teal-600'
                      }`}
                      title="ثبت به عنوان حفظ کامل"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>حفظ</span>
                    </button>

                    <button
                      onClick={() =>
                        handleToggleAyahStatus(
                          verse.verseNumber,
                          status === 'review_needed' ? 'unstarted' : 'review_needed'
                        )
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                        status === 'review_needed'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-stone-100 dark:bg-slate-800 text-slate-500 hover:text-amber-600'
                      }`}
                      title="نیاز به مرور"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>مرور</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
