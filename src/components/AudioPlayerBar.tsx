import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  User,
  Repeat,
  Info,
  Check,
  Timer,
  TimerOff,
  ListMusic,
  SlidersHorizontal,
  Search,
} from 'lucide-react';
import { Verse, Surah } from '../types';
import {
  ReciterId,
  getSourcesForReciter,
  getAudioSourceUrl,
  resolveAudioSource,
  getWorkingSourceIndex,
  setWorkingSourceIndex,
  getProxiedAudioUrl,
} from '../services/audioSources';
import {
  saveAudioResumePosition,
  loadAudioResumePosition,
  clearAudioResumePosition,
  loadSleepTimerPrefs,
  saveSleepTimerPrefs,
  formatSleepTimeRemaining,
} from '../services/audioPlaybackPrefs';
import {
  logAudioError,
  classifyAudioError,
  describeAudioError,
} from '../services/audioErrorLog';

interface AudioPlayerBarProps {
  currentSurah: Surah;
  verses: Verse[];
  activeVerseNumber: number | null;
  onSelectVerseToPlay: (verseNumber: number) => void;
  onClose: () => void;
  darkMode: boolean;
  onAutoAdvanceToNextSurah?: () => void;
  onJumpToSurah?: (surahId: number) => void;
  allSurahs?: { id: number; nameArabic: string; namePersian?: string; versesCount?: number }[];
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

const SPEEDS = [0.75, 1, 1.25, 1.5];

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
  const [audioProgress, setAudioProgress] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState(() => getWorkingSourceIndex('parhizgar'));
  const [useProxyFallback, setUseProxyFallback] = useState(false);

  // مودال‌ها و کشوهای دسته‌بندی‌شده
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showQueueMenu, setShowQueueMenu] = useState(false);
  const [queueSearchQuery, setQueueSearchQuery] = useState('');

  // حالت تکرار آیه
  const [repeatTarget, setRepeatTarget] = useState<number>(1);
  const [currentRepeatIndex, setCurrentRepeatIndex] = useState<number>(1);

  // تایمر خواب
  const [sleepTimer, setSleepTimer] = useState<{ mode: 'time' | 'verses'; value: number } | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const [sleepShowNotice, setSleepShowNotice] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const activeBlobUrlRef = useRef<string | null>(null);
  const currentRawUrlRef = useRef<string | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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

  // هشدار تایمر خواب پس از اتمام: خودکار پنهان شود
  useEffect(() => {
    if (!sleepShowNotice) return;
    const t = window.setTimeout(() => setSleepShowNotice(false), 4000);
    return () => window.clearTimeout(t);
  }, [sleepShowNotice]);

  // تایمر خواب بر حسب زمان
  useEffect(() => {
    if (!sleepTimer || sleepTimer.mode !== 'time') return;
    if (sleepRemainingSec === null || sleepRemainingSec <= 0) return;
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (audioRef.current) audioRef.current.pause();
          setIsPlaying(false);
          setSleepTimer(null);
          setSleepShowNotice(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sleepTimer, sleepRemainingSec, isPlaying]);

  const currentReciter = RECITERS.find((r) => r.id === selectedReciterId) || RECITERS[0];
  const currentPlayingVerseNumber = activeVerseNumber || (verses.length > 0 ? verses[0].verseNumber : 1);
  const currentSources = getSourcesForReciter(selectedReciterId);
  const currentAudioSource = currentSources[Math.min(sourceIndex, currentSources.length - 1)];

  // Media Session API — کنترل از قفل صفحه / اعلان
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `آیه ${currentPlayingVerseNumber} — ${currentSurah.namePersian || currentSurah.nameArabic}`,
      artist: currentReciter.name,
      album: 'قرآن مبین',
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevVerse());
    navigator.mediaSession.setActionHandler('nexttrack', () => handleNextVerse());
  }, [currentSurah.id, currentPlayingVerseNumber, currentReciter.name, isPlaying]);

  // ذخیره آخرین موقعیت پخش جهت بازیابی
  useEffect(() => {
    if (currentPlayingVerseNumber) {
      saveAudioResumePosition({
        surahId: currentSurah.id,
        verseNumber: currentPlayingVerseNumber,
        reciterId: selectedReciterId,
        playbackRate,
        updatedAt: Date.now(),
      });
    }
  }, [currentSurah.id, currentPlayingVerseNumber, selectedReciterId, playbackRate]);

  // تبدیل آدرس صوتی به URL قابل پخش (با کش آفلاین و پروکسی ضد فیلترینگ)
  const resolvePlayableUrl = async (rawUrl: string, useProxy: boolean): Promise<string> => {
    if (useProxy) {
      return getProxiedAudioUrl(rawUrl);
    }
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
      // کش در دسترس نیست
    }
    return rawUrl;
  };

  // بارگذاری فایل صوتی هنگام تغییر آیه، قاری یا سورس
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

    currentRawUrlRef.current = resolved.url;

    if (resolved.sourceIndex !== sourceIndex) {
      setSourceIndex(resolved.sourceIndex);
      setWorkingSourceIndex(selectedReciterId, resolved.sourceIndex);
    }

    resolvePlayableUrl(resolved.url, useProxyFallback).then((playableUrl) => {
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

    // پیش‌بارگذاری هوشمند آیه بعدی جهت پخش پیوسته
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
        resolvePlayableUrl(nextResolved.url, useProxyFallback).then((nextUrl) => {
          if (preloadAudioRef.current && !isCancelled) {
            preloadAudioRef.current.src = nextUrl;
            preloadAudioRef.current.load();
          }
        });
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [currentSurah.id, currentPlayingVerseNumber, selectedReciterId, sourceIndex, useProxyFallback]);

  // اعمال سرعت پخش
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
      if (onAutoAdvanceToNextSurah) {
        setCurrentRepeatIndex(1);
        setPlaybackError(null);
        onAutoAdvanceToNextSurah();
      } else {
        setCurrentRepeatIndex(1);
        setPlaybackError('پایان آیات این سوره.');
      }
    }
  };

  const handlePrevVerse = () => {
    const currentIndex = verses.findIndex((v) => v.verseNumber === currentPlayingVerseNumber);
    if (currentIndex > 0) {
      setCurrentRepeatIndex(1);
      setPlaybackError(null);
      onSelectVerseToPlay(verses[currentIndex - 1].verseNumber);
    }
  };

  const handleAudioEnded = () => {
    if (repeatTarget > 1) {
      if (repeatTarget >= 999 || currentRepeatIndex < repeatTarget) {
        setCurrentRepeatIndex((prev) => prev + 1);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        return;
      }
    }

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

    setCurrentRepeatIndex(1);
    handleNextVerse();
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  // مدیریت خطای پخش و فال‌بک خودکار به پروکسی سرور برای دور زدن فیلترینگ
  const handleAudioError = () => {
    if (!useProxyFallback && currentRawUrlRef.current) {
      // تلاش مجدد با پروکسی داخلی سرور برای کاربران ایران
      setUseProxyFallback(true);
      return;
    }

    const sources = getSourcesForReciter(selectedReciterId);
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((prev) => prev + 1);
      setWorkingSourceIndex(selectedReciterId, sourceIndex + 1);
      setUseProxyFallback(false);
      return;
    }

    const mediaCode = audioRef.current?.error ? (audioRef.current.error as MediaError).code : null;
    const kind = classifyAudioError(mediaCode, navigator.onLine);
    const currentSource = sources[Math.min(sourceIndex, sources.length - 1)];
    const url = getAudioSourceUrl(
      selectedReciterId,
      currentSurah.id,
      currentPlayingVerseNumber,
      Math.min(sourceIndex, sources.length - 1)
    );

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

    setIsPlaying(false);
    setPlaybackError('خطا در پخش صوت؛ در حال تلاش با پروکسی سرور...');
  };

  // فیلتر کردن لیست سوره‌ها در صف پخش
  const filteredSurahs = (allSurahs || []).filter((s) => {
    if (!queueSearchQuery.trim()) return true;
    const q = queueSearchQuery.trim().toLowerCase();
    return (
      s.nameArabic.toLowerCase().includes(q) ||
      (s.namePersian && s.namePersian.toLowerCase().includes(q)) ||
      String(s.id).includes(q)
    );
  });

  const hasActiveOptionsBadge = repeatTarget > 1 || sleepTimer !== null || playbackRate !== 1;

  return (
    <>
      <div
        id="audio-player-bar-container"
        className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md transition-all select-none ${
          darkMode
            ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]'
            : 'bg-white/95 border-stone-200 text-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]'
        }`}
        dir="rtl"
      >
        {/* نوار پیشرفت باریک در بالای پلیر */}
        <div
          className="h-1 w-full bg-slate-200 dark:bg-slate-800 cursor-pointer overflow-hidden"
          onClick={(e) => {
            if (!audioRef.current || !audioRef.current.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const percent = 1 - clickX / width;
            audioRef.current.currentTime = percent * audioRef.current.duration;
          }}
        >
          <div
            className="h-full bg-gradient-to-l from-teal-500 to-amber-500 transition-all duration-150"
            style={{ width: `${audioProgress}%` }}
          />
        </div>

        {/* پیام خطای پخش در صورت بروز */}
        {playbackError && (
          <div className="px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs flex items-center justify-between gap-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-300">
            <span className="truncate">{playbackError}</span>
            <button
              onClick={() => {
                setPlaybackError(null);
                setUseProxyFallback(true);
                if (audioRef.current) audioRef.current.load();
              }}
              className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shrink-0 transition-colors"
            >
              تلاش با پروکسی
            </button>
          </div>
        )}

        {/* اعلان اتمام تایمر خواب */}
        {sleepShowNotice && (
          <div
            className={`px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs flex items-center justify-center gap-2 border-b ${
              darkMode
                ? 'bg-indigo-950/60 border-slate-800 text-indigo-200'
                : 'bg-indigo-50 border-stone-200 text-indigo-700'
            }`}
          >
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <span>تایمر خواب به پایان رسید و پخش متوقف شد.</span>
          </div>
        )}

        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
          {/* بخش راست: مشخصات قاری و آیه جاری */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setShowReciterModal(true)}
              className="relative group shrink-0"
              title={`قاری: ${currentReciter.name} (کلیک جهت مشاهده بیوگرافی یا تغییر)`}
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm border-2 border-teal-600 shadow-sm group-hover:scale-105 transition-all ${currentReciter.avatarColor}`}
              >
                {currentReciter.initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-teal-600 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-white text-[8px]">
                <Info className="w-2 h-2" />
              </span>
            </button>

            <div
              className="min-w-0 text-right cursor-pointer"
              onClick={() => setShowReciterModal(true)}
            >
              <div className="font-bold text-xs sm:text-sm truncate hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                سوره {currentSurah.nameArabic} : آیه {currentPlayingVerseNumber}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                <span className="truncate">{currentReciter.name}</span>
                {repeatTarget > 1 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-1 rounded">
                    تکرار {currentRepeatIndex}/{repeatTarget >= 999 ? '∞' : repeatTarget}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* بخش مرکز: دکمه‌های اصلی پخش (آیه قبل، پخش/مکث، آیه بعد) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={handlePrevVerse}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
              title="آیه قبلی"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

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

            <button
              onClick={handleNextVerse}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
              title="آیه بعدی"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* بخش چپ: دسته‌بندی دکمه‌ها (صف پخش، تنظیمات ترتیل، صدا، بستن) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* دکمه صف پخش (پلی‌لیست سوره‌ها) */}
            <button
              onClick={() => setShowQueueMenu(true)}
              className="relative p-1.5 sm:p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
              title="صف پخش سوره‌ها"
            >
              <ListMusic className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden md:inline mr-1 text-xs font-medium">صف پخش</span>
            </button>

            {/* دکمه دسته‌بندی‌شده تنظیمات ترتیل (تکرار + سرعت + تایمر خواب) */}
            <button
              onClick={() => setShowOptionsModal(true)}
              className={`relative flex items-center gap-1 p-1.5 sm:p-2 rounded-xl border transition-colors text-xs font-bold ${
                hasActiveOptionsBadge
                  ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
              }`}
              title="تنظیمات ترتیل (تکرار، سرعت و تایمر خواب)"
            >
              <SlidersHorizontal className="w-4 h-4 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">تنظیمات</span>
              {hasActiveOptionsBadge && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              )}
            </button>

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
                if (audioRef.current) audioRef.current.pause();
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

        {/* تگ‌های صوتی */}
        <audio
          ref={audioRef}
          onEnded={handleAudioEnded}
          onTimeUpdate={handleTimeUpdate}
          onError={handleAudioError}
          className="hidden"
        />
        <audio ref={preloadAudioRef} preload="auto" className="hidden" />
      </div>

      {/* ۱. کشوی / مودال صف پخش سوره‌ها (حل باگ نصفه دیده شدن و خروج از صفحه) */}
      {showQueueMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowQueueMenu(false)}
        >
          <div
            className={`w-full max-w-md rounded-3xl p-4 sm:p-5 shadow-2xl border transition-all max-h-[80vh] flex flex-col ${
              darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-stone-200 text-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* سربرگ کشوی صف پخش */}
            <div className="flex items-center justify-between border-b pb-3 mb-3 border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400">
                  <ListMusic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">صف پخش پیوسته سوره‌ها</h3>
                  <p className="text-xs text-slate-400">پس از اتمام هر سوره، سورهٔ بعد خودکار پخش می‌شود</p>
                </div>
              </div>
              <button
                onClick={() => setShowQueueMenu(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* نوار جستجوی سریع سوره در صف */}
            <div className="relative mb-3">
              <input
                type="text"
                value={queueSearchQuery}
                onChange={(e) => setQueueSearchQuery(e.target.value)}
                placeholder="جستجوی سوره در صف..."
                className={`w-full pr-9 pl-3 py-2 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-teal-500 ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-stone-50 border-stone-200'
                }`}
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            {/* لیست اسکرول‌خور سوره‌ها */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredSurahs.map((s) => {
                const isCurrent = s.id === currentSurah.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (!isCurrent && onJumpToSurah) {
                        onJumpToSurah(s.id);
                      }
                      setShowQueueMenu(false);
                    }}
                    className={`w-full text-right px-3 py-2.5 rounded-2xl flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-teal-600 text-white font-bold shadow-md'
                        : darkMode
                        ? 'hover:bg-slate-800 text-slate-200'
                        : 'hover:bg-stone-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isCurrent
                            ? 'bg-white/20 text-white'
                            : darkMode
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-stone-100 text-slate-500'
                        }`}
                      >
                        {s.id}
                      </span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold">{s.nameArabic}</div>
                        {s.namePersian && (
                          <div className={`text-[10px] ${isCurrent ? 'text-teal-100' : 'text-slate-400'}`}>
                            {s.namePersian} {s.versesCount ? `• ${s.versesCount} آیه` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-xs text-teal-100 bg-white/20 px-2 py-0.5 rounded-lg">
                        <Check className="w-3.5 h-3.5" />
                        در حال پخش
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ۲. کشوی / مودال دسته‌بندی‌شده تنظیمات ترتیل (تکرار، سرعت و تایمر خواب) */}
      {showOptionsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowOptionsModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-3xl p-5 shadow-2xl border transition-all ${
              darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-stone-200 text-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* سربرگ تنظیمات */}
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">تنظیمات ترتیل صوتی</h3>
                  <p className="text-xs text-slate-400">کنترل تکرار آیات، سرعت پخش و تایمر خواب</p>
                </div>
              </div>
              <button
                onClick={() => setShowOptionsModal(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* بخش ۱: تکرار هر آیه */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Repeat className="w-4 h-4 text-amber-500" />
                    <span>تکرار هر آیه (ویژه حفظ و تثبیت)</span>
                  </div>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                    {repeatTarget >= 999 ? 'پیوسته' : `${repeatTarget} بار`}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {REPEAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setRepeatTarget(opt.value);
                        setCurrentRepeatIndex(1);
                      }}
                      className={`py-1.5 text-xs rounded-xl font-bold transition-all text-center ${
                        repeatTarget === opt.value
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* بخش ۲: سرعت ترتیل */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    سرعت پخش صوت
                  </span>
                  <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">
                    {playbackRate} برابر
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {SPEEDS.map((sp) => (
                    <button
                      key={sp}
                      onClick={() => {
                        setPlaybackRate(sp);
                        if (audioRef.current) audioRef.current.playbackRate = sp;
                      }}
                      className={`py-1.5 text-xs rounded-xl font-bold transition-all ${
                        playbackRate === sp
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>

              {/* بخش ۳: تایمر خواب */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Timer className="w-4 h-4 text-indigo-500" />
                    <span>تایمر خواب (توقف خودکار)</span>
                  </div>
                  {sleepTimer && (
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                      {sleepTimer.mode === 'time'
                        ? sleepRemainingSec !== null
                          ? formatSleepTimeRemaining(sleepRemainingSec)
                          : `${sleepTimer.value} دقیقه`
                        : `${sleepTimer.value} آیه`}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400">توقف بر حسب زمان:</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[10, 15, 30, 45].map((min) => (
                      <button
                        key={min}
                        onClick={() => {
                          setSleepTimer({ mode: 'time', value: min });
                          setSleepRemainingSec(min * 60);
                          setSleepShowNotice(false);
                        }}
                        className={`py-1.5 text-xs rounded-xl font-bold transition-all ${
                          sleepTimer?.mode === 'time' && sleepTimer.value === min
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {min} دقیقه
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-400 pt-1">یا بر حسب تعداد آیه:</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[5, 10, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setSleepTimer({ mode: 'verses', value: n });
                          setSleepShowNotice(false);
                        }}
                        className={`py-1.5 text-xs rounded-xl font-bold transition-all ${
                          sleepTimer?.mode === 'verses' && sleepTimer.value === n
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700'
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
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                    >
                      <TimerOff className="w-3.5 h-3.5" />
                      خاموش کردن تایمر خواب
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ۳. مودال مشخصات و تغییر قاری (رفع کامل باگ صفحه خالی و سیاه) */}
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
                  <h3 className="font-bold text-base">قاریان مصحف شریف</h3>
                  <p className="text-xs text-slate-400">مشاهده مشخصات و انتخاب صوت دلخواه</p>
                </div>
              </div>
              <button
                onClick={() => setShowReciterModal(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* کارت قاری فعال کنونی با بیوگرافی و منبع صوت */}
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-600/30 mb-4 flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm border-2 border-teal-600 shrink-0 shadow ${currentReciter.avatarColor}`}
              >
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
                <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-stone-100 dark:border-slate-800">
                  منبع صوتی: {currentAudioSource.name}
                </div>
              </div>
            </div>

            {/* لیست قاریان جهت تغییر سریع */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                انتخاب قاری دیگر:
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {RECITERS.map((r) => {
                  const isSelected = r.id === selectedReciterId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedReciterId(r.id);
                        setSourceIndex(getWorkingSourceIndex(r.id));
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
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border shrink-0 ${r.avatarColor}`}
                        >
                          {r.initials}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{r.name}</div>
                          <div
                            className={`text-[11px] ${
                              isSelected ? 'text-teal-100' : 'text-slate-400'
                            }`}
                          >
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
