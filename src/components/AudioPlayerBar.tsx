import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, User, Repeat, Info, Check, Timer, TimerOff, ListMusic } from 'lucide-react';
import { Verse, Surah } from '../types';
import {
  ReciterId,
  getSourcesForReciter,
  getAudioSourceUrl,
  resolveAudioSource,
  getWorkingSourceIndex,
  setWorkingSourceIndex,
} from '../services/audioSources';
import {
  saveAudioResumePosition,
  loadAudioResumePosition,
  clearAudioResumePosition,
  loadSleepTimerPrefs,
  saveSleepTimerPrefs,
  formatSleepTimeRemaining,
} from '../services/audioPlaybackPrefs';
import { logAudioError, classifyAudioError, describeAudioError, getAudioErrorLog, clearAudioErrorLog } from '../services/audioErrorLog';

interface AudioPlayerBarProps {
  currentSurah: Surah;
  verses: Verse[];
  activeVerseNumber: number | null;
  onSelectVerseToPlay: (verseNumber: number) => void;
  onClose: () => void;
  darkMode: boolean;
  onAutoAdvanceToNextSurah?: () => void;
  onJumpToSurah?: (surahId: number) => void;
  allSurahs?: { id: number; nameArabic: string }[];
}

export type { ReciterId } from '../services/audioSources';

interface Reciter {
  id: ReciterId;
  name: string;
  subname: string;
  bio: string;
  initials: string;
  avatarColor: string;
}

const RECITERS: Reciter[] = [
  {
    id: 'parhizgar',
    name: 'استاد شهریار پرهیزگار',
    subname: 'ترتیل آموزشی و تجوید دقیق',
    bio: 'قاری بین‌المللی و حافظ کل قرآن کریم از ایران؛ دارنده رتبه اول مسابقات جهانی و استانداردترین دوره ترتیل آموزشی جهت یادگیری روخوانی و حفظ.',
    initials: 'ش‌پ',
    avatarColor: 'bg-emerald-700 text-white',
  },
  {
    id: 'abdulbasit',
    name: 'استاد عبدالباسط عبدالصمد',
    subname: 'ترتیل مجلسی و لحن حزین',
    bio: 'ملقب به «صوت مکه»؛ یکی از بزرگ‌ترین و نامدارترین قاریان تاریخ جهان اسلام از مصر با لحنی دلنشین، عمیق و پرصلابت.',
    initials: 'ع‌ب',
    avatarColor: 'bg-amber-700 text-white',
  },
  {
    id: 'minshawi',
    name: 'استاد محمدصدیق منشاوی',
    subname: 'ترتیل باوقار و خاشعانه',
    bio: 'ملقب به «شهید القراء»؛ دارای سبک ترتیل بی‌نظیر حزن‌آلود و خاشعانه با کامل‌ترین قواعد تجوید و وقف و ابتدا.',
    initials: 'م‌ص',
    avatarColor: 'bg-blue-700 text-white',
  },
  {
    id: 'afasy',
    name: 'مشاری بن راشد العفاسی',
    subname: 'ترتیل استودیویی مدرن',
    bio: 'امام جماعت مسجد کبیر کویت و قاری سرشناس معاصر با ضبط‌های صوتی دیجیتال باکیفیت و صوت رسا.',
    initials: 'م‌ع',
    avatarColor: 'bg-teal-700 text-white',
  },
];

const REPEAT_OPTIONS = [
  { value: 1, label: '۱ بار' },
  { value: 2, label: '۲ بار' },
  { value: 3, label: '۳ بار' },
  { value: 5, label: '۵ بار' },
  { value: 10, label: '۱۰ بار' },
  { value: 999, label: 'پیوسته' },
];

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentSurah,
  verses,
  activeVerseNumber,
  onSelectVerseToPlay,
  onClose,
  darkMode,
  onAutoAdvanceToNextSurah,
  onJumpToSurah,
  allSurahs = [],
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedReciterId, setSelectedReciterId] = useState<ReciterId>('parhizgar');
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState(() => getWorkingSourceIndex('parhizgar')); // منبع fallback فعال برای آیه جاری

  // نگهداری وضعیت پخش برای جلوگیری از چرخهٔ بازتولید در هوک تغییر آیه
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const activeBlobUrlRef = useRef<string | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  // حالت تکرار آیه
  const [repeatTarget, setRepeatTarget] = useState<number>(1); // تعداد کل تکرار هر آیه
  const [currentRepeatIndex, setCurrentRepeatIndex] = useState<number>(1); // تکرار فعلی
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);

  // تایمر خواب (P5-T3)
  const [sleepTimer, setSleepTimer] = useState<{ mode: 'time' | 'verses'; value: number } | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const [sleepShowNotice, setSleepShowNotice] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  // صف پخش پیوسته (P5-T3): سورهٔ فعلی + سوره‌های بعدی
  const [showQueueMenu, setShowQueueMenu] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const SPEEDS = [0.75, 1, 1.25, 1.5];

  const handleCycleSpeed = () => {
    const currentIndex = SPEEDS.indexOf(playbackRate);
    const nextSpeed = SPEEDS[(currentIndex + 1) % SPEEDS.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const currentReciter = RECITERS.find((r) => r.id === selectedReciterId) || RECITERS[0];
  const currentPlayingVerseNumber = activeVerseNumber || (verses.length > 0 ? verses[0].verseNumber : 1);
  const currentSources = getSourcesForReciter(selectedReciterId);
  const currentAudioSource = currentSources[Math.min(sourceIndex, currentSources.length - 1)];

  // Media Session API — کنترل از قفل صفحه / مرکز اعلان
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `آیه ${currentPlayingVerseNumber} — ${currentSurah.namePersian}`,
      artist: currentReciter.name,
      album: 'قرآن مبین ۲',
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevVerse());
    navigator.mediaSession.setActionHandler('nexttrack', () => handleNextVerse());
    // پخش پس‌زمینه: جابه‌جایی ±۱۰ ثانیه از قفل صفحه / مرکز اعلان (P5-T3)
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (audioRef.current && audioRef.current.duration) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration,
          audioRef.current.currentTime + 10
        );
      }
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    });
    if ('playbackState' in navigator.mediaSession) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('stop', null);
    };
  }, [currentPlayingVerseNumber, currentSurah.id, currentSurah.namePersian, currentReciter.name, isPlaying]);

  // تنظیم مجدد منبع به منبع فعال این قاری هنگام تغییر قاری یا آیه
  useEffect(() => {
    setCurrentRepeatIndex(1);
    setSourceIndex(getWorkingSourceIndex(selectedReciterId));
  }, [currentPlayingVerseNumber, selectedReciterId]);

  // ذخیرهٔ موقعیت پخش (P5-T3: ادامه از آخرین آیه در دفعهٔ بعد)
  useEffect(() => {
    saveAudioResumePosition({
      surahId: currentSurah.id,
      verseNumber: currentPlayingVerseNumber,
      reciterId: selectedReciterId,
      playbackRate,
      updatedAt: Date.now(),
    });
  }, [currentSurah.id, currentPlayingVerseNumber, selectedReciterId, playbackRate]);

  // تایمر خواب بر اساس زمان (P5-T3): شمارش معکوس فقط هنگام پخش
  useEffect(() => {
    if (!sleepTimer || sleepTimer.mode !== 'time' || !isPlaying) return;
    setSleepRemainingSec(sleepTimer.value * 60);
    const interval = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          // زمان تمام شد: توقف پخش و بستن تایمر
          window.clearInterval(interval);
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
          setSleepRemainingSec(null);
          setSleepTimer(null);
          setSleepShowNotice(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sleepTimer, isPlaying]);

  // بررسی کش محلی Cache Storage برای پخش آفلاین پایدار و بدون وقفه
  const resolvePlayableUrl = async (rawUrl: string): Promise<string> => {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cache = await caches.open('quran-audio-v1');
        const match = await cache.match(rawUrl);
        if (match) {
          const blob = await match.blob();
          return URL.createObjectURL(blob);
        }
      }
    } catch {
      // کش در دسترس نیست؛ استفاده مستقیم از آدرس شبکه
    }
    return rawUrl;
  };

  // تغییر سورس و فایل صوتی هنگام تغییر آیه، قاری یا سورس فال‌بک
  // توجه: isPlaying در وابستگی‌ها قرار نمی‌گیرد تا تغییر وضعیت پخش موجب قطع فایل صوتی و خطای کاذب نشود
  useEffect(() => {
    let isCancelled = false;
    setPlaybackError(null);

    const resolved = resolveAudioSource(
      selectedReciterId,
      currentSurah.id,
      currentPlayingVerseNumber,
      sourceIndex
    );

    if (!resolved) {
      setIsPlaying(false);
      setPlaybackError('فایل صوتی برای این آیه یافت نشد.');
      return;
    }

    if (resolved.sourceIndex !== sourceIndex) {
      setSourceIndex(resolved.sourceIndex);
      setWorkingSourceIndex(selectedReciterId, resolved.sourceIndex);
    }

    resolvePlayableUrl(resolved.url).then((playableUrl) => {
      if (isCancelled || !audioRef.current) return;

      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      if (playableUrl.startsWith('blob:')) {
        activeBlobUrlRef.current = playableUrl;
      }

      audioRef.current.src = playableUrl;
      audioRef.current.playbackRate = playbackRate;

      if (isPlayingRef.current) {
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.catch((err) => {
            if (err?.name === 'AbortError') return;
            console.warn('Audio playback error:', err);
            setIsPlaying(false);
          });
        }
      }
    });

    // پیش‌بارگذاری هوشمند آیه بعدی جهت پخش پیوسته و بدون وقفه
    const nextVerseNum = currentPlayingVerseNumber + 1;
    const hasNext = verses.some((v) => v.verseNumber === nextVerseNum);
    if (hasNext && preloadAudioRef.current) {
      const nextResolved = resolveAudioSource(
        selectedReciterId,
        currentSurah.id,
        nextVerseNum,
        sourceIndex
      );
      if (nextResolved) {
        preloadAudioRef.current.src = nextResolved.url;
        preloadAudioRef.current.load();
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [currentSurah.id, currentPlayingVerseNumber, selectedReciterId, sourceIndex]);

  // اعمال سرعت پخش بدون تغییر منبع (اصلاح باگ M2)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          if (err?.name === 'AbortError') return;
          console.warn('Audio playback error:', err);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const handleNextVerse = () => {
    const currentIndex = verses.findIndex((v) => v.verseNumber === currentPlayingVerseNumber);
    if (currentIndex !== -1 && currentIndex < verses.length - 1) {
      setCurrentRepeatIndex(1);
      setPlaybackError(null);
      onSelectVerseToPlay(verses[currentIndex + 1].verseNumber);
    } else if (currentIndex !== -1 && currentIndex === verses.length - 1) {
      // پایان سوره: در صورت وجود، به سوره بعد برو
      if (onAutoAdvanceToNextSurah) {
        setCurrentRepeatIndex(1);
        setPlaybackError(null);
        onAutoAdvanceToNextSurah();
      } else {
        setCurrentRepeatIndex(1);
        setPlaybackError(null);
        setPlaybackError('پایان بخش ترتیل رسید.');
      }
    }
  };

  const handlePrevVerse = () => {
    const currentIndex = verses.findIndex((v) => v.verseNumber === currentPlayingVerseNumber);
    if (currentIndex > 0) {
      setCurrentRepeatIndex(1);
      onSelectVerseToPlay(verses[currentIndex - 1].verseNumber);
    }
  };

  // مدیریت پایان پخش یک آیه و بررسی تکرار
  const handleAudioEnded = () => {
    if (repeatTarget > 1) {
      if (repeatTarget >= 999 || currentRepeatIndex < repeatTarget) {
        // تکرار مجدد همین آیه
        setCurrentRepeatIndex((prev) => prev + 1);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        return;
      }
    }

    // تایمر خواب به‌صورت «تعداد آیه»: هر آیهٔ کامل‌شده یک‌بار شمارش می‌شود
    if (sleepTimer && sleepTimer.mode === 'verses') {
      const next = { ...sleepTimer, value: sleepTimer.value - 1 };
      if (next.value <= 0) {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
        setSleepTimer(null);
        setSleepShowNotice(true);
        return;
      }
      setSleepTimer(next);
      saveSleepTimerPrefs(next);
    }

    // اگر تکرار به پایان رسید، برو به آیه بعدی
    setCurrentRepeatIndex(1);
    handleNextVerse();
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  // خطای پخش (فایل یافت نشد / شبکه) — P5-T5: طبقه‌بندی و ثبت در لاگ مشاهده‌پذیری + fallback خودکار
  const handleAudioError = () => {
    const sources = getSourcesForReciter(selectedReciterId);
    const mediaCode =
      audioRef.current && audioRef.current.error
        ? (audioRef.current.error as MediaError).code
        : null;
    const kind = classifyAudioError(mediaCode, navigator.onLine);
    const currentSource = sources[Math.min(sourceIndex, sources.length - 1)];
    const url = getAudioSourceUrl(
      selectedReciterId,
      currentSurah.id,
      currentPlayingVerseNumber,
      Math.min(sourceIndex, sources.length - 1)
    );

    // ثبت در لاگ مشاهده‌پذیری (فقط پس از اتمام زنجیرهٔ fallback برای جلوگیری از نویز)
    if (sourceIndex >= sources.length - 1) {
      logAudioError({
        surahId: currentSurah.id,
        verseNumber: currentPlayingVerseNumber,
        reciterId: selectedReciterId,
        sourceIndex,
        sourceName: currentSource.name,
        kind,
        message: describeAudioError(kind),
        url: url ?? '',
      });
    }

    if (sourceIndex < sources.length - 1) {
      // آرایه دارای منبع بعدی است؛ سوئیچ به آن و ذخیره در نشست
      const nextIndex = sourceIndex + 1;
      setSourceIndex(nextIndex);
      setWorkingSourceIndex(selectedReciterId, nextIndex);
      setPlaybackError(null);
      return;
    }
    setIsPlaying(false);
    setPlaybackError(describeAudioError(kind));
  };

  // ادامه به آیه بعد هنگام تکرار و خطا
  const handleSkipVerse = () => {
    handleNextVerse();
  };

  const handleRetry = () => {
    setPlaybackError(null);
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => setIsPlaying(false));
    }
  };

  return (
    <>
      <div
        id="audio-player-floating-bar"
        className={`fixed bottom-0 left-0 right-0 z-40 border-t shadow-2xl backdrop-blur-md transition-all ${
          darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-stone-200 text-slate-800'
        }`}
      >
        {/* نوار باریک پیشرفت پخش آیه */}
        <div className="w-full h-1 bg-stone-200 dark:bg-slate-800">
          <div
            className="h-full bg-amber-500 transition-all duration-200"
            style={{ width: `${audioProgress}%` }}
          />
        </div>

        {/* پیام خطای پخش */}
        {playbackError && (
          <div className={`px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs flex items-center justify-between gap-2 border-t ${
            darkMode ? 'bg-red-950/60 border-slate-800 text-red-300' : 'bg-red-50 border-stone-200 text-red-700'
          }`}>
            <span className="truncate">{playbackError}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleRetry}
                className="px-2 py-0.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-[10px] font-bold transition-colors"
              >
                تلاش مجدد
              </button>
              <button
                onClick={handleSkipVerse}
                className="px-2 py-0.5 rounded-lg border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-[10px] font-bold transition-colors"
              >
                رد کردن آیه
              </button>
            </span>
          </div>
        )}

        {/* اعلان تایمر خواب */}
        {sleepShowNotice && (
          <div className={`px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs flex items-center justify-center gap-2 border-t ${
            darkMode ? 'bg-indigo-950/60 border-slate-800 text-indigo-200' : 'bg-indigo-50 border-stone-200 text-indigo-700'
          }`}>
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <span>تایمر خواب به پایان رسید و پخش متوقف شد. برای ادامه، دکمه پخش را بزنید.</span>
          </div>
        )}

        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-2">
          {/* سمت راست: عکس قاری (آواتار جمع‌وجور) + اطلاعات آیه */}
          <div className="flex items-center gap-2 min-w-0">
            {/* دکمه آواتار قاری با قابلیت کلیک جهت نمایش مشخصات */}
            <button
              onClick={() => setShowReciterModal(true)}
              className="relative group shrink-0"
              title={`قاری: ${currentReciter.name} (کلیک جهت مشاهده اطلاعات یا تغییر)`}
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm border-2 border-teal-600/70 shadow-sm group-hover:scale-105 group-hover:border-teal-500 transition-all ${currentReciter.avatarColor}`}>
                {currentReciter.initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-teal-600 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-white text-[8px]">
                <Info className="w-2 h-2" />
              </span>
            </button>

            {/* عنوان سوره و شماره آیه */}
            <div className="min-w-0 text-right">
              <div className="font-bold text-xs sm:text-sm truncate">
                {currentSurah.nameArabic} : آیه {currentPlayingVerseNumber}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 flex items-center gap-1 truncate">
                <span>جزء {verses.find((v) => v.verseNumber === currentPlayingVerseNumber)?.juzNumber || currentSurah.juzNumber}</span>
                {repeatTarget > 1 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-1 rounded">
                    تکرار {currentRepeatIndex}/{repeatTarget >= 999 ? '∞' : repeatTarget}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* مرکز: دکمه‌های کنترل ترتیل (بدون تداخل با متن) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* آیه قبلی */}
            <button
              onClick={handlePrevVerse}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
              title="آیه قبلی"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* دکمه اصلی پخش / توقف */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg hover:shadow-teal-500/20 transition-all active:scale-95"
              title={isPlaying ? 'توقف' : 'پخش ترتیل'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current mr-0.5" />
              )}
            </button>

            {/* آیه بعدی */}
            <button
              onClick={handleNextVerse}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
              title="آیه بعدی"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* سمت چپ: تعداد تکرار آیه + سرعت + صدا + بستن */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* دکمه تعداد تکرار */}
            <div className="relative">
              <button
                onClick={() => setShowRepeatMenu(!showRepeatMenu)}
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  repeatTarget > 1
                    ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
                title="تعداد تکرار هر آیه (مناسب حفظ و تمرین)"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">تکرار:</span>
                <span>{repeatTarget >= 999 ? '∞' : `${repeatTarget}×`}</span>
              </button>

              {/* منوی گزینه‌های تعداد تکرار */}
              {showRepeatMenu && (
                <div
                  className={`absolute bottom-full left-0 mb-2 w-32 p-1.5 rounded-2xl shadow-xl border z-50 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-stone-200 text-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-stone-100 dark:border-slate-800 mb-1">
                    تکرار هر آیه:
                  </div>
                  {REPEAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setRepeatTarget(opt.value);
                        setCurrentRepeatIndex(1);
                        setShowRepeatMenu(false);
                      }}
                      className={`w-full text-right px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors ${
                        repeatTarget === opt.value
                          ? 'bg-amber-500 text-white font-bold'
                          : 'hover:bg-stone-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {repeatTarget === opt.value && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* دکمه صف پخش پیوسته */}
            <div className="relative">
              <button
                onClick={() => setShowQueueMenu(!showQueueMenu)}
                className="p-1.5 sm:p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                title="صف پخش (سوره‌های در انتظار)"
              >
                <ListMusic className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {showQueueMenu && (
                <div
                  className={`absolute bottom-full left-0 mb-2 w-72 p-2 shadow-xl border rounded-2xl z-50 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-stone-200 text-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-stone-100 dark:border-slate-800 mb-1">
                    صف پخش — سورهٔ فعلی و بعدی (پخش پیوسته)
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                    {(allSurahs || []).map((s) => {
                      const isCurrent = s.id === currentSurah.id;
                      const playable = isCurrent || (onAutoAdvanceToNextSurah !== undefined);
                      return (
                        <button
                          key={s.id}
                          disabled={!playable}
                          onClick={() => {
                            if (!isCurrent && onJumpToSurah) {
                              onJumpToSurah(s.id);
                            }
                            setShowQueueMenu(false);
                          }}
                          className={`w-full text-right px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-teal-600 text-white font-bold'
                              : 'hover:bg-stone-100 dark:hover:bg-slate-800 disabled:opacity-40'
                          }`}
                        >
                          <span className="truncate">{s.nameArabic}</span>
                          {isCurrent && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 px-2 py-1.5 mt-1 border-t border-stone-100 dark:border-slate-800">
                    پس از پایان آخرین آیهٔ هر سوره، به‌طور خودکار سورهٔ بعدی پخش می‌شود.
                  </div>
                </div>
              )}
            </div>

            {/* دکمه تنظیم سرعت پخش */}
            <button
              onClick={handleCycleSpeed}
              className="px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
              title="تغییر سرعت ترتیل"
            >
              {playbackRate}x
            </button>

            {/* دکمه تایمر خواب */}
            <div className="relative">
              <button
                onClick={() => setShowSleepMenu(!showSleepMenu)}
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  sleepTimer
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
                title="تایمر خواب (توقف خودکار پخش)"
              >
                <Timer className="w-3.5 h-3.5" />
                {sleepTimer
                  ? sleepTimer.mode === 'time'
                    ? sleepRemainingSec !== null
                      ? formatSleepTimeRemaining(sleepRemainingSec)
                      : `${sleepTimer.value} دقیقه`
                    : `${sleepTimer.value} آیه`
                  : null}
              </button>

              {/* منوی گزینه‌های تایمر خواب */}
              {showSleepMenu && (
                <div
                  className={`absolute bottom-full left-0 mb-2 w-48 p-2 shadow-xl border rounded-2xl z-50 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-stone-200 text-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-stone-100 dark:border-slate-800 mb-1">
                    توقف خودکار پخش پس از:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {[5, 10, 15, 30, 45, 60].map((min) => (
                      <button
                        key={min}
                        onClick={() => {
                          setSleepTimer({ mode: 'time', value: min });
                          setSleepRemainingSec(min * 60);
                          setSleepShowNotice(false);
                          setShowSleepMenu(false);
                        }}
                        className={`px-2 py-1.5 rounded-xl text-center font-bold transition-colors ${
                          sleepTimer?.mode === 'time' && sleepTimer.value === min
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-stone-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {min} دقیقه
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1">یا تعداد آیه:</div>
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    {[5, 10, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setSleepTimer({ mode: 'verses', value: n });
                          setSleepShowNotice(false);
                          setShowSleepMenu(false);
                        }}
                        className={`px-2 py-1.5 rounded-xl text-center font-bold transition-colors ${
                          sleepTimer?.mode === 'verses' && sleepTimer.value === n
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-stone-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {n} آیه
                      </button>
                    ))}
                  </div>
                  {sleepTimer && (
                    <button
                      onClick={() => {
                        setSleepTimer(null);
                        setSleepRemainingSec(null);
                        setSleepShowNotice(false);
                        setShowSleepMenu(false);
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <TimerOff className="w-3.5 h-3.5" />
                      خاموش کردن تایمر
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* اعمال پیش‌فرض تایمر از تنظیمات ذخیره‌شده */}
            {/* کلید قطع / وصل صدا */}
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
              title={isMuted ? 'صدا وصل' : 'بی‌صدا'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* بستن پلیر */}
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                }
                setIsPlaying(false);
                onClose();
              }}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600"
              title="بستن پلیر"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* المنت HTML5 Audio */}
        <audio
          ref={audioRef}
          onEnded={handleAudioEnded}
          onTimeUpdate={handleTimeUpdate}
          onError={handleAudioError}
          className="hidden"
        />
        <audio
          ref={preloadAudioRef}
          preload="auto"
          className="hidden"
        />
      </div>

      {/* مودال مشخصات و تغییر قاری (در پاسخ به کلیک روی عکس قاری) */}
      {showReciterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowReciterModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-3xl p-5 shadow-2xl border transition-all ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-stone-200 text-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* سربرگ مودال قاری */}
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">قاری مصحف شریف</h3>
                  <p className="text-xs text-slate-400">اطلاعات قاری و انتخاب صوت مورد نظر</p>
                </div>
              </div>
              <button
                onClick={() => setShowReciterModal(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* کارت قاری فعال کنونی */}
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-600/30 mb-4 flex items-start gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm border-2 border-teal-600 shrink-0 shadow ${currentReciter.avatarColor}`}>
                {currentReciter.initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-teal-700 dark:text-teal-300">
                    {currentReciter.name}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-600 text-white font-medium">
                    قاری فعال
                  </span>
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                  {currentReciter.subname}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  {currentReciter.bio}
                </p>
                <div className="text-[10px] text-slate-400 mt-2 leading-relaxed border-t border-stone-100 dark:border-slate-800 pt-2">
                  منبع صوت: {currentAudioSource.name}
                </div>
              </div>
            </div>

            {/* لیست سایر قاریان جهت تغییر سریع */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                تغییر به سایر قاریان:
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {RECITERS.map((r) => {
                  const isSelected = r.id === selectedReciterId;
// هشدار تایمر خواب پس از اتمام: خودکار پنهان شود
  useEffect(() => {
    if (!sleepShowNotice) return;
    const t = window.setTimeout(() => setSleepShowNotice(false), 4000);
    return () => window.clearTimeout(t);
  }, [sleepShowNotice]);

  // اعمال پیش‌فرض تایمر خواب از تنظیمات ذخیره‌شده
  useEffect(() => {
    const prefs = loadSleepTimerPrefs();
    if (prefs) {
      setSleepTimer(prefs);
      if (prefs.mode === 'time') setSleepRemainingSec(prefs.value * 60);
    }
  }, []);

  // ذخیرهٔ انتخاب تایمر خواب
  useEffect(() => {
    if (sleepTimer) {
      saveSleepTimerPrefs(sleepTimer);
    }
  }, [sleepTimer]);

  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedReciterId(r.id);
                        setShowReciterModal(false);
                      }}
                      className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-600 bg-teal-600 text-white font-bold shadow-md'
                          : darkMode
                          ? 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-200'
                          : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border shrink-0 ${r.avatarColor}`}>
                          {r.initials}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{r.name}</div>
                          <div className={`text-[11px] ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                            {r.subname}
                          </div>
                        </div>
                      </div>
                      {isSelected ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-xs opacity-60">انتخاب</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
