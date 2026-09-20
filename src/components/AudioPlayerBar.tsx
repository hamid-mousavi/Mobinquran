import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, User, Repeat, Info, Check } from 'lucide-react';
import { Verse, Surah } from '../types';

interface AudioPlayerBarProps {
  currentSurah: Surah;
  verses: Verse[];
  activeVerseNumber: number | null;
  onSelectVerseToPlay: (verseNumber: number) => void;
  onClose: () => void;
  darkMode: boolean;
}

export type ReciterId = 'parhizgar' | 'abdulbasit' | 'minshawi' | 'afasy';

interface Reciter {
  id: ReciterId;
  name: string;
  subname: string;
  bio: string;
  initials: string;
  avatarColor: string;
  photoUrl: string;
  getUrl: (surahId: number, verseNumber: number) => string;
}

const RECITERS: Reciter[] = [
  {
    id: 'parhizgar',
    name: 'استاد شهریار پرهیزگار',
    subname: 'ترتیل آموزشی و تجوید دقیق',
    bio: 'قاری بین‌المللی و حافظ کل قرآن کریم از ایران؛ دارنده رتبه اول مسابقات جهانی و استانداردترین دوره ترتیل آموزشی جهت یادگیری روخوانی و حفظ.',
    initials: 'ش‌پ',
    avatarColor: 'bg-emerald-700 text-white',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face',
    getUrl: (s, v) => {
      const sPad = String(s).padStart(3, '0');
      const vPad = String(v).padStart(3, '0');
      return `https://everyayah.com/data/Parhizgar_48kbps/${sPad}${vPad}.mp3`;
    },
  },
  {
    id: 'abdulbasit',
    name: 'استاد عبدالباسط عبدالصمد',
    subname: 'ترتیل مجلسی و لحن حزین',
    bio: 'ملقب به «صوت مکه»؛ یکی از بزرگ‌ترین و نامدارترین قاریان تاریخ جهان اسلام از مصر با لحنی دلنشین، عمیق و پرصلابت.',
    initials: 'ع‌ب',
    avatarColor: 'bg-amber-700 text-white',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face',
    getUrl: (s, v) => {
      const sPad = String(s).padStart(3, '0');
      const vPad = String(v).padStart(3, '0');
      return `https://everyayah.com/data/Abdul_Basit_Murattal_64kbps/${sPad}${vPad}.mp3`;
    },
  },
  {
    id: 'minshawi',
    name: 'استاد محمدصدیق منشاوی',
    subname: 'ترتیل باوقار و خاشعانه',
    bio: 'ملقب به «شهید القراء»؛ دارای سبک ترتیل بی‌نظیر حزن‌آلود و خاشعانه با کامل‌ترین قواعد تجوید و وقف و ابتدا.',
    initials: 'م‌ص',
    avatarColor: 'bg-blue-700 text-white',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
    getUrl: (s, v) => {
      const sPad = String(s).padStart(3, '0');
      const vPad = String(v).padStart(3, '0');
      return `https://everyayah.com/data/Menshawi_32kbps/${sPad}${vPad}.mp3`;
    },
  },
  {
    id: 'afasy',
    name: 'مشاری بن راشد العفاسی',
    subname: 'ترتیل استودیویی مدرن',
    bio: 'امام جماعت مسجد کبیر کویت و قاری سرشناس معاصر با ضبط‌های صوتی دیجیتال باکیفیت و صوت رسا.',
    initials: 'م‌ع',
    avatarColor: 'bg-teal-700 text-white',
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop&crop=face',
    getUrl: (s, v) => {
      const sPad = String(s).padStart(3, '0');
      const vPad = String(v).padStart(3, '0');
      return `https://everyayah.com/data/Alafasy_64kbps/${sPad}${vPad}.mp3`;
    },
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
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedReciterId, setSelectedReciterId] = useState<ReciterId>('parhizgar');
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  // حالت تکرار آیه
  const [repeatTarget, setRepeatTarget] = useState<number>(1); // تعداد کل تکرار هر آیه
  const [currentRepeatIndex, setCurrentRepeatIndex] = useState<number>(1); // تکرار فعلی
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);

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

  // ریست شمارنده تکرار هنگام تغییر دستی آیه
  useEffect(() => {
    setCurrentRepeatIndex(1);
  }, [currentPlayingVerseNumber]);

  // تغییر سورس هنگام تغییر آیه یا قاری
  useEffect(() => {
    if (audioRef.current) {
      const url = currentReciter.getUrl(currentSurah.id, currentPlayingVerseNumber);
      audioRef.current.src = url;
      audioRef.current.playbackRate = playbackRate;
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      }
    }
  }, [currentSurah.id, currentPlayingVerseNumber, selectedReciterId, playbackRate]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio playback error:', err);
        setIsPlaying(false);
      });
    }
  };

  const handleNextVerse = () => {
    const currentIndex = verses.findIndex((v) => v.verseNumber === currentPlayingVerseNumber);
    if (currentIndex !== -1 && currentIndex < verses.length - 1) {
      setCurrentRepeatIndex(1);
      onSelectVerseToPlay(verses[currentIndex + 1].verseNumber);
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

        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-2">
          {/* سمت راست: عکس قاری (آواتار جمع‌وجور) + اطلاعات آیه */}
          <div className="flex items-center gap-2 min-w-0">
            {/* دکمه تصویر/آواتار قاری با قابلیت کلیک جهت نمایش مشخصات */}
            <button
              onClick={() => setShowReciterModal(true)}
              className="relative group shrink-0"
              title={`قاری: ${currentReciter.name} (کلیک جهت مشاهده اطلاعات یا تغییر)`}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-teal-600/70 p-0.5 shadow-sm group-hover:scale-105 group-hover:border-teal-500 transition-all">
                <img
                  src={currentReciter.photoUrl}
                  alt={currentReciter.name}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    // در صورت خطای لود عکس، به آواتار با حروف اختصاری تغییر دهد
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center font-bold text-xs ${currentReciter.avatarColor}`}
                >
                  {currentReciter.initials}
                </div>
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

            {/* دکمه تنظیم سرعت پخش */}
            <button
              onClick={handleCycleSpeed}
              className="px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
              title="تغییر سرعت ترتیل"
            >
              {playbackRate}x
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
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-teal-600 shrink-0 shadow">
                <img
                  src={currentReciter.photoUrl}
                  alt={currentReciter.name}
                  className="w-full h-full object-cover"
                />
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
                        <div className="w-9 h-9 rounded-full overflow-hidden border shrink-0">
                          <img
                            src={r.photoUrl}
                            alt={r.name}
                            className="w-full h-full object-cover"
                          />
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
