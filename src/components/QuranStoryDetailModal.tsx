import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Users,
  Compass,
  Play,
  Square,
  Share2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Award,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Bookmark,
  BookmarkCheck,
  Volume2,
  VolumeX,
  Clock,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { QuranStory } from '../data/quranStories';
import { toPersianDigits } from '../utils/textNormalization';
import { getAudioSourceUrl } from '../services/audioSources';

interface QuranStoryDetailModalProps {
  story: QuranStory | null;
  onClose: () => void;
  onStartQuiz: (story: QuranStory) => void;
  onNavigateToSurah?: (surahId: number) => void;
}

export const QuranStoryDetailModal: React.FC<QuranStoryDetailModalProps> = ({
  story,
  onClose,
  onStartQuiz,
  onNavigateToSurah,
}) => {
  const [activeTab, setActiveTab] = useState<'narrative' | 'ayahs' | 'wisdoms'>('narrative');
  const [readingMode, setReadingMode] = useState<'interactive' | 'full'>('interactive');
  const [interactiveStep, setInteractiveStep] = useState(0);
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // وضعیت بوک‌مارک و خوانده‌شده در حافظه محلی
  const [isBookmarked, setIsBookmarked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('quran_bookmarked_stories');
      if (saved && story) {
        const arr: string[] = JSON.parse(saved);
        return arr.includes(story.id);
      }
    } catch {}
    return false;
  });

  const [isRead, setIsRead] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('quran_read_stories');
      if (saved && story) {
        const arr: string[] = JSON.parse(saved);
        return arr.includes(story.id);
      }
    } catch {}
    return false;
  });

  // هماهنگی مجدد استیت هنگام تغییر داستان
  useEffect(() => {
    if (!story) return;
    setInteractiveStep(0);
    try {
      const savedBm = localStorage.getItem('quran_bookmarked_stories');
      if (savedBm) {
        const arr: string[] = JSON.parse(savedBm);
        setIsBookmarked(arr.includes(story.id));
      }
      const savedRd = localStorage.getItem('quran_read_stories');
      if (savedRd) {
        const arr: string[] = JSON.parse(savedRd);
        setIsRead(arr.includes(story.id));
      }
    } catch {}

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVerseKey(null);
    };
  }, [story?.id]);

  const toggleBookmark = () => {
    if (!story) return;
    try {
      const saved = localStorage.getItem('quran_bookmarked_stories');
      let arr: string[] = saved ? JSON.parse(saved) : [];
      if (arr.includes(story.id)) {
        arr = arr.filter((id) => id !== story.id);
        setIsBookmarked(false);
      } else {
        arr.push(story.id);
        setIsBookmarked(true);
      }
      localStorage.setItem('quran_bookmarked_stories', JSON.stringify(arr));
    } catch {}
  };

  const toggleRead = () => {
    if (!story) return;
    try {
      const saved = localStorage.getItem('quran_read_stories');
      let arr: string[] = saved ? JSON.parse(saved) : [];
      if (arr.includes(story.id)) {
        arr = arr.filter((id) => id !== story.id);
        setIsRead(false);
      } else {
        arr.push(story.id);
        setIsRead(true);
      }
      localStorage.setItem('quran_read_stories', JSON.stringify(arr));
    } catch {}
  };

  // پخش و توقف صوت فراز قرآنی با پشتیبانی قطعی از سوره و شماره آیه اختصاصی
  const handlePlayVerse = (verseNumber?: number, customSurahId?: number) => {
    if (!story || !verseNumber) return;
    const effectiveSurahId = customSurahId || story.surahId;
    const playKey = `${effectiveSurahId}:${verseNumber}`;

    if (playingVerseKey === playKey) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVerseKey(null);
      return;
    }

    const reciters = ['parhizgar', 'afasy', 'abdulbasit', 'minshawi'] as const;
    const urls: string[] = [];
    for (const r of reciters) {
      const u = getAudioSourceUrl(r, effectiveSurahId, verseNumber, 0);
      if (u && !urls.includes(u)) urls.push(u);
    }

    if (urls.length === 0) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    let urlIndex = 0;
    const audio = new Audio(urls[urlIndex]);
    audioRef.current = audio;
    setPlayingVerseKey(playKey);

    const tryNext = () => {
      urlIndex++;
      if (urlIndex < urls.length) {
        audio.src = urls[urlIndex];
        audio.play().catch(() => tryNext());
      } else {
        setPlayingVerseKey(null);
      }
    };

    audio.onended = () => {
      setPlayingVerseKey(null);
    };
    audio.onerror = () => {
      tryNext();
    };
    audio.play().catch(() => tryNext());
  };

  // کپی حکمت داستان در کلیپ‌بورد
  const handleCopyWisdom = () => {
    if (!story) return;
    const textToCopy = `📖 ${story.title} (سوره ${story.surahName}، ${story.versesRange})\n\n«${story.summary}»\n\n✨ حکمت‌ها و عبرت‌های زندگی:\n` +
      story.wisdoms.map((w, i) => `${i + 1}. ${w}`).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    });
  };

  // استخراج قطعی شماره آیه از فیلد یا مرجع آیه جهت پخش صوت در تمام داستان‌ها
  const getSectionVerseNumber = (sec: { keyAyahVerseNumber?: number; keyAyahRef?: string }): number | null => {
    if (sec.keyAyahVerseNumber && sec.keyAyahVerseNumber > 0) {
      return sec.keyAyahVerseNumber;
    }
    if (!sec.keyAyahRef) return null;
    const persianToEnglish: Record<string, string> = {
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
      '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    };
    const normalized = sec.keyAyahRef.replace(/[۰-۹]/g, (d) => persianToEnglish[d] || d);
    const match = normalized.match(/آی[هات]*\s*(\d+)/i) || normalized.match(/(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  if (!story) return null;

  const currentSection = story.narrative[interactiveStep] || story.narrative[0];
  const totalChapters = story.narrative.length;
  const progressPercent = Math.round(((interactiveStep + 1) / totalChapters) * 100);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-2 sm:p-4 pb-3 sm:pb-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
        {/* پیام کپی موفق */}
        {copiedToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-60 bg-teal-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg flex items-center gap-1.5 animate-bounce">
            <Check className="w-3.5 h-3.5" />
            <span>متن و حکمت‌های داستان با موفقیت کپی شد</span>
          </div>
        )}

        {/* سربرگ مودال با طراحی فاخر و شأن قرآنی */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-teal-900/10 via-amber-600/5 to-transparent dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 truncate">
                  {story.title}
                </h2>
                {isRead && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>مطالعه شده</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium truncate mt-0.5">
                <span>سوره {story.surahName}</span>
                <span>•</span>
                <span>{story.versesRange}</span>
                {story.estimatedReadTimeMinutes && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{toPersianDigits(story.estimatedReadTimeMinutes)} دقیقه مطالعه</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* دکمه نشان کردن */}
            <button
              type="button"
              onClick={toggleBookmark}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isBookmarked
                  ? 'border-amber-400 bg-amber-400/15 text-amber-600 dark:text-amber-400'
                  : 'border-stone-200 dark:border-slate-800 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
              title={isBookmarked ? 'حذف از نشان‌شده‌ها' : 'نشان کردن این داستان'}
              aria-label="نشان کردن"
            >
              {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>

            {/* دکمه کپی حکمت */}
            <button
              type="button"
              onClick={handleCopyWisdom}
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-800 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
              title="اشتراک‌گذاری و کپی حکمت داستان"
              aria-label="کپی"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* دکمه شروع آزمون با آیکون سنجش و یادگیری */}
            <button
              onClick={() => onStartQuiz(story)}
              className="py-2 px-3 sm:px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              title="آزمون داستان"
              aria-label="آزمون داستان"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">آزمون داستان</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
              title="بستن"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* برچسب‌های تب مطالعه برای دسترسی عمیق به جزئیات */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 pb-2 border-b border-stone-100 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/40 text-xs font-bold gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('narrative')}
              className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'narrative'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>شرح تفصیلی ماجرا</span>
            </button>

            <button
              onClick={() => setActiveTab('ayahs')}
              className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'ayahs'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>فرازها و آیات</span>
            </button>

            <button
              onClick={() => setActiveTab('wisdoms')}
              className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'wisdoms'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-stone-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>حکمت‌ها ({toPersianDigits(story.wisdoms.length)})</span>
            </button>
          </div>

          {/* سوییچ حالت مطالعه در تب شرح ماجرا */}
          {activeTab === 'narrative' && (
            <div className="flex items-center gap-1 bg-stone-200/70 dark:bg-slate-700/60 p-0.5 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setReadingMode('interactive')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  readingMode === 'interactive'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                پرده‌به‌پرده
              </button>
              <button
                type="button"
                onClick={() => setReadingMode('full')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  readingMode === 'full'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                نمایش کامل
              </button>
            </div>
          )}
        </div>

        {/* بدنه محتوای داستان با فونت فوق‌العاده خوانا و جزئیات فراگیر */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* معرفی اجمالی و شخصیت‌ها */}
          <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/20 dark:via-slate-800/60 dark:to-transparent border border-amber-500/25 space-y-2.5">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {story.subtitle}
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
              {story.summary}
            </p>
            <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>شخصیت‌های محوری:</span>
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {story.character}
                </span>
              </div>

              {/* دکمه علامت‌گذاری به عنوان خوانده‌شده */}
              <button
                type="button"
                onClick={toggleRead}
                className={`py-1 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isRead
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-stone-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isRead ? 'خوانده شد ✓' : 'علامت به عنوان خوانده‌شده'}</span>
              </button>
            </div>
          </div>

          {/* تب ۱: شرح تفصیلی و جزء‌به‌جزء ماجرا */}
          {activeTab === 'narrative' && (
            <>
              {/* حالت پرده‌به‌پرده (قصه‌گویی تعاملی) */}
              {readingMode === 'interactive' ? (
                <div className="space-y-4">
                  {/* نوار پیشرفت فصول */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-teal-700 dark:text-teal-400">
                        فصل {toPersianDigits(interactiveStep + 1)} از {toPersianDigits(totalChapters)}
                      </span>
                      <span className="text-slate-400">{toPersianDigits(progressPercent)}٪ مطالعه</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 transition-all duration-300 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* کارت فصل جاری */}
                  <div className="rounded-3xl p-5 sm:p-7 bg-stone-50 dark:bg-slate-800/80 border border-stone-200 dark:border-slate-700 space-y-4 shadow-sm animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-slate-700 pb-3">
                      <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                          {toPersianDigits(interactiveStep + 1)}
                        </span>
                        <span>{currentSection.sectionTitle}</span>
                      </div>
                      {currentSection.keyAyahRef && (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-stone-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                          {currentSection.keyAyahRef}
                        </span>
                      )}
                    </div>

                    <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-loose text-justify font-normal">
                      {currentSection.text}
                    </p>

                    {/* فراز قرآنی عثمان‌طه همراه با دکمه پخش صوت */}
                    {currentSection.keyAyahText && (
                      <div className="pt-2">
                        <div className="p-4 sm:p-6 rounded-2xl bg-amber-50/80 dark:bg-slate-900 border border-amber-300/40 dark:border-amber-600/30 text-center relative shadow-xs group">
                          <div
                            className="font-bold text-xl sm:text-2xl text-slate-900 dark:text-amber-100 leading-[2.4]"
                            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                          >
                            «{currentSection.keyAyahText}»
                          </div>

                          {/* دکمه گوش دادن به صوت تلاوت این آیه با تضمین سوره و آیه */}
                          {(() => {
                            const vNum = currentSection.keyAyahVerseNumber || getSectionVerseNumber(currentSection) || 1;
                            const sId = currentSection.surahId || story.surahId;
                            const playKey = `${sId}:${vNum}`;
                            const isPlaying = playingVerseKey === playKey;

                            return (
                              <div className="mt-3 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handlePlayVerse(vNum, sId)}
                                  className={`py-1.5 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                                    isPlaying
                                      ? 'bg-amber-600 text-white animate-pulse'
                                      : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-slate-700 border border-amber-300 dark:border-slate-700'
                                  }`}
                                >
                                  {isPlaying ? (
                                    <>
                                      <Square className="w-3.5 h-3.5 fill-current" />
                                      <span>در حال پخش تلاوت... (توقف)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 className="w-3.5 h-3.5" />
                                      <span>شنیدن تلاوت آیه (صوت پرهیزگار)</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* دکمه‌های ناوبری فصول */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={interactiveStep === 0}
                      onClick={() => setInteractiveStep((prev) => Math.max(0, prev - 1))}
                      className="py-2.5 px-4 rounded-xl border border-stone-300 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed hover:bg-stone-100 dark:hover:bg-slate-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>فصل قبلی</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {story.narrative.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setInteractiveStep(i)}
                          className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                            interactiveStep === i
                              ? 'bg-teal-600 scale-125'
                              : 'bg-stone-300 dark:bg-slate-700 hover:bg-stone-400'
                          }`}
                          title={`فصل ${toPersianDigits(i + 1)}`}
                        />
                      ))}
                    </div>

                    {interactiveStep < totalChapters - 1 ? (
                      <button
                        type="button"
                        onClick={() => setInteractiveStep((prev) => Math.min(totalChapters - 1, prev + 1))}
                        className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <span>فصل بعدی</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRead(true);
                          toggleRead();
                          setActiveTab('wisdoms');
                        }}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Award className="w-4 h-4" />
                        <span>مشاهده حکمت‌ها</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* حالت پیوسته و کامل تمام فصول */
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                      فصول و وقایع تفصیلی داستان:
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {toPersianDigits(story.narrative.length)} فصل روایی
                    </span>
                  </div>

                  {story.narrative.map((sec, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl p-4 sm:p-6 bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-3.5 transition-all hover:border-teal-500/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {toPersianDigits(idx + 1)}
                          </span>
                          <span>{sec.sectionTitle}</span>
                        </div>
                        {sec.keyAyahRef && (
                          <span className="text-[11px] px-2 py-0.5 rounded-lg bg-stone-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                            {sec.keyAyahRef}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm md:text-base text-slate-700 dark:text-slate-200 leading-loose text-justify font-normal">
                        {sec.text}
                      </p>

                      {sec.keyAyahText && (
                        <div className="pt-2">
                          <div
                            className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-slate-900/90 border border-amber-300/40 dark:border-amber-600/30 text-center font-bold text-lg sm:text-2xl text-slate-900 dark:text-amber-100 leading-[2.4] shadow-xs"
                            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                          >
                            «{sec.keyAyahText}»
                          </div>

                          {(() => {
                            const vNum = sec.keyAyahVerseNumber || getSectionVerseNumber(sec) || 1;
                            const sId = sec.surahId || story.surahId;
                            const playKey = `${sId}:${vNum}`;
                            const isPlaying = playingVerseKey === playKey;

                            return (
                              <div className="mt-2.5 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handlePlayVerse(vNum, sId)}
                                  className={`py-1 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                    isPlaying
                                      ? 'bg-amber-600 text-white animate-pulse'
                                      : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-300/60 dark:border-slate-700'
                                  }`}
                                >
                                  {isPlaying ? (
                                    <>
                                      <Square className="w-3.5 h-3.5 fill-current" />
                                      <span>در حال پخش تلاوت... (توقف)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 className="w-3.5 h-3.5" />
                                      <span>شنیدن تلاوت آیه (صوت پرهیزگار)</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* تب ۲: فقط فرازهای منتخب و آیات عثمان‌طه */}
          {activeTab === 'ayahs' && (
            <div className="space-y-4">
              <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                فرازهای کلیدی و آیات شریفه در این سرگذشت:
              </h3>

              {story.narrative
                .filter((s) => s.keyAyahText)
                .map((sec, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl p-5 bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-bold">
                      <span>{sec.sectionTitle}</span>
                      <span>{sec.keyAyahRef}</span>
                    </div>

                    <div
                      className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-center font-bold text-xl sm:text-2xl text-slate-900 dark:text-amber-100 leading-[2.4]"
                      style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                    >
                      «{sec.keyAyahText}»
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {sec.text}
                    </p>

                    {(() => {
                      const vNum = sec.keyAyahVerseNumber || getSectionVerseNumber(sec) || 1;
                      const sId = sec.surahId || story.surahId;
                      const playKey = `${sId}:${vNum}`;
                      const isPlaying = playingVerseKey === playKey;

                      return (
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handlePlayVerse(vNum, sId)}
                            className={`py-1.5 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              isPlaying
                                ? 'bg-amber-600 text-white animate-pulse'
                                : 'bg-amber-100/70 dark:bg-slate-800 text-amber-800 dark:text-amber-300 hover:bg-amber-200/70'
                            }`}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>توقف پخش</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>شنیدن تلاوت آیه (صوت پرهیزگار)</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ))}
            </div>
          )}

          {/* تب ۳: حکمت‌ها و عبرت‌های تربیتی */}
          {activeTab === 'wisdoms' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-700/30 space-y-3">
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>درس‌های معرفتی و عبرت‌های جاودان برای زندگی معاصر:</span>
                </h3>
                <ul className="space-y-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100/95 leading-relaxed">
                  {story.wisdoms.map((w, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {toPersianDigits(i + 1)}
                      </span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* کارت دعوت به آزمون شورتز */}
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs sm:text-sm text-teal-900 dark:text-teal-200">
                    آیا مایلید محفوظات خود از این داستان را بیازمایید؟
                  </div>
                  <div className="text-xs text-teal-700 dark:text-teal-300/80 mt-0.5">
                    شامل {toPersianDigits(story.questions.length)} سوال چهارگزینه‌ای تطبیقی با شأن قرآنی
                  </div>
                </div>

                <button
                  onClick={() => onStartQuiz(story)}
                  className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>آزمون سریع این داستان</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* پانوشت مودال: فقط دکمه تلاوت طبق درخواست کاربر */}
        <div className="p-3.5 sm:p-4 border-t border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/50 flex items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
            <Volume2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>سوره {story.surahName} • {story.versesRange}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onNavigateToSurah) {
                onNavigateToSurah(story.surahId);
                onClose();
              } else {
                const targetVerse = currentSection?.keyAyahVerseNumber || 1;
                const targetSurahId = currentSection?.surahId || story.surahId;
                handlePlayVerse(targetVerse, targetSurahId);
              }
            }}
            className="py-2.5 px-4 sm:px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
            title={`تلاوت در سوره ${story.surahName}`}
          >
            <Volume2 className="w-4 h-4" />
            <span>تلاوت در سوره {story.surahName}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
