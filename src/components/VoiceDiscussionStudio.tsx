import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  Layers,
  HelpCircle,
  Eye,
  EyeOff,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  Settings,
  ChevronRight,
  User,
  Bot,
  Zap,
  Bookmark,
  VolumeX,
} from 'lucide-react';
import { Surah, Verse } from '../types';
import {
  ReciterId,
  RECITER_NAMES,
  resolveAudioSource,
  getProxiedAudioUrl,
} from '../services/audioSources';
import { toPersianDigits } from '../utils/textNormalization';
import { SurahSelectorModal } from './SurahSelectorModal';
import {
  evaluateRecitation,
  StrictnessLevel,
  RecitationEvaluation,
} from '../utils/quranRecitationEvaluator';
import { quizAudio } from '../utils/quizAudio';
import { addAyahToReview } from '../services/activityTracker';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { apiFetch } from '../services/apiClient';

export type DiscussionMode =
  | 'verse_by_verse' // ۱. آیه به آیه
  | 'page_by_page' // ۲. صفحه به صفحه
  | 'completion' // ۳. مباحثه تکمیلی (نیمه‌کاره)
  | 'competitive' // ۴. روش مسابقه‌ای (سرعتی و امتیازی)
  | 'thematic'; // ۵. مقطع به مقطع یا محتوا محور

interface VoiceDiscussionStudioProps {
  currentSurah: Surah;
  surahs: Surah[];
  verses: Verse[];
  darkMode: boolean;
  onSelectSurah?: (surah: Surah) => void;
  onBack: () => void;
}

import { SmartRecitationFeedbackPanel } from './voiceDiscussion/SmartRecitationFeedbackPanel';
export type { AiRecitationResult, SmartRecitationFeedbackPanelProps } from './voiceDiscussion/types';

export const VoiceDiscussionStudio: React.FC<VoiceDiscussionStudioProps> = ({
  currentSurah,
  surahs,
  verses,
  darkMode,
  onSelectSurah,
  onBack,
}) => {
  // تب‌های استودیو: تنظیمات و انتخاب روش / جلسه زنده مباحثه
  const [isSessionActive, setIsSessionActive] = useState(false);

  // روش انتخابی مباحثه
  const [discussionMode, setDiscussionMode] = useState<DiscussionMode>('verse_by_verse');

  // محدوده آیات برای مباحثه (روش آیه به آیه)
  const [startVerse, setStartVerse] = useState<number>(1);
  const [endVerse, setEndVerse] = useState<number>(Math.min(10, currentSurah.versesCount || 10));

  // صفحات سوره برای روش صفحه به صفحه
  const surahPages = useMemo(() => {
    const pageSet = new Set<number>();
    verses.forEach((v) => {
      if (v.pageNumber) pageSet.add(v.pageNumber);
    });
    const list = Array.from(pageSet).sort((a, b) => a - b);
    if (list.length > 0) return list;
    if (currentSurah.startPage) return [currentSurah.startPage];
    return [1];
  }, [verses, currentSurah.startPage]);

  const [selectedStartPage, setSelectedStartPage] = useState<number>(
    surahPages[0] || currentSurah.startPage || 1
  );
  const [selectedEndPage, setSelectedEndPage] = useState<number>(
    surahPages[surahPages.length - 1] || currentSurah.startPage || 1
  );

  // قاری هم‌مباحثه
  const [selectedReciterId, setSelectedReciterId] = useState<ReciterId>('parhizgar');

  // نوبت شروع: آیا سیستم شروع کند یا کاربر؟
  const [starterTurn, setStarterTurn] = useState<'system' | 'user'>('system');

  // گزینه‌های کمکی و بصری
  const [hideSystemText, setHideSystemText] = useState(false); // تقویت حافظه شنیداری
  const [hideUserText, setHideUserText] = useState(true); // آزمون واقعی تلاوت از حفظ
  const [autoAdvance, setAutoAdvance] = useState(true); // رفتن خودکار به نوبت بعد

  // مودال انتخاب سوره
  const [isSurahPickerOpen, setIsSurahPickerOpen] = useState(false);

  // -------------------------------------------------------------
  // وضعیت‌های جلسه زنده مباحثه آیه به آیه
  // -------------------------------------------------------------
  const [currentVerseIndex, setCurrentVerseIndex] = useState<number>(0);
  const [currentTurn, setCurrentTurn] = useState<'system' | 'user'>('system');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // وضعیت‌های اختصاصی جلسه زنده مباحثه صفحه به صفحه
  // -------------------------------------------------------------
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [systemPageVerseIndex, setSystemPageVerseIndex] = useState<number>(0);
  const [revealedVerseNumbers, setRevealedVerseNumbers] = useState<number[]>([]);
  const [showFullPagePrompt, setShowFullPagePrompt] = useState(false);
  const [showPageHeaderHint, setShowPageHeaderHint] = useState(false);
  const [isPageAudioPlaying, setIsPageAudioPlaying] = useState(false);

  // -------------------------------------------------------------
  // وضعیت‌های اختصاصی جلسه زنده روش ۳: مباحثه تکمیلی (اکمال فراز)
  // -------------------------------------------------------------
  const [completionSplit, setCompletionSplit] = useState<'half' | 'first_words' | 'two_thirds'>('half');
  const [revealedCompletionWordCount, setRevealedCompletionWordCount] = useState<number>(0);
  const [isCompletionFullRevealed, setIsCompletionFullRevealed] = useState<boolean>(false);

  // -------------------------------------------------------------
  // وضعیت‌های اختصاصی جلسه زنده روش ۴: روش مسابقه‌ای (سرعتی و امتیازی)
  // -------------------------------------------------------------
  const [competitiveTimeLimit, setCompetitiveTimeLimit] = useState<number>(20);
  const [competitiveChallengeType, setCompetitiveChallengeType] = useState<'next_verse' | 'speed_completion'>('next_verse');
  const [competitiveScore, setCompetitiveScore] = useState<number>(0);
  const [competitiveStreak, setCompetitiveStreak] = useState<number>(0);
  const [maxCompetitiveStreak, setMaxCompetitiveStreak] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);
  const [competitiveRevealed, setCompetitiveRevealed] = useState<boolean>(false);

  // -------------------------------------------------------------
  // وضعیت‌های اختصاصی جلسه زنده روش ۵: مقطع به مقطع (محتوامحور)
  // -------------------------------------------------------------
  const [sectionPassageSize, setSectionPassageSize] = useState<number>(5);
  const [thematicTurnMode, setThematicTurnMode] = useState<'alternating' | 'user_recall'>('alternating');
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [thematicRevealedVerseNumbers, setThematicRevealedVerseNumbers] = useState<number[]>([]);
  const [showFullSectionText, setShowFullSectionText] = useState<boolean>(false);
  const [systemSectionVerseIndex, setSystemSectionVerseIndex] = useState<number>(0);

  // ضبط صدای کاربر و ارزیابی هوشمند صحت تلاوت
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [showHintWord, setShowHintWord] = useState(false);
  const [showFullVersePrompt, setShowFullVersePrompt] = useState(false);

  // تنظیمات ارزیابی هوشمند صوت
  const [strictnessLevel, setStrictnessLevel] = useState<StrictnessLevel>('normal');
  const [speechDialect, setSpeechDialect] = useState<'ar-EG' | 'ar-SA'>('ar-EG');
  const [autoAdvanceOnPass, setAutoAdvanceOnPass] = useState<boolean>(true);
  const [soundFeedbackEnabled, setSoundFeedbackEnabled] = useState<boolean>(true);
  const hasTriggeredPassAudioRef = useRef<boolean>(false);

  // آمار تسلط این دور
  const [masteredCount, setMasteredCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [sessionDurationSec, setSessionDurationSec] = useState<number>(0);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const isExplicitlyRecordingRef = useRef<boolean>(false);
  const accumulatedTranscriptRef = useRef<string>('');

  // همگام‌سازی محدوده آیات و صفحات هنگام تغییر سوره
  useEffect(() => {
    setStartVerse(1);
    setEndVerse(Math.min(10, currentSurah.versesCount || 10));
    if (surahPages.length > 0) {
      setSelectedStartPage(surahPages[0]);
      setSelectedEndPage(surahPages[Math.min(2, surahPages.length - 1)]);
    }
  }, [currentSurah, surahPages]);

  // آیات انتخاب‌شده برای جلسه آیه به آیه
  const sessionVerses = useMemo(() => {
    const s = Math.min(startVerse, endVerse);
    const e = Math.max(startVerse, endVerse);
    return verses.filter((v) => v.verseNumber >= s && v.verseNumber <= e);
  }, [verses, startVerse, endVerse]);

  // صفحات انتخاب‌شده برای جلسه صفحه به صفحه
  const sessionPages = useMemo(() => {
    const minP = Math.min(selectedStartPage, selectedEndPage);
    const maxP = Math.max(selectedStartPage, selectedEndPage);
    return surahPages.filter((p) => p >= minP && p <= maxP);
  }, [surahPages, selectedStartPage, selectedEndPage]);

  const activeVerse = sessionVerses[currentVerseIndex];

  // محاسبه تقسیم آیه برای روش تکمیلی (فراز سیستم و اکمال کاربر)
  const activeVerseSplit = useMemo(() => {
    if (!activeVerse) return null;
    const words = activeVerse.textArabic.trim().split(/\s+/);
    if (words.length <= 2) {
      return {
        promptText: words.slice(0, 1).join(' '),
        completionText: words.slice(1).join(' '),
        promptWords: words.slice(0, 1),
        completionWords: words.slice(1),
        totalWords: words.length,
      };
    }
    let splitIdx = Math.max(1, Math.floor(words.length / 2));
    if (completionSplit === 'first_words') {
      splitIdx = Math.min(3, Math.max(1, Math.floor(words.length / 3)));
    } else if (completionSplit === 'two_thirds') {
      splitIdx = Math.max(1, Math.floor((words.length * 2) / 3));
    }
    return {
      promptText: words.slice(0, splitIdx).join(' '),
      completionText: words.slice(splitIdx).join(' '),
      promptWords: words.slice(0, splitIdx),
      completionWords: words.slice(splitIdx),
      totalWords: words.length,
    };
  }, [activeVerse, completionSplit]);

  // آیه قبلی برای چالش تلاوت آیه بعد در روش مسابقه‌ای
  const previousVerse = useMemo(() => {
    if (!activeVerse) return null;
    return verses.find((v) => v.verseNumber === activeVerse.verseNumber - 1) || null;
  }, [verses, activeVerse]);

  // آیات صفحه فعلی در روش صفحه به صفحه
  const currentPageNumber = sessionPages[currentPageIndex] || surahPages[0] || 1;
  const currentPageVerses = useMemo(() => {
    return verses.filter((v) => v.pageNumber === currentPageNumber);
  }, [verses, currentPageNumber]);

  // محاسبه نوبت جاری در روش آیه به آیه
  const isSystemTurn = useMemo(() => {
    if (starterTurn === 'system') {
      return currentVerseIndex % 2 === 0;
    }
    return currentVerseIndex % 2 === 1;
  }, [currentVerseIndex, starterTurn]);

  // محاسبه نوبت جاری در روش صفحه به صفحه
  const isSystemPageTurn = useMemo(() => {
    if (starterTurn === 'system') {
      return currentPageIndex % 2 === 0;
    }
    return currentPageIndex % 2 === 1;
  }, [currentPageIndex, starterTurn]);

  // مقاطع مفهومی و محتوامحور برای روش ۵
  const thematicSections = useMemo(() => {
    if (sessionVerses.length === 0) return [];
    const size = sectionPassageSize;
    const sections: Array<{
      id: number;
      startVerse: number;
      endVerse: number;
      title: string;
      verses: Verse[];
    }> = [];

    for (let i = 0; i < sessionVerses.length; i += size) {
      const chunk = sessionVerses.slice(i, i + size);
      const startV = chunk[0].verseNumber;
      const endV = chunk[chunk.length - 1].verseNumber;
      let title = `مقطع ${sections.length + 1}: آیات ${toPersianDigits(startV)} تا ${toPersianDigits(endV)}`;
      if (startV === 1) {
        title = `فراز افتتاحیه: آیات ${toPersianDigits(startV)} تا ${toPersianDigits(endV)}`;
      } else if (endV === currentSurah.versesCount) {
        title = `فراز پایانی و ختام سوره: آیات ${toPersianDigits(startV)} تا ${toPersianDigits(endV)}`;
      }
      sections.push({
        id: sections.length,
        startVerse: startV,
        endVerse: endV,
        title,
        verses: chunk,
      });
    }
    return sections;
  }, [sessionVerses, sectionPassageSize, currentSurah.versesCount]);

  const activeSection = thematicSections[currentSectionIndex] || thematicSections[0];

  // محاسبه نوبت در روش مقطع به مقطع
  const isSystemSectionTurn = useMemo(() => {
    if (thematicTurnMode === 'user_recall') return false;
    if (starterTurn === 'system') return currentSectionIndex % 2 === 0;
    return currentSectionIndex % 2 === 1;
  }, [thematicTurnMode, starterTurn, currentSectionIndex]);

  // متن هدف آیه برای سنجش صحت تلاوت کاربر بر اساس متد جاری
  const currentTargetRecitationText = useMemo(() => {
    if (discussionMode === 'completion') {
      return activeVerseSplit?.completionText || '';
    }
    if (discussionMode === 'competitive') {
      if (competitiveChallengeType === 'speed_completion') {
        return activeVerseSplit?.completionText || '';
      }
      return activeVerse?.textArabic || '';
    }
    if (discussionMode === 'thematic') {
      return activeSection?.verses.map((v) => v.textArabic).join(' ') || '';
    }
    if (discussionMode === 'page_by_page') {
      return currentPageVerses.map((v) => v.textArabic).join(' ') || '';
    }
    return activeVerse?.textArabic || '';
  }, [
    discussionMode,
    activeVerse,
    activeVerseSplit,
    competitiveChallengeType,
    activeSection,
    currentPageVerses,
  ]);

  // نتیجه ارزیابی هوشمند صوت نسبت به متن هدف
  const recitationEvaluation = useMemo<RecitationEvaluation>(() => {
    if (!currentTargetRecitationText || !transcribedText) {
      return {
        accuracy: 0,
        isPass: false,
        totalTargetWords: 0,
        matchedWordsCount: 0,
        missedWordsCount: 0,
        wordResults: [],
        message: '',
        verdictType: 'empty',
      };
    }
    return evaluateRecitation(currentTargetRecitationText, transcribedText, strictnessLevel);
  }, [currentTargetRecitationText, transcribedText, strictnessLevel]);

  // کنترل Web Speech API برای تشخیص صدای کاربر در مرورگر با قابلیت ادامه‌دار و حفظ متن در مکث‌ها
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.lang = speechDialect; // لهجه عربی و ترتیل قرآنی

      recognition.onresult = (event: any) => {
        let currentSessionTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res && res[0]) {
            currentSessionTranscript += res[0].transcript + ' ';
          }
        }
        const fullTranscript = (
          accumulatedTranscriptRef.current + ' ' + currentSessionTranscript
        )
          .replace(/\s+/g, ' ')
          .trim();
        setTranscribedText(fullTranscript);
      };

      recognition.onerror = (event: any) => {
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          isExplicitlyRecordingRef.current = false;
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        // اگر کاربر عمداً دکمه توقف را نزده، بلکه به خاطر مکث بین کلمات یا نفس کشیدن بوده:
        if (isExplicitlyRecordingRef.current) {
          setTranscribedText((prev) => {
            accumulatedTranscriptRef.current = prev;
            return prev;
          });
          setTimeout(() => {
            if (isExplicitlyRecordingRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {}
            }
          }, 60);
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [speechDialect]);

  // تلاش مجدد و پاک کردن متن ضبط شده
  const handleRetryRecording = () => {
    isExplicitlyRecordingRef.current = false;
    accumulatedTranscriptRef.current = '';
    setTranscribedText('');
    hasTriggeredPassAudioRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  // شروع یا توقف ضبط صوت
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setIsRecording(!isRecording);
      return;
    }

    if (isRecording) {
      isExplicitlyRecordingRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
    } else {
      isExplicitlyRecordingRef.current = true;
      accumulatedTranscriptRef.current = '';
      setTranscribedText('');
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(true);
      }
    }
  };

  // پخش ترتیل آیه سیستم
  const playVerseAudio = useCallback(
    (verseNum: number) => {
      const resolved = resolveAudioSource(selectedReciterId, currentSurah.id, verseNum);
      if (!resolved || !resolved.url) {
        setAudioError('فایل صوتی این آیه برای این قاری یافت نشد.');
        return;
      }

      setAudioError(null);
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const proxied = getProxiedAudioUrl(resolved.url);
      audioRef.current.src = proxied;
      setIsPlayingAudio(true);

      audioRef.current
        .play()
        .then(() => {
          setIsPlayingAudio(true);
        })
        .catch(() => {
          setIsPlayingAudio(false);
        });

      audioRef.current.onended = () => {
        setIsPlayingAudio(false);
        // اگر نوبت سیستم تمام شد و خودکار به نوبت کاربر می‌رود
        if (autoAdvance) {
          // آماده‌باش برای کاربر
        }
      };
    },
    [selectedReciterId, currentSurah.id, autoAdvance]
  );

  // توقف صوت
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      setIsPageAudioPlaying(false);
    }
  };

  // پخش ترتیل پیوسته آیات صفحه توسط سیستم در روش صفحه به صفحه
  const playPageVerseAudio = useCallback(
    (verseIdx: number) => {
      if (!currentPageVerses || verseIdx >= currentPageVerses.length) {
        setIsPlayingAudio(false);
        setIsPageAudioPlaying(false);
        return;
      }
      const v = currentPageVerses[verseIdx];
      if (!v) return;

      setSystemPageVerseIndex(verseIdx);
      const resolved = resolveAudioSource(selectedReciterId, currentSurah.id, v.verseNumber);
      if (!resolved || !resolved.url) {
        setAudioError('فایل صوتی این آیه برای این قاری یافت نشد.');
        setIsPlayingAudio(false);
        setIsPageAudioPlaying(false);
        return;
      }

      setAudioError(null);
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const proxied = getProxiedAudioUrl(resolved.url);
      audioRef.current.src = proxied;
      setIsPlayingAudio(true);
      setIsPageAudioPlaying(true);

      audioRef.current
        .play()
        .then(() => {
          setIsPlayingAudio(true);
          setIsPageAudioPlaying(true);
        })
        .catch(() => {
          setIsPlayingAudio(false);
          setIsPageAudioPlaying(false);
        });

      audioRef.current.onended = () => {
        if (verseIdx + 1 < currentPageVerses.length) {
          playPageVerseAudio(verseIdx + 1);
        } else {
          setIsPlayingAudio(false);
          setIsPageAudioPlaying(false);
        }
      };
    },
    [currentPageVerses, selectedReciterId, currentSurah.id]
  );

  const handleTogglePageAudio = () => {
    if (isPlayingAudio) {
      stopAudio();
    } else {
      playPageVerseAudio(systemPageVerseIndex);
    }
  };

  // پخش ترتیل پیوسته آیات مقطع در روش ۵: مقطع به مقطع
  const playSectionVerseAudio = useCallback(
    (verseIdx: number) => {
      if (!activeSection || !activeSection.verses || verseIdx >= activeSection.verses.length) {
        setIsPlayingAudio(false);
        return;
      }
      const v = activeSection.verses[verseIdx];
      if (!v) return;

      setSystemSectionVerseIndex(verseIdx);
      const resolved = resolveAudioSource(selectedReciterId, currentSurah.id, v.verseNumber);
      if (!resolved || !resolved.url) {
        setAudioError('فایل صوتی این آیه برای این قاری یافت نشد.');
        setIsPlayingAudio(false);
        return;
      }

      setAudioError(null);
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const proxied = getProxiedAudioUrl(resolved.url);
      audioRef.current.src = proxied;
      setIsPlayingAudio(true);

      audioRef.current
        .play()
        .then(() => {
          setIsPlayingAudio(true);
        })
        .catch(() => {
          setIsPlayingAudio(false);
        });

      audioRef.current.onended = () => {
        if (verseIdx + 1 < activeSection.verses.length) {
          playSectionVerseAudio(verseIdx + 1);
        } else {
          setIsPlayingAudio(false);
        }
      };
    },
    [activeSection, selectedReciterId, currentSurah.id]
  );

  const handleToggleSectionAudio = () => {
    if (isPlayingAudio) {
      stopAudio();
    } else {
      playSectionVerseAudio(systemSectionVerseIndex);
    }
  };

  // مدیریت نوبت‌ها در روش آیه به آیه
  useEffect(() => {
    if (!isSessionActive || discussionMode !== 'verse_by_verse' || !activeVerse) return;

    setShowHintWord(false);
    setShowFullVersePrompt(false);
    setTranscribedText('');
    hasTriggeredPassAudioRef.current = false;

    if (isSystemTurn) {
      setCurrentTurn('system');
      // پخش ترتیل آیه توسط سیستم
      playVerseAudio(activeVerse.verseNumber);
    } else {
      setCurrentTurn('user');
      stopAudio();
    }
  }, [isSessionActive, discussionMode, currentVerseIndex, isSystemTurn, activeVerse, playVerseAudio]);

  // مدیریت نوبت‌ها در روش صفحه به صفحه
  useEffect(() => {
    if (!isSessionActive || discussionMode !== 'page_by_page') return;

    setSystemPageVerseIndex(0);
    setRevealedVerseNumbers([]);
    setShowFullPagePrompt(false);
    setShowPageHeaderHint(false);
    setTranscribedText('');
    hasTriggeredPassAudioRef.current = false;

    if (isSystemPageTurn) {
      setCurrentTurn('system');
      playPageVerseAudio(0);
    } else {
      setCurrentTurn('user');
      stopAudio();
    }
  }, [isSessionActive, discussionMode, currentPageIndex, isSystemPageTurn, playPageVerseAudio]);

  // مدیریت نوبت‌ها در روش ۳: مباحثه تکمیلی (اکمال فراز)
  useEffect(() => {
    if (!isSessionActive || discussionMode !== 'completion') return;
    setRevealedCompletionWordCount(0);
    setIsCompletionFullRevealed(false);
    setTranscribedText('');
    hasTriggeredPassAudioRef.current = false;
    stopAudio();
  }, [isSessionActive, discussionMode, currentVerseIndex]);

  // مدیریت زمان‌سنج در روش ۴: مسابقه‌ای (سرعتی و امتیازی)
  useEffect(() => {
    if (!isSessionActive || discussionMode !== 'competitive' || !isTimerRunning || isTimeUp) {
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimeUp(true);
          setIsTimerRunning(false);
          setCompetitiveStreak(0);
          setReviewedCount((c) => c + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, discussionMode, isTimerRunning, isTimeUp, currentVerseIndex]);

  // ریست هر سوال جدید در روش مسابقه‌ای
  useEffect(() => {
    if (!isSessionActive || discussionMode !== 'competitive') return;
    setTimeLeft(competitiveTimeLimit);
    setIsTimeUp(false);
    setCompetitiveRevealed(false);
    setIsTimerRunning(true);
    setTranscribedText('');
    hasTriggeredPassAudioRef.current = false;
    stopAudio();
  }, [isSessionActive, discussionMode, currentVerseIndex, competitiveTimeLimit]);

  // مدیریت نوبت‌ها در روش ۵: مقطع به مقطع (محتوامحور)
  useEffect(() => {
    if (!isSessionActive || discussionMode !== 'thematic' || !activeSection) return;
    setSystemSectionVerseIndex(0);
    setThematicRevealedVerseNumbers([]);
    setShowFullSectionText(false);
    setTranscribedText('');
    hasTriggeredPassAudioRef.current = false;

    if (isSystemSectionTurn) {
      setCurrentTurn('system');
      playSectionVerseAudio(0);
    } else {
      setCurrentTurn('user');
      stopAudio();
    }
  }, [isSessionActive, discussionMode, currentSectionIndex, isSystemSectionTurn, playSectionVerseAudio]);

  // ارزیابی هوشمند و اعمال خودکار تایید تلاوت
  useEffect(() => {
    if (!isSessionActive || !transcribedText) {
      hasTriggeredPassAudioRef.current = false;
      return;
    }

    if (recitationEvaluation.isPass && !hasTriggeredPassAudioRef.current) {
      hasTriggeredPassAudioRef.current = true;
      if (soundFeedbackEnabled) {
        quizAudio.playCorrect();
      }

      // در روش مسابقه‌ای: ثبت خودکار امتیاز و رفتن به سوال بعد
      if (discussionMode === 'competitive' && isTimerRunning && !isTimeUp) {
        handleCompetitiveSuccess();
      }
    }
  }, [
    isSessionActive,
    recitationEvaluation.isPass,
    transcribedText,
    soundFeedbackEnabled,
    discussionMode,
    isTimerRunning,
    isTimeUp,
  ]);

  // شروع جلسه
  const handleStartSession = () => {
    if (discussionMode === 'page_by_page') {
      if (sessionPages.length === 0) return;
      setIsSessionActive(true);
      setIsSessionFinished(false);
      setCurrentPageIndex(0);
      setSystemPageVerseIndex(0);
      setMasteredCount(0);
      setReviewedCount(0);
      setSessionStartTime(Date.now());
      return;
    }

    if (discussionMode === 'thematic') {
      if (thematicSections.length === 0) return;
      setIsSessionActive(true);
      setIsSessionFinished(false);
      setCurrentSectionIndex(0);
      setSystemSectionVerseIndex(0);
      setMasteredCount(0);
      setReviewedCount(0);
      setSessionStartTime(Date.now());
      return;
    }

    if (discussionMode === 'competitive') {
      if (sessionVerses.length === 0) return;
      setIsSessionActive(true);
      setIsSessionFinished(false);
      setCurrentVerseIndex(0);
      setCompetitiveScore(0);
      setCompetitiveStreak(0);
      setMaxCompetitiveStreak(0);
      setMasteredCount(0);
      setReviewedCount(0);
      setTimeLeft(competitiveTimeLimit);
      setIsTimeUp(false);
      setCompetitiveRevealed(false);
      setIsTimerRunning(true);
      setSessionStartTime(Date.now());
      return;
    }

    if (sessionVerses.length === 0) return;
    setIsSessionActive(true);
    setIsSessionFinished(false);
    setCurrentVerseIndex(0);
    setMasteredCount(0);
    setReviewedCount(0);
    setSessionStartTime(Date.now());
  };

  // تایید مقطع کاربر و رفتن به مقطع بعد در روش ۵: مقطع به مقطع
  const advanceToNextSection = (wasMastered = true) => {
    stopAudio();
    isExplicitlyRecordingRef.current = false;
    accumulatedTranscriptRef.current = '';
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);

    if (wasMastered) {
      setMasteredCount((prev) => prev + 1);
    } else {
      setReviewedCount((prev) => prev + 1);
    }

    if (currentSectionIndex + 1 < thematicSections.length) {
      setCurrentSectionIndex((prev) => prev + 1);
    } else {
      setIsSessionFinished(true);
      setSessionDurationSec(Math.round((Date.now() - sessionStartTime) / 1000));
    }
  };

  // بازگشت به مقطع قبل در روش ۵
  const handlePreviousSection = () => {
    if (currentSectionIndex > 0) {
      stopAudio();
      setCurrentSectionIndex((prev) => prev - 1);
    }
  };

  // تایید صفحه کاربر و رفتن به صفحه بعد در روش صفحه به صفحه
  const advanceToNextPage = (wasMastered = true) => {
    stopAudio();
    isExplicitlyRecordingRef.current = false;
    accumulatedTranscriptRef.current = '';
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);

    if (wasMastered) {
      setMasteredCount((prev) => prev + 1);
    } else {
      setReviewedCount((prev) => prev + 1);
    }

    if (currentPageIndex + 1 < sessionPages.length) {
      setCurrentPageIndex((prev) => prev + 1);
    } else {
      setIsSessionFinished(true);
      setSessionDurationSec(Math.round((Date.now() - sessionStartTime) / 1000));
    }
  };

  // بازگشت به صفحه قبل در روش صفحه به صفحه
  const handlePreviousPage = () => {
    if (currentPageIndex > 0) {
      stopAudio();
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  // تایید آیه کاربر و رفتن به آیه بعد
  const handleCompleteUserTurn = (wasMastered = true) => {
    isExplicitlyRecordingRef.current = false;
    accumulatedTranscriptRef.current = '';
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);

    if (wasMastered) {
      setMasteredCount((prev) => prev + 1);
    } else {
      setReviewedCount((prev) => prev + 1);
    }

    advanceToNextVerse();
  };

  // ثبت پاسخ موفق سرعتی در روش مسابقه‌ای
  const handleCompetitiveSuccess = () => {
    stopAudio();
    setIsTimerRunning(false);
    isExplicitlyRecordingRef.current = false;
    accumulatedTranscriptRef.current = '';
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);

    const speedBonus = timeLeft * 5;
    const streakBonus = Math.min(competitiveStreak, 5) * 20;
    const pointsEarned = 100 + speedBonus + streakBonus;
    const newStreak = competitiveStreak + 1;

    setCompetitiveScore((prev) => prev + pointsEarned);
    setCompetitiveStreak(newStreak);
    setMaxCompetitiveStreak((prev) => Math.max(prev, newStreak));
    setMasteredCount((prev) => prev + 1);

    advanceToNextVerse();
  };

  // ثبت انصراف یا تسلیم در سوال مسابقه‌ای
  const handleCompetitiveStuck = () => {
    stopAudio();
    setIsTimerRunning(false);
    setCompetitiveStreak(0);
    setCompetitiveRevealed(true);
    setReviewedCount((prev) => prev + 1);
  };

  // رفتن به آیه بعد
  const advanceToNextVerse = () => {
    stopAudio();
    if (currentVerseIndex + 1 < sessionVerses.length) {
      setCurrentVerseIndex((prev) => prev + 1);
    } else {
      // پایان جلسه
      setIsSessionFinished(true);
      setSessionDurationSec(Math.round((Date.now() - sessionStartTime) / 1000));
    }
  };

  // بازگشت به آیه قبل
  const handlePreviousVerse = () => {
    if (currentVerseIndex > 0) {
      stopAudio();
      setCurrentVerseIndex((prev) => prev - 1);
    }
  };

  // خروج از جلسه
  const handleExitSession = () => {
    stopAudio();
    isExplicitlyRecordingRef.current = false;
    accumulatedTranscriptRef.current = '';
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    setIsSessionActive(false);
    setIsSessionFinished(false);
  };

  // استخراج کلمه اول برای راهنمایی در روش آیه به آیه
  const firstWordHint = useMemo(() => {
    if (!activeVerse) return '';
    const words = activeVerse.textArabic.trim().split(/\s+/);
    return words.slice(0, 2).join(' ') + ' …';
  }, [activeVerse]);

  // سرنخ آیه اول برای چالش اتصال صفحات در روش صفحه به صفحه
  const pageFirstVerse = currentPageVerses[0];
  const pageFirstWordHint = useMemo(() => {
    if (!pageFirstVerse) return '';
    const words = pageFirstVerse.textArabic.trim().split(/\s+/);
    return words.slice(0, 3).join(' ') + ' …';
  }, [pageFirstVerse]);

  // سرنخ آیه اول مقطع برای روش ۵: مقطع به مقطع
  const sectionFirstVerse = activeSection?.verses?.[0];
  const sectionFirstWordHint = useMemo(() => {
    if (!sectionFirstVerse) return '';
    const words = sectionFirstVerse.textArabic.trim().split(/\s+/);
    return words.slice(0, 3).join(' ') + ' …';
  }, [sectionFirstVerse]);

  return (
    <div className="space-y-4 select-none max-w-2xl mx-auto w-full max-w-full overflow-x-hidden min-w-0" dir="rtl">
      {/* سربرگ خلوت و تب‌های اصلی */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-slate-800 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={isSessionActive ? handleExitSession : onBack}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
            title="بازگشت"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
              <Mic className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 animate-pulse" />
              <span>مباحثه صوتی هوشمند (هم‌مباحثه)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              تمرین تعاملی آیه به آیه و تثبیت شنیداری و گفتاری
            </p>
          </div>
        </div>

        {/* دکمه انتخاب سوره */}
        <button
          type="button"
          onClick={() => setIsSurahPickerOpen(true)}
          disabled={isSessionActive}
          className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shadow-2xs hover:border-emerald-500 transition-all cursor-pointer active:scale-95 shrink-0 disabled:opacity-50"
        >
          <span>سوره {currentSurah.nameArabic}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* الف) صفحه تنظیمات و انتخاب روش مباحثه (پیش از شروع جلسه) */}
      {/* ------------------------------------------------------------- */}
      {!isSessionActive ? (
        <div className="space-y-4 animate-fadeIn">
          {/* بخش انتخاب ۵ روش مباحثه */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-2.5">
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>روش مباحثه را انتخاب کنید:</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                ۵ متد تخصصی
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* روش ۱: آیه به آیه */}
              <div
                onClick={() => setDiscussionMode('verse_by_verse')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  discussionMode === 'verse_by_verse'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 text-slate-900 dark:text-slate-100'
                    : 'border-stone-200 dark:border-slate-800 hover:border-emerald-400 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    discussionMode === 'verse_by_verse'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold">۱. آیه به آیه (نوبتی)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                      فعال
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    یک آیه سیستم با ترتیل می‌خواند و آیه بعد را شما می‌خوانید.
                  </p>
                </div>
              </div>

              {/* روش ۲: صفحه به صفحه */}
              <div
                onClick={() => setDiscussionMode('page_by_page')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  discussionMode === 'page_by_page'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 text-slate-900 dark:text-slate-100'
                    : 'border-stone-200 dark:border-slate-800 hover:border-emerald-400 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    discussionMode === 'page_by_page'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Bookmark className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold">۲. صفحه به صفحه</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                      فعال
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    مرور کامل صفحه مصحف، تلاوت نوبتی و آزمایش پیوستگی سرصفحه‌ها.
                  </p>
                </div>
              </div>

              {/* روش ۳: مباحثه تکمیلی */}
              <div
                onClick={() => setDiscussionMode('completion')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  discussionMode === 'completion'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 text-slate-900 dark:text-slate-100'
                    : 'border-stone-200 dark:border-slate-800 hover:border-emerald-400 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    discussionMode === 'completion'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold">۳. مباحثه تکمیلی (اکمال)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                      فعال
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    سیستم ابتدای آیه را تلاوت کرده و شما ادامه آیه را کامل می‌کنید.
                  </p>
                </div>
              </div>

              {/* روش ۴: روش مسابقه‌ای */}
              <div
                onClick={() => setDiscussionMode('competitive')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  discussionMode === 'competitive'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 text-slate-900 dark:text-slate-100'
                    : 'border-stone-200 dark:border-slate-800 hover:border-emerald-400 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    discussionMode === 'competitive'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Zap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold">۴. روش مسابقه‌ای (چالشی)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                      فعال
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    شمارش معکوس زمان، ثبت زنجیره تسلط و سنجش سرعت پاسخگویی.
                  </p>
                </div>
              </div>

              {/* روش ۵: مقطع به مقطع */}
              <div
                onClick={() => setDiscussionMode('thematic')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 sm:col-span-2 ${
                  discussionMode === 'thematic'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 text-slate-900 dark:text-slate-100'
                    : 'border-stone-200 dark:border-slate-800 hover:border-emerald-400 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    discussionMode === 'thematic'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold">۵. مقطع به مقطع (محتوامحور)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold">
                      فعال
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    مباحثه دسته‌های آیات بر مبنای سیر مفهومی، سیاق آیات یا رکوعات قرآنی.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* بخش انتخاب محدوده آیات و تنظیمات جلسه */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-4">
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>محدوده و تنظیمات جلسه</span>
            </span>

            {/* انتخاب بازه آیه یا بازه صفحه */}
            {discussionMode === 'page_by_page' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                      از صفحه مصحف:
                    </label>
                    <select
                      value={selectedStartPage}
                      onChange={(e) => setSelectedStartPage(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      {surahPages.map((pageNum) => (
                        <option key={pageNum} value={pageNum}>
                          صفحه {toPersianDigits(pageNum)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                      تا صفحه مصحف:
                    </label>
                    <select
                      value={selectedEndPage}
                      onChange={(e) => setSelectedEndPage(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      {surahPages.map((pageNum) => (
                        <option key={pageNum} value={pageNum}>
                          صفحه {toPersianDigits(pageNum)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span>تعداد صفحات انتخابی:</span>
                  <span>{toPersianDigits(sessionPages.length)} صفحه مصحف</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                    از آیه:
                  </label>
                  <select
                    value={startVerse}
                    onChange={(e) => setStartVerse(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    {Array.from({ length: currentSurah.versesCount || 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        آیه {toPersianDigits(num)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                    تا آیه:
                  </label>
                  <select
                    value={endVerse}
                    onChange={(e) => setEndVerse(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    {Array.from({ length: currentSurah.versesCount || 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        آیه {toPersianDigits(num)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* انتخاب قاری هم‌مباحثه */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                قاری هم‌مباحثه (صدای سیستم):
              </label>
              <select
                value={selectedReciterId}
                onChange={(e) => setSelectedReciterId(e.target.value as ReciterId)}
                className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                {(Object.keys(RECITER_NAMES) as ReciterId[]).map((id) => (
                  <option key={id} value={id}>
                    {RECITER_NAMES[id].name} ({RECITER_NAMES[id].title})
                  </option>
                ))}
              </select>
            </div>

            {/* تنظیمات شروع در روش‌های مختلف */}
            {discussionMode === 'completion' ? (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 dark:text-slate-400 block font-bold">
                  میزان فراز ابتدایی سیستم (درجه سختی اکمال):
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletionSplit('half')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      completionSplit === 'half'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="block font-black">نیمی از آیه</span>
                    <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">متعادل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompletionSplit('first_words')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      completionSplit === 'first_words'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="block font-black">۳ کلمه اول</span>
                    <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">چالش بالا</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompletionSplit('two_thirds')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      completionSplit === 'two_thirds'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="block font-black">دو سوم آیه</span>
                    <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">مرور پایان آیات</span>
                  </button>
                </div>
              </div>
            ) : discussionMode === 'competitive' ? (
              <div className="space-y-3">
                {/* انتخاب زمان هر سوال */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                    زمان پاسخگویی به هر سوال (ثانیه):
                  </label>
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                    {[15, 20, 30].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setCompetitiveTimeLimit(sec)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          competitiveTimeLimit === sec
                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500'
                            : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="block font-black">{toPersianDigits(sec)} ثانیه</span>
                        <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">
                          {sec === 15 ? 'سرعتی و هیجانی' : sec === 20 ? 'استاندارد مسابقات' : 'فرصت بیشتر'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* انتخاب نوع چالش مسابقه */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                    نوع چالش مسابقه‌ای:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCompetitiveChallengeType('next_verse')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        competitiveChallengeType === 'next_verse'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500'
                          : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-black">تلاوت آیه بعد</span>
                      <span className="text-[10px] opacity-75 font-normal block mt-0.5">زنجیره آیات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompetitiveChallengeType('speed_completion')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        competitiveChallengeType === 'speed_completion'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500'
                          : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-black">اکمال سرعتی</span>
                      <span className="text-[10px] opacity-75 font-normal block mt-0.5">فراز ناقص</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : discussionMode === 'thematic' ? (
              <div className="space-y-3">
                {/* اندازه هر مقطع */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                    حجم هر مقطع محتوایی (تعداد آیات در هر فراز):
                  </label>
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                    {[3, 5, 7].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSectionPassageSize(size)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          sectionPassageSize === size
                            ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                            : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="block font-black">{toPersianDigits(size)} آیه</span>
                        <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">
                          {size === 3 ? 'فرازهای کوتاه' : size === 5 ? 'سیاق استاندارد' : 'مقطع طولانی'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* شیوه اجرای مقطع */}
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">
                    نحوه مباحثه مقاطع:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setThematicTurnMode('alternating')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        thematicTurnMode === 'alternating'
                          ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                          : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-black">نوبتی (سیستم / شما)</span>
                      <span className="text-[10px] opacity-75 font-normal block mt-0.5">یک مقطع سیستم، یک مقطع شما</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThematicTurnMode('user_recall')}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        thematicTurnMode === 'user_recall'
                          ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                          : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="block font-black">تمام مقاطع با شما</span>
                      <span className="text-[10px] opacity-75 font-normal block mt-0.5">تلاوت کامل با راهنما</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center justify-between">
                  <span>تعداد مقاطع استخراج‌شده:</span>
                  <span>{toPersianDigits(thematicSections.length)} مقطع مفهومی</span>
                </div>
              </div>
            ) : (
              /* شروع با چه کسی باشد؟ */
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5 font-bold">
                  {discussionMode === 'page_by_page'
                    ? 'صفحه اول را چه کسی تلاوت کند؟'
                    : 'آیه اول را چه کسی بخواند؟'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStarterTurn('system')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      starterTurn === 'system'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                    <span>
                      {discussionMode === 'page_by_page' ? 'صفحه اول با سیستم' : 'سیستم شروع کند'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStarterTurn('user')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      starterTurn === 'user'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>
                      {discussionMode === 'page_by_page' ? 'صفحه اول با من' : 'من شروع کنم'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* گزینه‌های کمکی */}
            <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hideUserText}
                  onChange={(e) => setHideUserText(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  {discussionMode === 'page_by_page'
                    ? 'مخفی‌سازی آیات در صفحه کاربر (تلاوت از حفظ)'
                    : 'مخفی‌سازی متن آیه کاربر (تلاوت بدون نگاه به متن)'}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hideSystemText}
                  onChange={(e) => setHideSystemText(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>مخفی‌سازی متن سیستم (تقویت تمرکز شنیداری)</span>
              </label>
            </div>

            {/* تنظیم هوشمند ارزیابی صوت و صحت‌سنجی */}
            <div className="pt-3 border-t border-stone-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>دقت ارزیابی و تصحیح هوشمند صدای شما:</span>
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  {strictnessLevel === 'easy'
                    ? 'آسان (قبولی بالای ۷۰٪)'
                    : strictnessLevel === 'normal'
                    ? 'استاندارد (قبولی بالای ۸۲٪)'
                    : 'سخت‌گیرانه (قبولی بالای ۹۲٪)'}
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStrictnessLevel('easy')}
                  className={`p-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                    strictnessLevel === 'easy'
                      ? 'border border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500'
                      : 'border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                  }`}
                >
                  <span className="block font-black">آسان</span>
                  <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">اغماض در لهجه و تجوید</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStrictnessLevel('normal')}
                  className={`p-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                    strictnessLevel === 'normal'
                      ? 'border border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500'
                      : 'border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                  }`}
                >
                  <span className="block font-black">استاندارد</span>
                  <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">تطابق دقیق کلمات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStrictnessLevel('strict')}
                  className={`p-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                    strictnessLevel === 'strict'
                      ? 'border border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500'
                      : 'border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                  }`}
                >
                  <span className="block font-black">مسابقه‌ای</span>
                  <span className="text-[10px] opacity-75 font-normal block mt-0.5 truncate">بدون کلمه جاافتاده</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={soundFeedbackEnabled}
                    onChange={(e) => setSoundFeedbackEnabled(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>پخش نوای صوتی تایید درستی تلاوت (افکت صوتی)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoAdvanceOnPass}
                    onChange={(e) => setAutoAdvanceOnPass(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>برجسته‌سازی خودکار دکمه تایید پس از تلاوت صحیح</span>
                </label>
              </div>

              {/* انتخاب لهجه مدل تشخیص گفتار مرورگر */}
              <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  لهجه مدل شنیداری مرورگر:
                </span>
                <div className="flex items-center gap-1.5 font-bold flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSpeechDialect('ar-EG')}
                    className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      speechDialect === 'ar-EG'
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                        : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    مصر (استاندارد ترتیل قاریان)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeechDialect('ar-SA')}
                    className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      speechDialect === 'ar-SA'
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                        : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    حجاز / سعودی
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* دکمه شروع مباحثه */}
          <button
            type="button"
            onClick={handleStartSession}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4 animate-bounce" />
            <span>
              {discussionMode === 'page_by_page'
                ? `شروع مباحثه صفحه به صفحه (${toPersianDigits(sessionPages.length)} صفحه مصحف)`
                : discussionMode === 'completion'
                ? `شروع مباحثه تکمیلی (${toPersianDigits(sessionVerses.length)} آیه)`
                : discussionMode === 'competitive'
                ? `شروع مسابقه سرعتی (${toPersianDigits(sessionVerses.length)} سوال با زمان‌سنج ${toPersianDigits(competitiveTimeLimit)}ث)`
                : discussionMode === 'thematic'
                ? `شروع مباحثه مقطع‌به‌مقطع (${toPersianDigits(thematicSections.length)} مقطع مفهومی)`
                : `شروع جلسه مباحثه (${toPersianDigits(sessionVerses.length)} آیه)`}
            </span>
          </button>
        </div>
      ) : discussionMode === 'page_by_page' ? (
        /* ============================================================ */
        /* روش ۲: محیط اختصاصی مباحثه صفحه به صفحه */
        /* ============================================================ */
        <div className="space-y-4 animate-fadeIn">
            {/* نوار وضعیت بالای جلسه صفحه به صفحه */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400">
                صفحه {toPersianDigits(currentPageIndex + 1)} از {toPersianDigits(sessionPages.length)} (ص {toPersianDigits(currentPageNumber)})
              </span>

              {/* نشانگر نوبت جاری */}
              <div
                className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all text-[11px] sm:text-xs ${
                  isSystemPageTurn
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse'
                }`}
              >
                {isSystemPageTurn ? <Bot className="w-3.5 h-3.5 shrink-0" /> : <User className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {isSystemPageTurn ? 'نوبت سیستم (ترتیل)' : 'نوبت شما (تلاوت صفحه)'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleExitSession}
                className="text-stone-400 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                title="پایان مباحثه"
              >
                خروج
              </button>
            </div>

            {/* محتوای نوبت سیستم یا نوبت کاربر در روش صفحه به صفحه */}
            {isSystemPageTurn ? (
              /* نوبت سیستم در صفحه جاری */
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 font-black text-xs flex items-center justify-center">
                      {toPersianDigits(currentPageNumber)}
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        ترتیل پیوسته هم‌مباحثه: صفحه {toPersianDigits(currentPageNumber)}
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        سوره {currentSurah.nameArabic} • آیه {toPersianDigits(currentPageVerses[systemPageVerseIndex]?.verseNumber || 1)} در حال تلاوت
                      </span>
                    </div>
                  </div>

                  {/* دکمه‌های کنترل ترتیل صفحه */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleTogglePageAudio}
                      className="p-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                      title={isPlayingAudio ? 'توقف موقت' : 'ادامه پخش'}
                    >
                      {isPlayingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => playPageVerseAudio(0)}
                      className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-stone-200 text-xs font-bold transition-all cursor-pointer"
                      title="تکرار صفحه از ابتدا"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* موج صوتی نمایشی */}
                <div className="flex items-center justify-center gap-1 h-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full bg-teal-600 transition-all ${
                        isPlayingAudio ? 'animate-pulse' : 'h-1.5 opacity-30'
                      }`}
                      style={{
                        height: isPlayingAudio ? `${Math.sin(i) * 14 + 14}px` : '4px',
                        animationDelay: `${i * 120}ms`,
                      }}
                    />
                  ))}
                </div>

                {/* کادر آیات صفحه مصحف */}
                <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/20 dark:bg-slate-800/40 border border-teal-500/20 max-h-80 overflow-y-auto space-y-2 text-right">
                  {currentPageVerses.map((v, vIdx) => {
                    const isCurrentPlaying = vIdx === systemPageVerseIndex;
                    return (
                      <div
                        key={v.id || v.verseNumber}
                        onClick={() => playPageVerseAudio(vIdx)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isCurrentPlaying
                            ? 'border-teal-500 bg-white dark:bg-slate-800 shadow-xs ring-1 ring-teal-500/30'
                            : 'border-transparent hover:bg-white/60 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-teal-700 dark:text-teal-300">
                            آیه {toPersianDigits(v.verseNumber)}
                          </span>
                          {isCurrentPlaying && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-600 text-white font-bold flex items-center gap-1">
                              <Volume2 className="w-3 h-3 animate-bounce" />
                              <span>در حال تلاوت</span>
                            </span>
                          )}
                        </div>
                        {!hideSystemText ? (
                          <div
                            className="text-base sm:text-lg font-normal leading-[2.3] text-teal-950 dark:text-teal-100"
                            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                            dir="rtl"
                          >
                            «{v.textArabic}»
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 py-1">
                            متن آیه جهت تقویت تمرکز شنیداری پنهان است (از تنظیمات قابل نمایش است)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* بنر اتمام صفحه یا دکمه انتقال نوبت */}
                <div className="pt-2 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => advanceToNextPage(true)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
                  >
                    <span>نوبت من است (رفتن به صفحه بعد)</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* نوبت کاربر در صفحه جاری */
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center">
                      {toPersianDigits(currentPageNumber)}
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        تلاوت از حفظ: صفحه {toPersianDigits(currentPageNumber)} مصحف شریف
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        سوره {currentSurah.nameArabic} • {toPersianDigits(currentPageVerses.length)} آیه (آیات {toPersianDigits(currentPageVerses[0]?.verseNumber || 1)} تا {toPersianDigits(currentPageVerses[currentPageVerses.length - 1]?.verseNumber || 1)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* چالش اتصال صفحات (سرصفحه) */}
                <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/30 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">
                      چالش اتصال صفحات:
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      {showPageHeaderHint
                        ? `سرنخ آیه اول این صفحه: «${pageFirstWordHint}»`
                        : 'آیا آیه اول این صفحه را در ذهن دارید؟'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPageHeaderHint(!showPageHeaderHint)}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold shrink-0 cursor-pointer hover:bg-amber-100 transition-all"
                  >
                    {showPageHeaderHint ? 'بستن' : 'سرنخ آیه اول'}
                  </button>
                </div>

                {/* نمایش آیات صفحه با قابلیت راهنمایی لمسی */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>آیات این صفحه ({toPersianDigits(currentPageVerses.length)} آیه):</span>
                    <button
                      type="button"
                      onClick={() => setShowFullPagePrompt(!showFullPagePrompt)}
                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showFullPagePrompt ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showFullPagePrompt ? 'پنهان‌سازی مجدد' : 'نمایش متن کل صفحه (راهنما)'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700/60 max-h-80 overflow-y-auto space-y-2.5">
                    {currentPageVerses.map((verse) => {
                      const isRevealed = showFullPagePrompt || revealedVerseNumbers.includes(verse.verseNumber) || !hideUserText;
                      return (
                        <div
                          key={verse.id || verse.verseNumber}
                          onClick={() => {
                            if (!isRevealed) {
                              setRevealedVerseNumbers((prev) => [...prev, verse.verseNumber]);
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all text-right ${
                            isRevealed
                              ? 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-800'
                              : 'bg-emerald-500/5 border-dashed border-emerald-500/30 cursor-pointer hover:bg-emerald-500/10'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-1 text-[11px] text-slate-400">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              آیه {toPersianDigits(verse.verseNumber)}
                            </span>
                            {!isRevealed && (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                لمس برای دیدن راهنما
                              </span>
                            )}
                          </div>

                          {isRevealed ? (
                            <div
                              className="text-base sm:text-lg font-normal leading-[2.2] text-slate-800 dark:text-slate-100"
                              style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                              dir="rtl"
                            >
                              «{verse.textArabic}»
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 py-1">
                              این آیه برای سنجش حفظ مخفی است… (برای مشاهده لمس کنید)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* کنترل میکروفون و ارزیابی هوشمند صحت تلاوت صفحه */}
                <div className="pt-2">
                  <SmartRecitationFeedbackPanel
                    evaluation={recitationEvaluation}
                    transcribedText={transcribedText}
                    isRecording={isRecording}
                    onToggleRecording={toggleRecording}
                    onRetry={handleRetryRecording}
                    onAccept={() => advanceToNextPage(true)}
                    onReject={() => advanceToNextPage(false)}
                    acceptLabel="صفحه را مسلط خواندم (صفحه بعد)"
                    rejectLabel="نیاز به تمرین این صفحه"
                    targetText={currentPageVerses.map((v) => v.textArabic).join(' ')}
                    surahName={currentSurah.nameArabic}
                    verseNumber={`صفحه ${toPersianDigits(currentPageNumber)}`}
                  />
                </div>
              </div>
            )}

            {/* نوار جابجایی پایین صفحه در روش صفحه به صفحه */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={currentPageIndex === 0}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>صفحه قبل</span>
              </button>

              <button
                type="button"
                onClick={() => advanceToNextPage(true)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>رد شدن به صفحه بعد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : discussionMode === 'completion' ? (
          /* ============================================================ */
          /* روش ۳: محیط اختصاصی مباحثه تکمیلی (اکمال فراز) */
          /* ============================================================ */
          <div className="space-y-4 animate-fadeIn">
            {/* نوار وضعیت بالای جلسه مباحثه تکمیلی */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400">
                آیه {toPersianDigits(currentVerseIndex + 1)} از {toPersianDigits(sessionVerses.length)}
              </span>

              {/* نشانگر روش تکمیلی */}
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 text-[11px] sm:text-xs">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>مباحثه تکمیلی (اکمال)</span>
              </div>

              <button
                type="button"
                onClick={handleExitSession}
                className="text-stone-400 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                title="پایان مباحثه"
              >
                خروج
              </button>
            </div>

            {/* کارت اصلی مباحثه تکمیلی */}
            {activeVerse && activeVerseSplit && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-4">
                {/* بخش سربرگ آیه و دکمه تطبیق صوت */}
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center">
                      {toPersianDigits(activeVerse.verseNumber)}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      سوره {currentSurah.nameArabic} • آیه {toPersianDigits(activeVerse.verseNumber)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPlayingAudio) {
                        stopAudio();
                      } else {
                        playVerseAudio(activeVerse.verseNumber);
                      }
                    }}
                    className="p-1.5 px-2.5 rounded-xl bg-teal-50 dark:bg-slate-800 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5 hover:bg-teal-100 transition-all cursor-pointer"
                    title={isPlayingAudio ? 'توقف صوت' : 'شنیدن ترتیل کامل آیه جهت تطبیق'}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current text-rose-500" />
                        <span className="text-rose-500">توقف ترتیل</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>شنیدن ترتیل آیه (تطبیق)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* ۱. فراز ابتدایی آیه (آغاز توسط سیستم) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/40 dark:bg-slate-800/60 border border-teal-500/25 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>فراز ابتدایی آیه (هم‌مباحثه خواند):</span>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold">
                      {toPersianDigits(activeVerseSplit.promptWords.length)} کلمه
                    </span>
                  </div>

                  <div
                    className="text-lg sm:text-xl md:text-2xl font-normal leading-[2.4] text-teal-950 dark:text-teal-100 text-center py-2"
                    style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                    dir="rtl"
                  >
                    «{activeVerseSplit.promptText} …»
                  </div>
                </div>

                {/* ۲. بخش اکمال فراز (نوبت تلاوت شما از حفظ) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/30 dark:bg-slate-800/40 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>اکنون ادامه و پایان آیه را کامل کنید:</span>
                    </span>

                    {/* دکمه‌های راهنمای کلمه به کلمه */}
                    <div className="flex items-center gap-1.5">
                      {revealedCompletionWordCount < activeVerseSplit.completionWords.length && !isCompletionFullRevealed && (
                        <button
                          type="button"
                          onClick={() => setRevealedCompletionWordCount((prev) => Math.min(prev + 1, activeVerseSplit.completionWords.length))}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <HelpCircle className="w-3 h-3 text-amber-500" />
                          <span>+۱ کلمه راهنما</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsCompletionFullRevealed(!isCompletionFullRevealed)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold hover:bg-stone-100 transition-all cursor-pointer flex items-center gap-1"
                      >
                        {isCompletionFullRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isCompletionFullRevealed ? 'مخفی‌سازی' : 'نمایش کل اکمال'}</span>
                      </button>
                    </div>
                  </div>

                  {/* کادر متن اکمال با نمایش ماسک‌شده یا کلمه به کلمه */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-amber-500/40 min-h-20 flex items-center justify-center text-center">
                    {isCompletionFullRevealed ? (
                      <div
                        className="text-lg sm:text-xl md:text-2xl font-normal leading-[2.4] text-emerald-800 dark:text-emerald-200"
                        style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                        dir="rtl"
                      >
                        «… {activeVerseSplit.completionText}»
                      </div>
                    ) : revealedCompletionWordCount > 0 ? (
                      <div
                        className="text-lg sm:text-xl md:text-2xl font-normal leading-[2.4] text-slate-800 dark:text-slate-100"
                        style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                        dir="rtl"
                      >
                        «…{' '}
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                          {activeVerseSplit.completionWords.slice(0, revealedCompletionWordCount).join(' ')}
                        </span>{' '}
                        <span className="text-slate-400 font-sans text-sm tracking-widest">
                          {Array.from({ length: activeVerseSplit.completionWords.length - revealedCompletionWordCount }).map(() => '● ').join('')}
                        </span>
                        »
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        ادامه آیه را با صوت از حفظ تلاوت کنید…
                        <br />
                        <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
                          (شامل {toPersianDigits(activeVerseSplit.completionWords.length)} کلمه تا پایان آیه)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ۳. میکروفون و ارزیابی هوشمند صحت اکمال فراز */}
                <div className="pt-2">
                  <SmartRecitationFeedbackPanel
                    evaluation={recitationEvaluation}
                    transcribedText={transcribedText}
                    isRecording={isRecording}
                    onToggleRecording={toggleRecording}
                    onRetry={handleRetryRecording}
                    onAccept={() => handleCompleteUserTurn(true)}
                    onReject={() => handleCompleteUserTurn(false)}
                    acceptLabel="صحیح و کامل خواندم (آیه بعد)"
                    rejectLabel="نیاز به تمرین"
                    targetText={activeVerseSplit.completionText}
                    surahName={currentSurah.nameArabic}
                    verseNumber={toPersianDigits(activeVerse?.verseNumber || 1)}
                    surahId={currentSurah.id}
                    rawVerseNumber={activeVerse?.verseNumber}
                  />
                </div>
              </div>
            )}

            {/* نوار جابجایی پایین صفحه در روش تکمیلی */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handlePreviousVerse}
                disabled={currentVerseIndex === 0}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>آیه قبل</span>
              </button>

              <button
                type="button"
                onClick={() => advanceToNextVerse()}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>رد شدن به آیه بعد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : discussionMode === 'competitive' ? (
          /* ============================================================ */
          /* روش ۴: محیط اختصاصی روش مسابقه‌ای (سرعتی و امتیازی) */
          /* ============================================================ */
          <div className="space-y-4 animate-fadeIn">
            {/* نوار وضعیت بالای جلسه مسابقه‌ای */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400">
                سوال {toPersianDigits(currentVerseIndex + 1)} از {toPersianDigits(sessionVerses.length)}
              </span>

              {/* نشانگر تایمر معکوس */}
              <div
                className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all text-[11px] sm:text-xs ${
                  timeLeft <= 5
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 animate-pulse'
                    : timeLeft <= 10
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>زمان: {toPersianDigits(timeLeft)} ثانیه</span>
              </div>

              {/* امتیاز و زنجیره */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="px-2 py-0.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1 text-[11px]">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{toPersianDigits(competitiveScore)}</span>
                </span>
                {competitiveStreak > 0 && (
                  <span className="px-1.5 py-0.5 rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30 flex items-center gap-0.5 animate-pulse text-[11px]">
                    <Zap className="w-3 h-3 text-orange-500 shrink-0" />
                    <span>{toPersianDigits(competitiveStreak)}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleExitSession}
                  className="text-stone-400 hover:text-rose-500 transition-colors cursor-pointer text-xs mr-1"
                  title="پایان مسابقه"
                >
                  خروج
                </button>
              </div>
            </div>

            {/* نوار پویای پیشرفت زمان */}
            <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  timeLeft <= 5 ? 'bg-rose-500' : timeLeft <= 10 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (timeLeft / competitiveTimeLimit) * 100))}%` }}
              />
            </div>

            {/* کارت اصلی چالش مسابقه‌ای */}
            {activeVerse && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-4">
                {/* بخش سربرگ سوال */}
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black text-xs flex items-center justify-center">
                      {toPersianDigits(activeVerse.verseNumber)}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      سوره {currentSurah.nameArabic} • آیه {toPersianDigits(activeVerse.verseNumber)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPlayingAudio) {
                        stopAudio();
                      } else {
                        playVerseAudio(activeVerse.verseNumber);
                      }
                    }}
                    className="p-1.5 px-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 hover:bg-stone-200 transition-all cursor-pointer"
                    title={isPlayingAudio ? 'توقف صوت' : 'شنیدن ترتیل این آیه'}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current text-rose-500" />
                        <span className="text-rose-500">توقف ترتیل</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>شنیدن ترتیل آیه</span>
                      </>
                    )}
                  </button>
                </div>

                {/* صورت چالش مسابقه بر اساس نوع چالش */}
                {competitiveChallengeType === 'next_verse' ? (
                  /* چالش ۱: تلاوت آیه بعد بر مبنای آیه قبل */
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-teal-50/40 dark:bg-slate-800/60 border border-teal-500/25 space-y-1 text-center">
                      <span className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
                        {previousVerse
                          ? `آیه مبنا (آیه ${toPersianDigits(previousVerse.verseNumber)}):`
                          : `آغاز سوره مبارکه ${currentSurah.nameArabic}:`}
                      </span>
                      {previousVerse ? (
                        <div
                          className="text-base sm:text-lg font-normal leading-[2.2] text-teal-950 dark:text-teal-100 py-1"
                          style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                          dir="rtl"
                        >
                          «{previousVerse.textArabic}»
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-slate-500 py-2">
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/30 dark:bg-slate-800/40 border border-amber-500/30 text-center space-y-2">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>بلافاصله آیه بعد (آیه {toPersianDigits(activeVerse.verseNumber)}) را از حفظ بخوانید:</span>
                      </span>

                      {!isTimeUp && !competitiveRevealed ? (
                        <div className="py-4 px-3 rounded-xl border border-dashed border-amber-500/40 bg-white/70 dark:bg-slate-900/60 text-xs sm:text-sm text-slate-500 animate-pulse">
                          آیه را با صوت بخوانید و پیش از اتمام {toPersianDigits(timeLeft)} ثانیه دکمه تایید را لمس کنید!
                        </div>
                      ) : (
                        <div className="space-y-2 animate-fadeIn">
                          <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            {isTimeUp ? 'زمان این سوال به پایان رسید!' : 'پاسخ برای مرور شما آشکار شد:'}
                          </div>
                          <div
                            className="text-lg sm:text-xl font-normal leading-[2.4] text-slate-900 dark:text-slate-100 py-2"
                            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                            dir="rtl"
                          >
                            «{activeVerse.textArabic}»
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* چالش ۲: اکمال سرعتی فراز ناقص */
                  activeVerseSplit && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl bg-teal-50/40 dark:bg-slate-800/60 border border-teal-500/25 space-y-1 text-center">
                        <span className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
                          ابتدای آیه (سیستم خواند):
                        </span>
                        <div
                          className="text-lg sm:text-xl font-normal leading-[2.2] text-teal-950 dark:text-teal-100 py-1"
                          style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                          dir="rtl"
                        >
                          «{activeVerseSplit.promptText} …»
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-50/30 dark:bg-slate-800/40 border border-amber-500/30 text-center space-y-2">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>ادامه آیه را سریعاً از حفظ کامل کنید:</span>
                        </span>

                        {!isTimeUp && !competitiveRevealed ? (
                          <div className="py-4 px-3 rounded-xl border border-dashed border-amber-500/40 bg-white/70 dark:bg-slate-900/60 text-xs sm:text-sm text-slate-500 animate-pulse">
                            «… [ادامه آیه شامل {toPersianDigits(activeVerseSplit.completionWords.length)} کلمه تا پایان]»
                          </div>
                        ) : (
                          <div className="space-y-2 animate-fadeIn">
                            <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                              {isTimeUp ? 'زمان این سوال به پایان رسید!' : 'پاسخ برای مرور شما آشکار شد:'}
                            </div>
                            <div
                              className="text-lg sm:text-xl font-normal leading-[2.4] text-slate-900 dark:text-slate-100 py-2"
                              style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                              dir="rtl"
                            >
                              «… {activeVerseSplit.completionText}»
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* ارزیابی هوشمند صوت در مسابقه */}
                <div className="pt-2 space-y-3">
                  <SmartRecitationFeedbackPanel
                    evaluation={recitationEvaluation}
                    transcribedText={transcribedText}
                    isRecording={isRecording}
                    onToggleRecording={toggleRecording}
                    onRetry={handleRetryRecording}
                    onAccept={handleCompetitiveSuccess}
                    isCompetitive={true}
                    targetText={currentTargetRecitationText}
                    surahName={currentSurah.nameArabic}
                    verseNumber={toPersianDigits(activeVerse?.verseNumber || 1)}
                    surahId={currentSurah.id}
                    rawVerseNumber={activeVerse?.verseNumber}
                  />

                  {/* دکمه‌های تایید نتیجه مسابقه */}
                  {!isTimeUp && !competitiveRevealed ? (
                    <div className="flex items-center gap-2 pt-1 w-full max-w-sm mx-auto">
                      <button
                        type="button"
                        onClick={handleCompetitiveSuccess}
                        className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          تایید دستی (+{toPersianDigits(100 + timeLeft * 5 + Math.min(competitiveStreak, 5) * 20)} امتیاز)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCompetitiveStuck}
                        className="py-3.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="گیر کردم / مشاهده پاسخ"
                      >
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                        <span>تسلیم / پاسخ</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1 w-full max-w-sm mx-auto">
                      <button
                        type="button"
                        onClick={() => advanceToNextVerse()}
                        className="w-full py-3.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                      >
                        <span>رفتن به سوال بعد</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* نوار جابجایی پایین صفحه */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handlePreviousVerse}
                disabled={currentVerseIndex === 0}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>سوال قبل</span>
              </button>

              <button
                type="button"
                onClick={() => advanceToNextVerse()}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>رد شدن به سوال بعد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : discussionMode === 'thematic' ? (
          /* ============================================================ */
          /* روش ۵: محیط اختصاصی مباحثه مقطع به مقطع (محتوامحور) */
          /* ============================================================ */
          <div className="space-y-4 animate-fadeIn">
            {/* نوار وضعیت بالای جلسه مقطع به مقطع */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400">
                مقطع {toPersianDigits(currentSectionIndex + 1)} از {toPersianDigits(thematicSections.length)}
              </span>

              {/* نشانگر نوبت جاری */}
              <div
                className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all text-[11px] sm:text-xs ${
                  isSystemSectionTurn
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse'
                }`}
              >
                {isSystemSectionTurn ? <Bot className="w-3.5 h-3.5 shrink-0" /> : <User className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {isSystemSectionTurn
                    ? 'نوبت سیستم (ترتیل مقطع)'
                    : 'نوبت شما (تلاوت مقطع)'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleExitSession}
                className="text-stone-400 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                title="پایان مباحثه"
              >
                خروج
              </button>
            </div>

            {/* کارت اصلی مقطع جاری */}
            {activeSection && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-4">
                {/* سربرگ مقطع */}
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 font-black text-xs flex items-center justify-center">
                      {toPersianDigits(currentSectionIndex + 1)}
                    </span>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                        {activeSection.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        سوره {currentSurah.nameArabic} • {toPersianDigits(activeSection.verses.length)} آیه در این مقطع
                      </p>
                    </div>
                  </div>

                  {/* دکمه‌های صوتی مقطع */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleToggleSectionAudio}
                      className="p-1.5 px-3 rounded-xl bg-teal-50 dark:bg-slate-800 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5 hover:bg-teal-100 transition-all cursor-pointer"
                      title={isPlayingAudio ? 'توقف صوت' : 'پخش ترتیل پیوسته آیات مقطع'}
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current text-rose-500" />
                          <span className="text-rose-500">توقف ترتیل</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>پخش ترتیل مقطع</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => playSectionVerseAudio(0)}
                      className="p-1.5 rounded-xl bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 transition-all cursor-pointer"
                      title="پخش مجدد از آغاز مقطع"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* نمایش مقطع بر اساس نوبت سیستم یا کاربر */}
                {isSystemSectionTurn ? (
                  /* الف) نوبت سیستم در این مقطع */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-teal-700 dark:text-teal-400 font-bold px-1">
                      <div className="flex items-center gap-1.5">
                        <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                        <span>
                          {isPlayingAudio
                            ? `سیستم در حال ترتیل آیه ${toPersianDigits(
                                activeSection.verses[systemSectionVerseIndex]?.verseNumber || ''
                              )} است…`
                            : 'تلاوت پیوسته آیات مقطع توسط هم‌مباحثه:'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal">
                        (برای شنیدن هر آیه روی آن کلیک کنید)
                      </span>
                    </div>

                    {/* لیست آیات مقطع */}
                    {!hideSystemText ? (
                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {activeSection.verses.map((verse, vIdx) => {
                          const isRecitingThis =
                            isPlayingAudio && systemSectionVerseIndex === vIdx;
                          return (
                            <div
                              key={verse.verseNumber}
                              onClick={() => playSectionVerseAudio(vIdx)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                isRecitingThis
                                  ? 'border-teal-500 bg-teal-500/10 ring-2 ring-teal-500/30 shadow-xs'
                                  : 'border-stone-100 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-800/40 hover:border-teal-300'
                              }`}
                            >
                              <span
                                className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                  isRecitingThis
                                    ? 'bg-teal-600 text-white animate-pulse'
                                    : 'bg-stone-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {toPersianDigits(verse.verseNumber)}
                              </span>

                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-base sm:text-lg leading-[2.3] text-slate-900 dark:text-slate-100"
                                  style={{
                                    fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif",
                                  }}
                                  dir="rtl"
                                >
                                  {verse.textArabic}
                                </div>
                              </div>

                              {isRecitingThis && (
                                <div className="flex items-center gap-0.5 shrink-0 self-center">
                                  <div className="w-1 h-3 rounded-full bg-teal-500 animate-pulse" />
                                  <div className="w-1 h-5 rounded-full bg-teal-600 animate-pulse delay-75" />
                                  <div className="w-1 h-2 rounded-full bg-teal-400 animate-pulse delay-150" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-teal-50/30 dark:bg-slate-800/40 text-xs text-slate-400 text-center space-y-2">
                        <p>متن مقطع جهت تقویت حافظه شنیداری و دقت گوش دادن پنهان شده است.</p>
                        <p className="text-[11px] text-teal-600 dark:text-teal-400">
                          (به لحن، وقف و اتصال آیات مقطع توسط سیستم دقت فرمایید)
                        </p>
                      </div>
                    )}

                    {/* دکمه تحویل نوبت به کاربر برای مقطع بعد */}
                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => advanceToNextSection(true)}
                        className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <span>مقطع بعدی با من است (رفتن به مقطع بعد)</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ب) نوبت کاربر در این مقطع */
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/30 text-center space-y-1">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                        <Mic className="w-4 h-4 animate-pulse text-emerald-600" />
                        <span>
                          این مقطع ({toPersianDigits(activeSection.verses.length)} آیه پیوسته) را از حفظ تلاوت کنید:
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        آیات {toPersianDigits(activeSection.startVerse)} تا {toPersianDigits(activeSection.endVerse)} را بدون وقفه بخوانید.
                      </p>
                    </div>

                    {/* نمایش محتوای مقطع یا پنل راهنمایی */}
                    {!hideUserText || showFullSectionText ? (
                      /* متن آشکار مقطع */
                      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 animate-fadeIn">
                        {activeSection.verses.map((verse) => (
                          <div
                            key={verse.verseNumber}
                            className="p-3 rounded-2xl border border-stone-100 dark:border-slate-800 bg-stone-50/40 dark:bg-slate-800/30 flex items-start gap-2.5"
                          >
                            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-black flex items-center justify-center shrink-0">
                              {toPersianDigits(verse.verseNumber)}
                            </span>
                            <div
                              className="text-base sm:text-lg leading-[2.3] text-slate-900 dark:text-slate-100 flex-1"
                              style={{
                                fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif",
                              }}
                              dir="rtl"
                            >
                              {verse.textArabic}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* حالت مخفی‌سازی با راهنمای هوشمند */
                      <div className="p-4 sm:p-5 rounded-2xl border border-dashed border-emerald-500/30 bg-white/50 dark:bg-slate-900/40 space-y-3 text-center">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          متن آیات برای آزمون حفظ پنهان است. در صورت نیاز از سرنخ‌ها استفاده کنید:
                        </div>

                        {/* سرنخ آغاز مقطع */}
                        <div className="py-2.5 px-4 rounded-xl bg-emerald-500/10 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          سرآغاز مقطع: «{sectionFirstWordHint}»
                        </div>

                        {/* آیات آشکارشده به صورت تکی */}
                        {thematicRevealedVerseNumbers.length > 0 && (
                          <div className="space-y-2 text-right pt-2">
                            {activeSection.verses
                              .filter((v) => thematicRevealedVerseNumbers.includes(v.verseNumber))
                              .map((v) => (
                                <div
                                  key={v.verseNumber}
                                  className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-slate-800 border border-amber-500/20 text-xs text-slate-800 dark:text-slate-200"
                                >
                                  <span className="font-bold text-amber-700 dark:text-amber-400 ml-1">
                                    آیه {toPersianDigits(v.verseNumber)}:
                                  </span>
                                  <span>{v.textArabic}</span>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* دکمه‌های کمکی */}
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const nextUnrevealed = activeSection.verses.find(
                                (v) => !thematicRevealedVerseNumbers.includes(v.verseNumber)
                              );
                              if (nextUnrevealed) {
                                setThematicRevealedVerseNumbers((prev) => [
                                  ...prev,
                                  nextUnrevealed.verseNumber,
                                ]);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span>آشکارسازی آیه به آیه</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowFullSectionText(true)}
                            className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-500" />
                            <span>نمایش کامل متن مقطع</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* کنترل میکروفون و ارزیابی هوشمند مقطع */}
                    <div className="pt-2">
                      <SmartRecitationFeedbackPanel
                        evaluation={recitationEvaluation}
                        transcribedText={transcribedText}
                        isRecording={isRecording}
                        onToggleRecording={toggleRecording}
                        onRetry={handleRetryRecording}
                        onAccept={() => advanceToNextSection(true)}
                        onReject={() => advanceToNextSection(false)}
                        acceptLabel="تلاوت مسلط (مقطع بعد)"
                        rejectLabel="نیاز به تمرین این مقطع"
                        targetText={activeSection?.verses.map((v) => v.textArabic).join(' ')}
                        surahName={currentSurah.nameArabic}
                        verseNumber={activeSection?.title}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* نوار جابجایی پایین صفحه در روش مقطع به مقطع */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handlePreviousSection}
                disabled={currentSectionIndex === 0}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>مقطع قبل</span>
              </button>

              <button
                type="button"
                onClick={() => advanceToNextSection(true)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>رد شدن به مقطع بعد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* روش ۱: محیط اختصاصی مباحثه آیه به آیه */
          /* ============================================================ */
          <div className="space-y-4 animate-fadeIn">
            {/* نوار وضعیت بالای جلسه */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400">
                آیه {toPersianDigits(currentVerseIndex + 1)} از {toPersianDigits(sessionVerses.length)}
              </span>

              {/* نشانگر نوبت جاری */}
              <div
                className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all text-[11px] sm:text-xs ${
                  isSystemTurn
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse'
                }`}
              >
                {isSystemTurn ? <Bot className="w-3.5 h-3.5 shrink-0" /> : <User className="w-3.5 h-3.5 shrink-0" />}
                <span>{isSystemTurn ? 'نوبت سیستم' : 'نوبت شما'}</span>
              </div>

              <button
                type="button"
                onClick={handleExitSession}
                className="text-stone-400 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                title="پایان مباحثه"
              >
                خروج
              </button>
            </div>

            {/* کارت اصلی مباحثه */}
            {activeVerse && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-5">
                {/* بخش سربرگ آیه */}
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center">
                      {toPersianDigits(activeVerse.verseNumber)}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      سوره {currentSurah.nameArabic} • آیه {toPersianDigits(activeVerse.verseNumber)}
                    </span>
                  </div>

                  {isSystemTurn && (
                    <button
                      type="button"
                      onClick={() => playVerseAudio(activeVerse.verseNumber)}
                      className="p-1.5 rounded-xl bg-teal-50 dark:bg-slate-800 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1 hover:bg-teal-100 transition-all cursor-pointer"
                      title="تکرار تلاوت سیستم"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>تکرار صوت</span>
                    </button>
                  )}
                </div>

                {/* نمایش آیه بر اساس نوبت سیستم یا کاربر */}
                {isSystemTurn ? (
                  /* نوبت سیستم */
                  <div className="space-y-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-teal-700 dark:text-teal-400 font-bold">
                      <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
                      <span>
                        {isPlayingAudio ? 'در حال پخش ترتیل هم‌مباحثه…' : 'پایان تلاوت این آیه توسط سیستم'}
                      </span>
                    </div>

                    {/* موج صوتی نمایشی */}
                    <div className="flex items-center justify-center gap-1 h-8">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full bg-teal-600 transition-all ${
                            isPlayingAudio ? 'animate-pulse' : 'h-1.5 opacity-30'
                          }`}
                          style={{
                            height: isPlayingAudio ? `${Math.sin(i) * 16 + 18}px` : '6px',
                            animationDelay: `${i * 120}ms`,
                          }}
                        />
                      ))}
                    </div>

                    {/* متن آیه سیستم */}
                    {!hideSystemText ? (
                      <div
                        className="text-xl sm:text-2xl md:text-3xl font-normal leading-[2.4] text-teal-950 dark:text-teal-100 text-center"
                        style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                        dir="rtl"
                      >
                        «{activeVerse.textArabic}»
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-teal-50/30 dark:bg-slate-800/40 text-xs text-slate-400">
                        متن آیه جهت تقویت تمرکز شنیداری پنهان شده است. (از تنظیمات قابل نمایش است)
                      </div>
                    )}

                    {/* دکمه رفتن به نوبت بعد */}
                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => advanceToNextVerse()}
                        className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <span>نوبت من است (رفتن به آیه بعد)</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* نوبت کاربر */
                  <div className="space-y-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                      <Mic className="w-4 h-4 animate-pulse" />
                      <span>اکنون نوبت شماست؛ آیه {toPersianDigits(activeVerse.verseNumber)} را با صوت تلاوت کنید:</span>
                    </div>

                    {/* متن آیه برای کاربر (مخفی یا آشکار با راهنما) */}
                    {hideUserText && !showFullVersePrompt ? (
                      <div className="p-6 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-50/20 dark:bg-slate-800/30 space-y-2">
                        <span className="text-xs text-slate-400 block">
                          آیه را از حفظ بخوانید…
                        </span>
                        {showHintWord && (
                          <div
                            className="text-lg font-bold text-emerald-700 dark:text-emerald-300 animate-fadeIn"
                            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                          >
                            سرنخ: «{firstWordHint}»
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="text-xl sm:text-2xl md:text-3xl font-normal leading-[2.4] text-emerald-950 dark:text-emerald-100 text-center animate-fadeIn"
                        style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
                        dir="rtl"
                      >
                        «{activeVerse.textArabic}»
                      </div>
                    )}

                    {/* دکمه‌های کمکی در صورت فراموشی */}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {!showHintWord && (
                        <button
                          type="button"
                          onClick={() => setShowHintWord(true)}
                          className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                          <span>سرنخ کلمه اول</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowFullVersePrompt(!showFullVersePrompt)}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        {showFullVersePrompt ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showFullVersePrompt ? 'پنهان‌سازی مجدد' : 'مشاهده کل آیه (راهنما)'}</span>
                      </button>
                    </div>

                    {/* کنترل میکروفون و ارزیابی هوشمند تلاوت آیه */}
                    <div className="pt-2">
                      <SmartRecitationFeedbackPanel
                        evaluation={recitationEvaluation}
                        transcribedText={transcribedText}
                        isRecording={isRecording}
                        onToggleRecording={toggleRecording}
                        onRetry={handleRetryRecording}
                        onAccept={() => handleCompleteUserTurn(true)}
                        onReject={() => handleCompleteUserTurn(false)}
                        acceptLabel="مسلط خواندم (آیه بعد)"
                        rejectLabel="نیاز به تمرین"
                        targetText={activeVerse?.textArabic}
                        surahName={currentSurah.nameArabic}
                        verseNumber={toPersianDigits(activeVerse?.verseNumber || 1)}
                        surahId={currentSurah.id}
                        rawVerseNumber={activeVerse?.verseNumber}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* نوار جابجایی پایین صفحه در روش آیه به آیه */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handlePreviousVerse}
                disabled={currentVerseIndex === 0}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-30 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>آیه قبل</span>
              </button>

              <button
                type="button"
                onClick={() => advanceToNextVerse()}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>رد شدن به آیه بعد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      }

      {/* کارنامه پایان جلسه مباحثه */}
      {isSessionFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 max-w-sm w-full text-center space-y-4 shadow-xl animate-fadeIn">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
              discussionMode === 'competitive'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}>
              <Award className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {discussionMode === 'competitive'
                  ? 'مسابقه حفظ با موفقیت به پایان رسید!'
                  : discussionMode === 'completion'
                  ? 'مباحثه تکمیلی (اکمال فراز) به پایان رسید!'
                  : discussionMode === 'page_by_page'
                  ? 'مباحثه صفحه به صفحه به پایان رسید!'
                  : discussionMode === 'thematic'
                  ? 'مباحثه مقطع به مقطع به پایان رسید!'
                  : 'جلسه مباحثه با موفقیت به پایان رسید!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                سوره مبارکه {currentSurah.nameArabic} •{' '}
                {discussionMode === 'page_by_page'
                  ? `${toPersianDigits(sessionPages.length)} صفحه مصحف شریف`
                  : discussionMode === 'thematic'
                  ? `${toPersianDigits(thematicSections.length)} مقطع محتوایی`
                  : `${toPersianDigits(sessionVerses.length)} آیه`}
              </p>
            </div>

            {discussionMode === 'competitive' ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center space-y-1">
                  <span className="text-xs text-amber-800 dark:text-amber-300 font-bold block">
                    امتیاز کل کسب‌شده:
                  </span>
                  <span className="text-3xl font-black text-amber-600 dark:text-amber-400 block py-1">
                    {toPersianDigits(competitiveScore)}
                  </span>
                  <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-center gap-1 font-bold">
                    <span>بزرگ‌ترین زنجیره تسلط:</span>
                    <span className="text-orange-500 font-black">🔥 {toPersianDigits(maxCompetitiveStreak)}</span>
                  </div>
                  {/* رتبه مسابقه بر اساس درصد کسب امتیاز */}
                  <div className="pt-2">
                    <span className="text-[11px] px-3 py-1 rounded-full font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 inline-block">
                      {competitiveScore >= sessionVerses.length * 120
                        ? '🌟 مدال طلای حافظان مسابقه‌ای'
                        : competitiveScore >= sessionVerses.length * 70
                        ? '🥈 مدال نقره (سرعت و دقت خوب)'
                        : '🥉 مدال برنز (نیاز به تمرین سرعت)'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 dark:bg-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">پاسخ‌های به موقع:</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {toPersianDigits(masteredCount)} سوال
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">اتمام زمان / راهنما:</span>
                    <span className="text-base font-black text-rose-600 dark:text-rose-400">
                      {toPersianDigits(reviewedCount)} سوال
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">تلاوت مسلط:</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {toPersianDigits(masteredCount)}{' '}
                    {discussionMode === 'page_by_page'
                      ? 'صفحه'
                      : discussionMode === 'thematic'
                      ? 'مقطع'
                      : 'آیه'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">نیاز به تمرین:</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400">
                    {toPersianDigits(reviewedCount)}{' '}
                    {discussionMode === 'page_by_page'
                      ? 'صفحه'
                      : discussionMode === 'thematic'
                      ? 'مقطع'
                      : 'آیه'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleStartSession}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer"
              >
                تکرار جلسه
              </button>
              <button
                type="button"
                onClick={handleExitSession}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                بازگشت به منو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال انتخاب سوره */}
      <SurahSelectorModal
        isOpen={isSurahPickerOpen}
        onClose={() => setIsSurahPickerOpen(false)}
        surahs={surahs}
        currentSurahId={currentSurah.id}
        onSelectSurah={(surah) => {
          if (onSelectSurah) onSelectSurah(surah);
          setIsSurahPickerOpen(false);
        }}
        darkMode={darkMode}
      />
    </div>
  );
};
