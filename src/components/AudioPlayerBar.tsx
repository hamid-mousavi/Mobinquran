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
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Verse, Surah } from '../types';
import {
  ReciterId,
  getSourcesForReciter,
  getAudioSourceUrl,
  resolveAudioSource,
  getWorkingSourceIndex,
  setWorkingSourceIndex,
  RECITER_NAMES,
} from '../services/audioSources';
import {
  getCachedAudioBlobUrl,
  getAnyCachedAudioBlobUrl,
  getDownloadedReciterForSurah,
} from '../services/audioCacheService';
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
import { toPersianDigits } from '../utils/textNormalization';

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
  hasBottomNav?: boolean;
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
    name: 'شیخ مشاری بن راشد العفاسی',
    subname: 'ترتیل استودیویی مدرن',
    bio: 'امام جماعت مسجد کبیر کویت و قاری سرشناس معاصر با ضبط‌های صوتی دیجیتال باکیفیت و صوت رسا.',
    initials: 'م‌ع',
    avatarColor: 'bg-teal-700 text-white',
  },
  {
    id: 'husary',
    name: 'شیخ محمود خلیل الحصری',
    subname: 'شیخ القراء و مرجع تجوید جهان اسلام',
    bio: 'بزرگ‌ترین استاد تجوید و ترتیل جهان اسلام از مصر؛ نخستین قاری که قرآن کامل را به سبک ترتیل آموزشی ضبط و در سراسر جهان منتشر نمود.',
    initials: 'م‌ح',
    avatarColor: 'bg-emerald-800 text-white',
  },
  {
    id: 'ghamadi',
    name: 'شیخ سعد الغامدی',
    subname: 'ترتیل روان، دلنشین و آرامش‌بخش',
    bio: 'امام و خطیب مشهور با تلاوتی زلال و آرامش‌بخش؛ از محبوب‌ترین ترتیل‌ها در میان جوانان و خانواده‌ها.',
    initials: 'س‌غ',
    avatarColor: 'bg-cyan-700 text-white',
  },
  {
    id: 'muaiqly',
    name: 'شیخ ماهر المعیقلی',
    subname: 'امام مسجدالحرام و لحن حزین',
    bio: 'امام و خطیب سرشناس حرم امن الهی در مکه مکرمه با صوتی دلنشین، خاشع و طنین‌انداز در نمازهای تراویح و جماعت.',
    initials: 'م‌م',
    avatarColor: 'bg-purple-700 text-white',
  },
  {
    id: 'shatri',
    name: 'شیخ ابوبکر الشاطری',
    subname: 'ترتیل خاشع و پرجاذبه',
    bio: 'قاری ممتاز از جده عربستان با لحن ویژهٔ بم، اثرگذار و خاشعانه که معانی آیات را در دل مستمع زنده می‌کند.',
    initials: 'ا‌ش',
    avatarColor: 'bg-indigo-700 text-white',
  },
  {
    id: 'hudhaify',
    name: 'شیخ علی بن عبدالرحمن الحذیفی',
    subname: 'امام مسجد النبی (ترتیل شمرده و مسجدی)',
    bio: 'امام جماعت باسابقه مسجد مطهر نبوی در مدینه منوره؛ تلاوت آرام، دقیق و شمرده مناسب حفظ و روان‌خوانی.',
    initials: 'ع‌ح',
    avatarColor: 'bg-slate-700 text-white',
  },
  {
    id: 'sudais',
    name: 'شیخ عبدالرحمن السدیس',
    subname: 'امام مسجد الحرام و ترتیل پرشور',
    bio: 'رئیس کل امور مسجدالحرام و مسجدالنبی و نام‌آشناترین صدای نمازهای مکه مکرمه با لحنی حماسی و پرحرارت.',
    initials: 'ع‌س',
    avatarColor: 'bg-rose-700 text-white',
  },
  {
    id: 'shuraim',
    name: 'شیخ سعود الشریم',
    subname: 'ترتیل ماندگار و لحن اصیل حجازی',
    bio: 'امام و خطیب پیشین مسجدالحرام با بیش از ۳۰ سال امامت و ترتیلی تند، روان و لحن ماندگار حجازی.',
    initials: 'س‌ش',
    avatarColor: 'bg-violet-700 text-white',
  },
  {
    id: 'mustafa_ismail',
    name: 'استاد مصطفی اسماعیل',
    subname: 'اکبر القراء مصر و الحان ملکوتی',
    bio: 'قاری اسطوره‌ای و نابغهٔ مقامات صوتی جهان اسلام؛ ترتیلی نادر و سرشار از معنویت و وقار قرآنی.',
    initials: 'م‌ا',
    avatarColor: 'bg-amber-800 text-white',
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
  hasBottomNav = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedReciterId, setSelectedReciterId] = useState<ReciterId>(() => {
    try {
      const saved = localStorage.getItem('mobin_selected_reciter') ||
                    localStorage.getItem('quran_reciter') ||
                    loadAudioResumePosition()?.reciterId;
      if (saved && RECITERS.some((r) => r.id === saved)) {
        return saved as ReciterId;
      }
    } catch (e) {
      // ignore
    }
    return 'parhizgar';
  });
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioProgress, setAudioProgress] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('mobin_selected_reciter') ||
                    localStorage.getItem('quran_reciter') ||
                    loadAudioResumePosition()?.reciterId;
      if (saved && RECITERS.some((r) => r.id === saved)) {
        return getWorkingSourceIndex(saved as ReciterId);
      }
    } catch (e) {
      // ignore
    }
    return getWorkingSourceIndex('parhizgar');
  });

  // تضمین ماندگاری انتخاب قاری در حافظه دائمی مرورگر
  useEffect(() => {
    try {
      localStorage.setItem('mobin_selected_reciter', selectedReciterId);
      localStorage.setItem('quran_reciter', selectedReciterId);
    } catch (e) {
      // ignore
    }
  }, [selectedReciterId]);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // مودال‌ها و کشوهای دسته‌بندی‌شده
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [reciterSearchQuery, setReciterSearchQuery] = useState('');
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

  // تبدیل آدرس صوتی به URL قابل پخش با اولویت قطعی کش آفلاین
  const resolvePlayableUrl = async (
    reciterId: ReciterId,
    surahId: number,
    verseNumber: number,
    targetSourceIndex: number
  ): Promise<{ url: string; isOffline: boolean; sourceIndex: number; reciterId: ReciterId }> => {
    // ۱. بررسی فوری کش آفلاین برای قاری انتخابی (تمام سورس‌ها)
    const cached = await getCachedAudioBlobUrl(reciterId, surahId, verseNumber);
    if (cached) {
      return { url: cached.blobUrl, isOffline: true, sourceIndex: cached.sourceIndex, reciterId: cached.reciterId };
    }

    // ۲. بررسی کش آفلاین برای هر قاری دیگری که این سوره را دارد (چه آنلاین و چه آفلاین!)
    const anyCached = await getAnyCachedAudioBlobUrl(surahId, verseNumber);
    if (anyCached) {
      if (anyCached.reciterId !== reciterId) {
        setSelectedReciterId(anyCached.reciterId);
      }
      return { url: anyCached.blobUrl, isOffline: true, sourceIndex: anyCached.sourceIndex, reciterId: anyCached.reciterId };
    }

    // ۳. در صورت قطع ارتباط شبکه، اعلام عدم وجود فایل آفلاین
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      return { url: '', isOffline: true, sourceIndex: targetSourceIndex, reciterId };
    }

    // ۴. در صورت آنلاین بودن، استفاده از آدرس مستقیم سرور
    const resolved = resolveAudioSource(reciterId, surahId, verseNumber, targetSourceIndex);
    return {
      url: resolved?.url || '',
      isOffline: false,
      sourceIndex: resolved?.sourceIndex ?? targetSourceIndex,
      reciterId,
    };
  };

  // بارگذاری فایل صوتی هنگام تغییر آیه، قاری یا سوره
  useEffect(() => {
    let isCancelled = false;
    setPlaybackError(null);
    setIsLoadingAudio(true);

    resolvePlayableUrl(
      selectedReciterId,
      currentSurah.id,
      currentPlayingVerseNumber,
      sourceIndex
    ).then(({ url: playableUrl, sourceIndex: matchedIndex }) => {
      if (isCancelled || !audioRef.current) return;

      if (!playableUrl) {
        setIsPlaying(false);
        setIsLoadingAudio(false);
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (!isOnline) {
          setPlaybackError(`صوت آیه ${toPersianDigits(currentPlayingVerseNumber)} در حافظه آفلاین موجود نیست؛ لطفاً سوره را از بخش دانلودها دریافت کنید.`);
        } else {
          setPlaybackError(`فایل صوتی آیه ${toPersianDigits(currentPlayingVerseNumber)} برای این قاری یافت نشد.`);
        }
        return;
      }

      currentRawUrlRef.current = playableUrl;

      if (matchedIndex !== sourceIndex) {
        setWorkingSourceIndex(selectedReciterId, matchedIndex);
      }

      const oldBlob = activeBlobUrlRef.current;
      if (playableUrl.startsWith('blob:')) {
        activeBlobUrlRef.current = playableUrl;
      } else {
        activeBlobUrlRef.current = null;
      }

      audioRef.current.src = playableUrl;
      audioRef.current.playbackRate = playbackRate;

      // رهاسازی با تاخیر آدرس قبلی جهت جلوگیری از خطای ناگهانی پخش
      if (oldBlob && oldBlob !== playableUrl) {
        setTimeout(() => URL.revokeObjectURL(oldBlob), 2500);
      }

      if (isPlayingRef.current) {
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => {
            if (isCancelled) return;
            setIsPlaying(true);
            setIsLoadingAudio(false);
            setPlaybackError(null);
          }).catch((err) => {
            if (err?.name === 'AbortError') return;
            console.warn('Audio playback error:', err);
            setIsLoadingAudio(false);
            if (audioRef.current?.error) {
              handleAudioError();
            }
          });
        }
      } else {
        setIsLoadingAudio(false);
      }
    });

    // پیش‌بارگذاری هوشمند آیه بعدی جهت پخش پیوسته
    const nextVerseNum = currentPlayingVerseNumber + 1;
    const hasNext = verses.some((v) => v.verseNumber === nextVerseNum) || nextVerseNum <= currentSurah.versesCount;
    if (hasNext && preloadAudioRef.current) {
      resolvePlayableUrl(
        selectedReciterId,
        currentSurah.id,
        nextVerseNum,
        sourceIndex
      ).then(({ url: nextUrl }) => {
        if (preloadAudioRef.current && !isCancelled && nextUrl && !nextUrl.startsWith('blob:')) {
          preloadAudioRef.current.src = nextUrl;
          preloadAudioRef.current.load();
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [currentSurah.id, currentPlayingVerseNumber, selectedReciterId]);

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
      setIsLoadingAudio(false);
    } else {
      setPlaybackError(null);
      setIsLoadingAudio(true);
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
          setIsLoadingAudio(false);
        }).catch((err) => {
          if (err?.name === 'AbortError') return;
          console.warn('Audio playback error:', err);
          setIsPlaying(false);
          setIsLoadingAudio(false);
          handleAudioError();
        });
      } else {
        setIsPlaying(true);
        setIsLoadingAudio(false);
      }
    }
  };

  const handleNextVerse = () => {
    const currentIndex = verses.findIndex((v) => v.verseNumber === currentPlayingVerseNumber);
    if (currentIndex !== -1 && currentIndex < verses.length - 1) {
      setCurrentRepeatIndex(1);
      setPlaybackError(null);
      setIsLoadingAudio(true);
      onSelectVerseToPlay(verses[currentIndex + 1].verseNumber);
    } else if (currentIndex !== -1 && currentIndex === verses.length - 1) {
      if (onAutoAdvanceToNextSurah) {
        setCurrentRepeatIndex(1);
        setPlaybackError(null);
        setIsLoadingAudio(true);
        onAutoAdvanceToNextSurah();
      } else {
        setCurrentRepeatIndex(1);
        setIsLoadingAudio(false);
        setPlaybackError('پایان آیات این سوره.');
      }
    } else {
      // پشتیبانی در صورت عدم تطابق موقت آرایه verses با سوره جاری
      const nextNum = currentPlayingVerseNumber + 1;
      if (nextNum <= currentSurah.versesCount) {
        setCurrentRepeatIndex(1);
        setPlaybackError(null);
        setIsLoadingAudio(true);
        onSelectVerseToPlay(nextNum);
      } else if (onAutoAdvanceToNextSurah) {
        setCurrentRepeatIndex(1);
        setPlaybackError(null);
        setIsLoadingAudio(true);
        onAutoAdvanceToNextSurah();
      }
    }
  };

  const handlePrevVerse = () => {
    const currentIndex = verses.findIndex((v) => v.verseNumber === currentPlayingVerseNumber);
    if (currentIndex > 0) {
      setCurrentRepeatIndex(1);
      setPlaybackError(null);
      setIsLoadingAudio(true);
      onSelectVerseToPlay(verses[currentIndex - 1].verseNumber);
    }
  };

  const handleAudioEnded = () => {
    if (repeatTarget > 1) {
      if (repeatTarget >= 999 || currentRepeatIndex < repeatTarget) {
        setCurrentRepeatIndex((prev) => prev + 1);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          setIsLoadingAudio(true);
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
        setIsLoadingAudio(false);
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

  // مدیریت خطای پخش با اولویت قطعی کش آفلاین و چرخش بین سرورها
  const handleAudioError = async () => {
    setIsLoadingAudio(false);

    // ۱. بررسی فوری مجدد کش آفلاین برای قاری جاری
    const cached = await getCachedAudioBlobUrl(selectedReciterId, currentSurah.id, currentPlayingVerseNumber);
    if (cached && audioRef.current) {
      const oldBlob = activeBlobUrlRef.current;
      activeBlobUrlRef.current = cached.blobUrl;
      audioRef.current.src = cached.blobUrl;
      if (oldBlob && oldBlob !== cached.blobUrl) {
        setTimeout(() => URL.revokeObjectURL(oldBlob), 2500);
      }
      setWorkingSourceIndex(selectedReciterId, cached.sourceIndex);
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setPlaybackError(null);
      }).catch(() => {});
      return;
    }

    // ۲. بررسی کش آفلاین برای هر قاری دیگری که این سوره را دارد (چه آنلاین و چه آفلاین!)
    const anyCached = await getAnyCachedAudioBlobUrl(currentSurah.id, currentPlayingVerseNumber);
    if (anyCached && audioRef.current) {
      setSelectedReciterId(anyCached.reciterId);
      const oldBlob = activeBlobUrlRef.current;
      activeBlobUrlRef.current = anyCached.blobUrl;
      audioRef.current.src = anyCached.blobUrl;
      if (oldBlob && oldBlob !== anyCached.blobUrl) {
        setTimeout(() => URL.revokeObjectURL(oldBlob), 2500);
      }
      setWorkingSourceIndex(anyCached.reciterId, anyCached.sourceIndex);
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setPlaybackError(null);
      }).catch(() => {});
      return;
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      setIsPlaying(false);
      setPlaybackError(`ارتباط اینترنت قطع است و فایل آفلاین آیه ${toPersianDigits(currentPlayingVerseNumber)} یافت نشد. لطفاً سوره را از بخش دانلودها دریافت کنید.`);
      return;
    }

    const sources = getSourcesForReciter(selectedReciterId);
    if (sourceIndex < sources.length - 1) {
      const nextSourceIdx = sourceIndex + 1;
      setSourceIndex(nextSourceIdx);
      setWorkingSourceIndex(selectedReciterId, nextSourceIdx);
      setPlaybackError(`خطا در منبع فعلی؛ در حال امتحان سرور جایگزین (${sources[nextSourceIdx].name})...`);
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
    setPlaybackError(`خطا در پخش صوت آیه ${toPersianDigits(currentPlayingVerseNumber)}؛ لطفاً اتصال اینترنت را بررسی یا تلاش مجدد را بزنید.`);
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
        className={`fixed left-0 right-0 z-40 border-t backdrop-blur-md transition-all select-none ${
          hasBottomNav ? 'bottom-[60px]' : 'bottom-0'
        } ${
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

        {/* پیام خطای پخش در صورت بروز با راهنمای شفاف و دکمه‌های کنشی */}
        {playbackError && (
          <div className="px-3 sm:px-4 py-2 text-[11px] sm:text-xs flex items-center justify-between gap-2 bg-rose-500/15 border-b border-rose-500/30 text-rose-700 dark:text-rose-300 animate-fadeIn">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="truncate font-medium">{playbackError}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setPlaybackError(null);
                  setSourceIndex(0);
                  setIsLoadingAudio(true);
                  if (audioRef.current) {
                    audioRef.current.load();
                    audioRef.current.play().then(() => {
                      setIsPlaying(true);
                      setIsLoadingAudio(false);
                    }).catch(() => {
                      setIsLoadingAudio(false);
                    });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
              >
                تلاش مجدد
              </button>
              <button
                onClick={handleNextVerse}
                className="px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 text-slate-700 dark:text-slate-200 text-[10px] font-bold transition-colors cursor-pointer"
                title="رفتن به آیه بعدی"
              >
                آیه بعد
              </button>
              <button
                onClick={() => setPlaybackError(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="بستن پیام"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
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
                سوره {currentSurah.nameArabic} : آیه {toPersianDigits(currentPlayingVerseNumber)}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                <span className="truncate">{currentReciter.name}</span>
                {repeatTarget > 1 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-1 rounded">
                    تکرار {toPersianDigits(currentRepeatIndex)}/{repeatTarget >= 999 ? '∞' : toPersianDigits(repeatTarget)}
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
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg hover:shadow-teal-500/20 transition-all active:scale-95 cursor-pointer"
              title={isLoadingAudio ? 'در حال بارگذاری صوت...' : isPlaying ? 'توقف' : 'پخش ترتیل'}
            >
              {isLoadingAudio ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
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
          onWaiting={() => setIsLoadingAudio(true)}
          onLoadStart={() => setIsLoadingAudio(true)}
          onCanPlay={() => setIsLoadingAudio(false)}
          onPlaying={() => {
            setIsLoadingAudio(false);
            setIsPlaying(true);
          }}
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

      {/* ۳. مودال مشخصات و تغییر قاری (بسیار بزرگ، جادار، مدرن و با جستجوی هوشمند) */}
      {showReciterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowReciterModal(false)}
        >
          <div
            className={`w-full max-w-4xl rounded-3xl p-5 sm:p-7 shadow-2xl border transition-all max-h-[92vh] sm:max-h-[88vh] flex flex-col ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-stone-200 text-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* سربرگ بزرگ مودال قاری */}
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-stone-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400">
                  <User className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100">
                    انتخاب قاری مصحف شریف
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-400 mt-0.5">
                    مجموعهٔ فاخر قاریان جهان اسلام با ترتیل‌های دقیق آموزشی، مجلسی، استودیویی و خاشعانه
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReciterModal(false)}
                className="p-2 sm:p-2.5 rounded-2xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="بستن"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* فیلد جستجوی سریع قاری */}
            <div className="mb-4 shrink-0">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute right-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={reciterSearchQuery}
                  onChange={(e) => setReciterSearchQuery(e.target.value)}
                  placeholder="جستجوی نام قاری یا سبک تلاوت (مثلاً: پرهیزگار، عبدالباسط، آموزشی، حزین...)"
                  className="w-full pl-3 pr-11 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm bg-stone-50 dark:bg-slate-800/80 border border-stone-200 dark:border-slate-700 focus:outline-hidden focus:border-teal-500 text-slate-800 dark:text-slate-100 shadow-2xs"
                />
                {reciterSearchQuery && (
                  <button
                    onClick={() => setReciterSearchQuery('')}
                    className="absolute left-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* لیست شبکه‌ای بزرگ قاریان جهت انتخاب با ذخیره‌سازی دائمی */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {RECITERS.filter((r) => {
                  if (!reciterSearchQuery.trim()) return true;
                  const q = reciterSearchQuery.trim().toLowerCase();
                  return (
                    r.name.toLowerCase().includes(q) ||
                    r.subname.toLowerCase().includes(q) ||
                    r.bio.toLowerCase().includes(q)
                  );
                }).map((r) => {
                  const isSelected = r.id === selectedReciterId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedReciterId(r.id);
                        setSourceIndex(getWorkingSourceIndex(r.id));
                        try {
                          localStorage.setItem('mobin_selected_reciter', r.id);
                          localStorage.setItem('quran_reciter', r.id);
                          window.dispatchEvent(new CustomEvent('mobin-reciter-changed', { detail: r.id }));
                        } catch (e) {
                          // ignore
                        }
                        setShowReciterModal(false);
                      }}
                      className={`p-4 sm:p-5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 group cursor-pointer ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/50 ring-2 ring-teal-500/50 text-slate-900 dark:text-slate-100 shadow-md'
                          : darkMode
                          ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700 text-slate-200'
                          : 'border-stone-200 bg-white hover:bg-stone-50 hover:border-teal-400 text-slate-800 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border-2 shrink-0 shadow-sm ${r.avatarColor}`}
                          >
                            {r.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                              {r.name}
                            </div>
                            <div
                              className={`text-xs truncate mt-0.5 ${
                                isSelected ? 'text-teal-700 dark:text-teal-300 font-semibold' : 'text-slate-400'
                              }`}
                            >
                              {r.subname}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="px-2.5 py-1 rounded-full bg-teal-600 text-white flex items-center gap-1 text-[11px] font-bold shrink-0 shadow-xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>انتخاب‌شده</span>
                          </div>
                        ) : (
                          <span className="text-xs text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0">
                            انتخاب ↵
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                        {r.bio}
                      </p>
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
