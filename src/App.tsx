import React, { useState, useEffect } from 'react';
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
import { QuranService } from './services/quranService';
import { getAISettings, saveAISettings } from './services/aiSettings';
import { ALL_SURAHS } from './data/surahs';
import { Surah, Verse, AppSettings, ViewMode, AISettings } from './types';

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

  // مودال دستیار هوش مصنوعی
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiContextVerse, setAiContextVerse] = useState<Verse | null>(null);

  // تنظیمات سرویس هوش مصنوعی (DeepSeek پیش‌فرض / Gemini جایگزین + کلید شخصی کاربر)
  const [aiSettings, setAiSettings] = useState<AISettings>(() => getAISettings());

  const handleUpdateAISettings = (next: AISettings) => {
    setAiSettings(next);
    saveAISettings(next);
  };

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

  // بارگذاری لیست سوره‌ها و وضعیت از IndexedDB
  useEffect(() => {
    async function loadData() {
      const all = await QuranService.getAllSurahs();
      if (all && all.length > 0) {
        setSurahs(all);
      }

      // بازیابی آخرین مطالعه
      const lastRead = await QuranService.getLastRead();
      if (lastRead) {
        const target = all.find((s) => s.id === lastRead.surahId);
        if (target) {
          setCurrentSurah(target);
          setCurrentMushafPage(lastRead.pageNumber || target.startPage || 1);
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
  }, []);

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

        // ذخیره آخرین سوره مطالعه شده
        QuranService.saveLastRead(currentSurah.id, 1, currentSurah.startPage);
        setCurrentMushafPage(currentSurah.startPage);

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
      setCurrentSurah(targetSurah);
      setViewMode('verse-by-verse');
      setTimeout(() => {
        const el = document.getElementById(`verse-${verseNumber}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    }
  };

  // پرش به صفحه در مصحف
  const handleNavigateToMushafPage = (pageNumber: number) => {
    setCurrentMushafPage(pageNumber);
    setViewMode('mushaf-page');
  };

  // تغییر و انتخاب سوره
  const handleSelectSurah = (surah: Surah) => {
    setCurrentSurah(surah);
    setCurrentMushafPage(surah.startPage || 1);
  };

  // پخش صوت آیه
  const handlePlayVerseAudio = (verseNumber: number) => {
    setActivePlayingVerseNumber(verseNumber);
    setIsAudioPlayerOpen(true);
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
        darkMode={settings.darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        isAutoScrollActive={isAutoScrollActive}
        onToggleAutoScroll={() => setIsAutoScrollActive((prev) => !prev)}
        aiProvider={aiSettings.provider}
      />

      {/* ناحیه نمایش اصلی: سوئیچ بین حالت آیه به آیه و مصحف ۶۰۴ صفحه‌ای */}
      {viewMode === 'verse-by-verse' ? (
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
          onPageChange={(p) => setCurrentMushafPage(p)}
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
            const el = document.getElementById(`verse-${vNum}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          onClose={() => {
            setIsAudioPlayerOpen(false);
            setActivePlayingVerseNumber(null);
          }}
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
        aiSettings={aiSettings}
        onUpdateAISettings={handleUpdateAISettings}
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
        onSelectSurah={(surah) => {
          setCurrentSurah(surah);
          setCurrentMushafPage(surah.startPage);
        }}
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
