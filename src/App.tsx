import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { QuranReader } from './components/QuranReader';
import { MushafPageView } from './components/MushafPageView';
import { SurahSelectorModal } from './components/SurahSelectorModal';
import { SettingsModal } from './components/SettingsModal';
import { VerseDetailModal } from './components/VerseDetailModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { BookmarksModal } from './components/BookmarksModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { SearchModal } from './components/SearchModal';
import { KhatmModal } from './components/KhatmModal';
import { OfflineDownloadModal } from './components/OfflineDownloadModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { PWAUpdateBanner } from './components/PWAUpdateBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AutoScrollControls } from './components/AutoScrollControls';
import { MemorizationOverlay } from './components/MemorizationOverlay';
import { QuranHomePage } from './components/QuranHomePage';
import { QuranService } from './services/quranService';
import { loadMushafLayoutPack } from './services/mushafLayoutService';
import { ALL_SURAHS } from './data/surahs';
import { Surah, Verse, AppSettings, ViewMode } from './types';
import { MushafPageData } from './types/mushafLayout';
import MushafPrototype from './components/MushafPrototype';
import { requestQuranScrollToVerse } from './components/QuranReader';

const DEFAULT_SETTINGS: AppSettings = {
  arabicFontSize: 28,
  translationFontSize: 15,
  showTranslation: true,
  activeTranslator: 'makarem',
  arabicFont: 'uthman-taha',
  darkMode: true,
  themeColor: 'emerald',
  defaultViewMode: 'verse-by-verse',
  lineHeight: 'relaxed',
};

export default function App() {
  const [surahs, setSurahs] = useState<Surah[]>(ALL_SURAHS);
  const [currentSurah, setCurrentSurah] = useState<Surah>(ALL_SURAHS[0]); // سوره حمد به عنوان پیش‌فرض
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isCorePackageReady, setIsCorePackageReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('verse-by-verse');
  const [currentMushafPage, setCurrentMushafPage] = useState<number>(1);
  const [isHomeView, setIsHomeView] = useState<boolean>(true);
  const [lastReadPosition, setLastReadPosition] = useState<{ surahId: number; verseNumber: number; pageNumber?: number } | null>(null);

  // پروتوتایپ P3-T3: نمایش چیدمان ۱۵ خطی واقعی (دادهٔ MIT) از طریق ?proto=mushaf
  const isLayoutPrototype = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('proto') === 'mushaf'
    : false;
  const [prototypePages, setPrototypePages] = useState<MushafPageData[]>([]);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('quran_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [bookmarkedVerseIds, setBookmarkedVerseIds] = useState<Set<number>>(new Set());

  // مودال‌ها و کشوها
  const [isSurahModalOpen, setIsSurahModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVerseDetailOpen, setIsVerseDetailOpen] = useState(false);
  const [selectedVerseForDetail, setSelectedVerseForDetail] = useState<Verse | null>(null);

  // مودال‌های فازهای جدید: جستجو، ختم قرآن، دانلود آفلاین
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isKhatmModalOpen, setIsKhatmModalOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isMemoOpen, setIsMemoOpen] = useState(false);

  // مودال دستیار هوش مصنوعی
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiContextVerse, setAiContextVerse] = useState<Verse | null>(null);

  // مودال نشانه‌گذاری‌ها
  const [isBookmarksModalOpen, setIsBookmarksModalOpen] = useState(false);

  // ترتیل صوتی و پلیر همگام
  const [isAudioPlayerOpen, setIsAudioPlayerOpen] = useState(false);
  const [activePlayingVerseNumber, setActivePlayingVerseNumber] = useState<number | null>(null);

  // اسکرول خودکار صفحه (مطالعه پیوسته)
  const [isAutoScrollActive, setIsAutoScrollActive] = useState(false);

  // وضعیت بارگذاری آیات
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [loadVersesError, setLoadVersesError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // آیهٔ از سرگیری قرائت (P3-T1): عددی که پس از بارگذاری آیات سوره، QuranReader به آن اسکرول می‌کند
  const [resumeScrollVerse, setResumeScrollVerse] = useState<number | null>(null);

  // بارگذاری لیست سوره‌ها و وضعیت از IndexedDB
  useEffect(() => {
    async function loadData() {
      const all = await QuranService.getAllSurahs();
      if (all && all.length > 0) {
        setSurahs(all);
      }

      // بازیابی آخرین مطالعه (سوره + آیهٔ واقعی + صفحه)
      const lastRead = await QuranService.getLastRead();
      if (lastRead) {
        setLastReadPosition(lastRead);
        const target = all.find((s) => s.id === lastRead.surahId);
        if (target) {
          setCurrentSurah(target);
          setCurrentMushafPage(lastRead.pageNumber || target.startPage || 1);
          if (lastRead.verseNumber && lastRead.verseNumber > 1) {
            setResumeScrollVerse(lastRead.verseNumber);
          }
        }
      }
    }
    loadData();
  }, []);

  // بستهٔ محلی نسخه‌دار متن و ترجمه‌ها را پیش از درخواست شبکه نصب می‌کنیم.
  useEffect(() => {
    QuranService.ensureBundledCorePackage()
      .catch(() => false)
      .finally(() => setIsCorePackageReady(true));
    // مهاجرت ختم از localStorage قدیمی به Dexie (P3-T9)
    QuranService.importLegacyKhatmPlanIfEmpty().catch(() => {});
  }, []);

  // پروتوتایپ P3-T3: بارگذاری ۵ صفحهٔ چیدمان واقعی (quran-qcf4, MIT)
  useEffect(() => {
    if (isLayoutPrototype) {
      loadMushafLayoutPack().then((pack) => {
        if (pack) setPrototypePages(pack.pages);
      });
    }
  }, [isLayoutPrototype]);

  // بارگذاری آیات سوره انتخابی (آفلاین یا آنلاین با کش ماندگار)
  useEffect(() => {
    if (!isCorePackageReady) return;
    let isCancelled = false;
    async function loadVerses() {
      setIsLoadingVerses(true);
      setLoadVersesError(null);

      try {
        const v = await QuranService.getVersesBySurah(currentSurah.id);
        if (isCancelled) return;
        setVerses(v);

        if (v.length === 0) {
          setLoadVersesError('آیات این سوره دریافت نشد. لطفاً اتصال اینترنت را بررسی و مجدداً امتحان کنید.');
        }

        // بوکمارک‌های این سوره را واکشی می‌کنیم
        const bookmarks = await QuranService.getBookmarks();
        if (isCancelled) return;
        const currentSurahBookmarks = new Set(
          bookmarks.filter((b) => b.surahId === currentSurah.id).map((b) => b.verseNumber)
        );
        setBookmarkedVerseIds(currentSurahBookmarks);
      } catch (err) {
        if (isCancelled) return;
        console.error('Failed to load verses for surah', currentSurah.id, err);
        setLoadVersesError('خطا در بارگذاری آیات سوره. لطفاً روی دکمه تلاش مجدد کلیک فرمایید.');
      } finally {
        if (!isCancelled) {
          setIsLoadingVerses(false);
        }
      }
    }
    loadVerses();
    return () => {
      isCancelled = true;
    };
  }, [currentSurah.id, retryTrigger, isCorePackageReady]);

  const handleRetryLoading = () => {
    setRetryTrigger((prev) => prev + 1);
  };

  // ذخیره تنظیمات
  const handleUpdateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      localStorage.setItem('quran_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const handleToggleDarkMode = () => {
    handleUpdateSettings({ darkMode: !settings.darkMode });
  };

  const handleToggleBookmark = async (verseNumber: number) => {
    const isNowBookmarked = await QuranService.toggleBookmark(currentSurah.id, verseNumber);
    setBookmarkedVerseIds((prev) => {
      const next = new Set(prev);
      if (isNowBookmarked) {
        next.add(verseNumber);
      } else {
        next.delete(verseNumber);
      }
      return next;
    });
  };

  const handleSaveNote = async (surahId: number, verseNumber: number, note: string) => {
    await QuranService.saveBookmarkNote(surahId, verseNumber, note);
    setBookmarkedVerseIds((prev) => new Set(prev).add(verseNumber));
  };

  // اعمال کلاس dark به روت سند
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0b1120';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#faf8f5';
    }
  }, [settings.darkMode]);

  // ناوبری مستقیم به آیه از لیست بوکمارک‌ها یا نتایج جستجو
  const handleNavigateToVerse = async (surahId: number, verseNumber: number) => {
    const targetSurah = surahs.find((s) => s.id === surahId);
    if (targetSurah) {
      setResumeScrollVerse(null);
      setCurrentSurah(targetSurah);
      setViewMode('verse-by-verse');
      const targetVerse = await QuranService.getVerseBySurahAndNumber(surahId, verseNumber);
      QuranService.saveLastRead(
        surahId,
        verseNumber,
        targetVerse?.pageNumber || targetSurah.startPage || 1
      );
      setTimeout(() => {
        requestQuranScrollToVerse(verseNumber);
      }, 400);
    }
  };

  // ذخیرهٔ آیهٔ واقعی در حال مشاهده (P3-T1) با debounce در QuranReader
  const handleReadingPositionChange = useCallback((verse: Verse) => {
    QuranService.saveLastRead(verse.surahId, verse.verseNumber, verse.pageNumber);
    setLastReadPosition({ surahId: verse.surahId, verseNumber: verse.verseNumber, pageNumber: verse.pageNumber });
  }, []);

  // پرش به صفحه در مصحف
  const handleNavigateToMushafPage = (pageNumber: number) => {
    setCurrentMushafPage(pageNumber);
    setViewMode('mushaf-page');
    setIsHomeView(false);
  };

  // تغییر و انتخاب سوره
  const handleSelectSurah = (surah: Surah) => {
    setResumeScrollVerse(null);
    setCurrentSurah(surah);
    setCurrentMushafPage(surah.startPage || 1);
    setIsHomeView(false);
    // فقط وقتی کاربر سوره را تغییر داد موقعیت ابتدای سوره ثبت می‌شود
    QuranService.saveLastRead(surah.id, 1, surah.startPage || 1);
    setLastReadPosition({ surahId: surah.id, verseNumber: 1, pageNumber: surah.startPage || 1 });
  };

  // پخش صوت آیه
  const handlePlayVerseAudio = (verseNumber: number) => {
    setActivePlayingVerseNumber(verseNumber);
    setIsAudioPlayerOpen(true);
  };

  // پرش خودکار پلیر به سورهٔ بعد (بدون تغییر محل مطالعهٔ کاربر)
  const handleAudioAutoAdvanceToNextSurah = () => {
    const currentIndex = surahs.findIndex((s) => s.id === currentSurah.id);
    if (currentIndex < 0 || currentIndex >= surahs.length - 1) return;
    const nextSurah = surahs[currentIndex + 1];
    setResumeScrollVerse(null);
    setCurrentSurah(nextSurah);
    setCurrentMushafPage(nextSurah.startPage || 1);
    setActivePlayingVerseNumber(1);
  };

  return (
    <div
      id="app-root"
      className={`min-h-screen flex flex-col font-['Vazirmatn'] transition-colors duration-200 ${
        settings.darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#faf8f5] text-slate-800'
      }`}
      dir="rtl"
    >
      {/* بنر نصب اپلیکیشن PWA روی دستگاه */}
      <PWAInstallBanner darkMode={settings.darkMode} />

      {/* هدر بالایی با ابزارهای ناوبری، حالت مصحف، ختم قرآن، جستجو و هوش مصنوعی */}
      <Header
        currentSurah={currentSurah}
        viewMode={viewMode}
        onToggleViewMode={() =>
          setViewMode((prev) => (prev === 'verse-by-verse' ? 'mushaf-page' : 'verse-by-verse'))
        }
        onOpenSurahList={() => setIsSurahModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenBookmarks={() => setIsBookmarksModalOpen(true)}
        onOpenKhatm={() => setIsKhatmModalOpen(true)}
        onOpenOffline={() => setIsOfflineModalOpen(true)}
        onOpenAI={() => {
          setAiContextVerse(null);
          setIsAIModalOpen(true);
        }}
        onOpenMemorization={() => {
          // بستن پلیر صوتی برای جلوگیری از تداخل دو صوت همزمان
          setIsAudioPlayerOpen(false);
          setActivePlayingVerseNumber(null);
          setIsMemoOpen(true);
        }}
        darkMode={settings.darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        isAutoScrollActive={isAutoScrollActive}
        onToggleAutoScroll={() => setIsAutoScrollActive((prev) => !prev)}
        isHomeView={isHomeView}
        onToggleHomeView={() => setIsHomeView((prev) => !prev)}
      />

      {/* ناحیه نمایش اصلی: صفحه اصلی یا خوانش قرآن */}
      {isHomeView ? (
        <QuranHomePage
          surahs={surahs}
          lastRead={lastReadPosition}
          onContinueReading={() => {
            setIsHomeView(false);
            if (lastReadPosition?.verseNumber) {
              setResumeScrollVerse(lastReadPosition.verseNumber);
              setTimeout(() => requestQuranScrollToVerse(lastReadPosition.verseNumber), 200);
            }
          }}
          onSelectSurah={(surah) => {
            handleSelectSurah(surah);
          }}
          onNavigateToJuz={(juzNumber) => {
            const target = surahs.find((s) => s.juzNumber === juzNumber) || surahs[0];
            handleSelectSurah(target);
          }}
          onOpenMushafPage={() => {
            setViewMode('mushaf-page');
            setIsHomeView(false);
          }}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          onOpenBookmarks={() => setIsBookmarksModalOpen(true)}
          onOpenKhatm={() => setIsKhatmModalOpen(true)}
          onOpenAI={(verse) => {
            if (verse) setAiContextVerse(verse);
            setIsAIModalOpen(true);
          }}
          onOpenMemorization={() => {
            setIsAudioPlayerOpen(false);
            setActivePlayingVerseNumber(null);
            setIsMemoOpen(true);
          }}
          onPlayVerseAudio={(sId, vNum) => {
            const s = surahs.find((x) => x.id === sId);
            if (s) setCurrentSurah(s);
            setActivePlayingVerseNumber(vNum);
            setIsAudioPlayerOpen(true);
          }}
          darkMode={settings.darkMode}
        />
      ) : isLayoutPrototype ? (
        <MushafPrototype
          pages={prototypePages}
          darkMode={settings.darkMode}
          arabicFont={settings.arabicFont}
          arabicFontSize={settings.arabicFontSize}
        />
      ) : viewMode === 'verse-by-verse' ? (
        <QuranReader
          currentSurah={currentSurah}
          verses={verses}
          settings={settings}
          darkMode={settings.darkMode}
          bookmarkedVerseIds={bookmarkedVerseIds}
          activePlayingVerseNumber={activePlayingVerseNumber}
          isLoading={isLoadingVerses}
          loadError={loadVersesError}
          onRetry={handleRetryLoading}
          onToggleBookmark={handleToggleBookmark}
          onOpenVerseAction={(verse) => {
            setSelectedVerseForDetail(verse);
            setIsVerseDetailOpen(true);
          }}
          onOpenAIFortVerse={(verse) => {
            setAiContextVerse(verse);
            setIsAIModalOpen(true);
          }}
          onPlayVerseAudio={handlePlayVerseAudio}
          onReadingPositionChange={handleReadingPositionChange}
          initialScrollToVerseNumber={resumeScrollVerse}
          onInitialScrollHandled={() => setResumeScrollVerse(null)}
        />
      ) : (
        <MushafPageView
          initialPageNumber={currentMushafPage}
          surahs={surahs}
          settings={settings}
          darkMode={settings.darkMode}
          bookmarkedVerseIds={bookmarkedVerseIds}
          onToggleBookmark={handleToggleBookmark}
          onOpenVerseDetail={(verse) => {
            setSelectedVerseForDetail(verse);
            setIsVerseDetailOpen(true);
          }}
          onOpenAIForVerse={(verse) => {
            setAiContextVerse(verse);
            setIsAIModalOpen(true);
          }}
          onPlayVerseAudio={handlePlayVerseAudio}
          onPageChange={(p, surahId, verseNumber) => {
            setCurrentMushafPage(p);
            if (surahId) {
              QuranService.saveLastRead(surahId, verseNumber || 1, p);
            }
          }}
        />
      )}

      {/* پلیر صوتی شناور ترتیل با تفکیک آیه و قاری */}
      {isAudioPlayerOpen && (
        <AudioPlayerBar
          currentSurah={currentSurah}
          verses={verses}
          activeVerseNumber={activePlayingVerseNumber}
          onSelectVerseToPlay={(vNum) => {
            setActivePlayingVerseNumber(vNum);
            setTimeout(() => requestQuranScrollToVerse(vNum), 60);
          }}
          onClose={() => {
            setIsAudioPlayerOpen(false);
            setActivePlayingVerseNumber(null);
          }}
          onAutoAdvanceToNextSurah={handleAudioAutoAdvanceToNextSurah}
          onJumpToSurah={(surahId) => {
            const s = surahs.find((x) => x.id === surahId);
            if (!s) return;
            handleSelectSurah(s);
            setActivePlayingVerseNumber(1);
          }}
          allSurahs={surahs.map((s) => ({ id: s.id, nameArabic: s.nameArabic }))}
          darkMode={settings.darkMode}
        />
      )}

      {/* کنترلر و نوار شناور اسکرول خودکار */}
      <AutoScrollControls
        isActive={isAutoScrollActive}
        onClose={() => setIsAutoScrollActive(false)}
        darkMode={settings.darkMode}
        onNextPageOrSurah={() => {
          if (viewMode === 'verse-by-verse') {
            const currentIndex = surahs.findIndex((s) => s.id === currentSurah.id);
            if (currentIndex < surahs.length - 1) {
              handleSelectSurah(surahs[currentIndex + 1]);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } else {
            if (currentMushafPage < 604) {
              setCurrentMushafPage((p) => p + 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        }}
      />

      {/* کشوی جامع تفاسیر، ۳ ترجمه، واژه‌شناسی و یادداشت */}
      <VerseDetailModal
        isOpen={isVerseDetailOpen}
        onClose={() => {
          setIsVerseDetailOpen(false);
          setSelectedVerseForDetail(null);
        }}
        verse={selectedVerseForDetail}
        currentSurah={currentSurah}
        darkMode={settings.darkMode}
        arabicFont={settings.arabicFont}
        onOpenAIForVerse={(verse) => {
          setAiContextVerse(verse);
          setIsAIModalOpen(true);
        }}
        onSaveNote={handleSaveNote}
      />

      {/* دستیار هوشمند تدبّر قرآنی (DeepSeek / Gemini) */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          setAiContextVerse(null);
        }}
        currentVerse={aiContextVerse}
        currentSurah={currentSurah}
        darkMode={settings.darkMode}
        onOpenVerse={(verse) => {
          setIsAIModalOpen(false);
          void handleNavigateToVerse(verse.surahId, verse.verseNumber);
        }}
      />

      {/* مودال جستجوی پیشرفته متنی و ترجمه */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        surahs={surahs}
        onSelectResult={handleNavigateToVerse}
        darkMode={settings.darkMode}
      />

      {/* مودال برنامه‌ریزی و پیگیری ختم قرآن کریم */}
      <KhatmModal
        isOpen={isKhatmModalOpen}
        onClose={() => setIsKhatmModalOpen(false)}
        darkMode={settings.darkMode}
        onNavigateToPage={handleNavigateToMushafPage}
      />

      {/* مودال مدیریت ذخیره‌سازی و دانلود آفلاین */}
      <OfflineDownloadModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        darkMode={settings.darkMode}
        currentSurahId={currentSurah.id}
      />

      {/* حالت حفظ (P5-T4): بازهٔ انتخابی با تکرار و خودآزمایی */}
      <MemorizationOverlay
        isOpen={isMemoOpen}
        onClose={() => setIsMemoOpen(false)}
        currentSurah={currentSurah}
        verses={verses}
        darkMode={settings.darkMode}
        settings={settings}
        initialVerseNumber={activePlayingVerseNumber || null}
      />

      {/* مودال بوکمارک‌ها و یادداشت‌های شخصی */}
      <BookmarksModal
        isOpen={isBookmarksModalOpen}
        onClose={() => setIsBookmarksModalOpen(false)}
        surahs={surahs}
        onSelectBookmark={handleNavigateToVerse}
        darkMode={settings.darkMode}
      />

      {/* مودال انتخاب سوره و جزء */}
      <SurahSelectorModal
        isOpen={isSurahModalOpen}
        onClose={() => setIsSurahModalOpen(false)}
        surahs={surahs}
        currentSurahId={currentSurah.id}
        onSelectSurah={handleSelectSurah}
        darkMode={settings.darkMode}
      />

      {/* مودال تنظیمات اندازه فونت و مترجم */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        darkMode={settings.darkMode}
      />

      {/* بنر به‌روزرسانی نسخه جدید با تأیید کاربر (P2-T2) */}
      <PWAUpdateBanner isAudioPlaying={isAudioPlayerOpen && activePlayingVerseNumber !== null} />

      {/* نشانگر وضعیت آفلاین در صورت قطع اتصال شبکه */}
      <OfflineIndicator />
    </div>
  );
}
