import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { QuranReader } from './components/QuranReader';
import { MushafPageView } from './components/MushafPageView';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { PWAUpdateBanner } from './components/PWAUpdateBanner';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AutoScrollControls } from './components/AutoScrollControls';
import { QuranHomePage } from './components/QuranHomePage';
import { SplashScreen } from './components/SplashScreen';
import { BookOpen, ChevronRight } from 'lucide-react';
import { AppDrawer } from './components/AppDrawer';
import { ShareChoiceSheet } from './components/ShareChoiceSheet';
import { QuranService } from './services/quranService';
import { initProgressStore } from './services/progress/progressStore';
import { flushPageView, trackPageView } from './services/khatm/pageViewTracker';
import { loadMushafLayoutPack } from './services/mushafLayoutService';
import { ALL_SURAHS, getJuzStartInfo } from './data/surahs';
import { Surah, Verse, AppSettings, ViewMode } from './types';
import { MushafPageData } from './types/mushafLayout';
import { requestQuranScrollToVerse } from './components/QuranReader';
import { recordUserActivity } from './services/activityTracker';
import { App as CapApp } from '@capacitor/app';

// کامپوننت‌های سنگین صفحه‌ای و مودال‌ها به‌صورت Lazy جهت بهینه‌سازی بارگذاری اولیه
const AIPage = lazy(() => import('./components/AIPage').then((m) => ({ default: m.AIPage })));
const MemorizationPage = lazy(() => import('./components/MemorizationPage').then((m) => ({ default: m.MemorizationPage })));
const OfflinePage = lazy(() => import('./components/OfflinePage').then((m) => ({ default: m.OfflinePage })));
const QuranStoriesExplorer = lazy(() => import('./components/QuranStoriesExplorer').then((m) => ({ default: m.QuranStoriesExplorer })));
const MushafPrototype = lazy(() => import('./components/MushafPrototype'));

// مودال‌های کمکی با بارگذاری در زمان نیاز
const SurahSelectorModal = lazy(() => import('./components/SurahSelectorModal').then((m) => ({ default: m.SurahSelectorModal })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const VerseDetailModal = lazy(() => import('./components/VerseDetailModal').then((m) => ({ default: m.VerseDetailModal })));
const BookmarksModal = lazy(() => import('./components/BookmarksModal').then((m) => ({ default: m.BookmarksModal })));
const SearchModal = lazy(() => import('./components/SearchModal').then((m) => ({ default: m.SearchModal })));
const KhatmModal = lazy(() => import('./components/KhatmModal').then((m) => ({ default: m.KhatmModal })));
const SurahSearchModal = lazy(() => import('./components/SurahSearchModal').then((m) => ({ default: m.SurahSearchModal })));
const AboutModal = lazy(() => import('./components/AboutModal').then((m) => ({ default: m.AboutModal })));

const PageLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center" dir="rtl">
    <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin mb-4" />
    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">در حال بارگذاری بخش...</p>
  </div>
);

const getInitialSystemDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
};

const DEFAULT_SETTINGS: AppSettings = {
  arabicFontSize: 28,
  translationFontSize: 15,
  showTranslation: true,
  activeTranslator: 'makarem',
  arabicFont: 'uthman-taha',
  darkMode: getInitialSystemDarkMode(),
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
  const [activePage, setActivePage] = useState<'home' | 'reader' | 'ai' | 'memorization' | 'offline' | 'stories'>('home');
  const [previousPage, setPreviousPage] = useState<'home' | 'reader'>('home');
  const [pageHistory, setPageHistory] = useState<Array<'home' | 'reader' | 'ai' | 'memorization' | 'offline' | 'stories'>>(['home']);
  const [lastReadPosition, setLastReadPosition] = useState<{ surahId: number; verseNumber: number; pageNumber?: number } | null>(null);

  // پروتوتایپ P3-T3: نمایش چیدمان ۱۵ خطی واقعی (دادهٔ MIT) از طریق ?proto=mushaf
  const isLayoutPrototype = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('proto') === 'mushaf'
    : false;
  const [prototypePages, setPrototypePages] = useState<MushafPageData[]>([]);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const systemDark = getInitialSystemDarkMode();
    const defaultWithSystem = { ...DEFAULT_SETTINGS, darkMode: systemDark };
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quran_settings');
      if (saved) {
        try {
          return { ...defaultWithSystem, ...JSON.parse(saved) };
        } catch {
          return defaultWithSystem;
        }
      }
    }
    return defaultWithSystem;
  });

  const [bookmarkedVerseIds, setBookmarkedVerseIds] = useState<Set<number>>(new Set());

  // مودال‌ها و کشوها
  const [isSurahModalOpen, setIsSurahModalOpen] = useState(false);
  const [surahModalInitialTab, setSurahModalInitialTab] = useState<'surahs' | 'juz'>('surahs');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVerseDetailOpen, setIsVerseDetailOpen] = useState(false);
  const [selectedVerseForDetail, setSelectedVerseForDetail] = useState<Verse | null>(null);

  // مودال‌های جستجو و ختم قرآن
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string>('');
  const [isSurahSearchOpen, setIsSurahSearchOpen] = useState(false);
  const [isKhatmModalOpen, setIsKhatmModalOpen] = useState(false);

  // آیه زمینه برای دستیار هوش مصنوعی
  const [aiContextVerse, setAiContextVerse] = useState<Verse | null>(null);

  // مودال نشانه‌گذاری‌ها
  const [isBookmarksModalOpen, setIsBookmarksModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

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

  // وضعیت نمایش اسپلش اسکرین معنوی - فقط بار اول که سایت باز می‌شود یا برنامه نصب می‌شود
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    try {
      const hasSeen = localStorage.getItem('mobin_has_seen_splash');
      return !hasSeen;
    } catch {
      return false;
    }
  });

  // پشتیبانی از میانبرهای وب‌اپلیکیشن در مانیفست PWA (?view=surahs, ?action=last-read, ?action=search)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const action = params.get('action');

    if (view === 'surahs') {
      setShowSplash(false);
      setIsSurahModalOpen(true);
    } else if (action === 'last-read') {
      setShowSplash(false);
      setActivePage('reader');
    } else if (action === 'search') {
      setShowSplash(false);
      setIsSearchModalOpen(true);
    }
  }, []);

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
    // ذخیره‌گاه یکپارچهٔ پیشرفت (حفظ + مرور) پیش از نمایش داده‌ها آماده می‌شود (مرحلهٔ ۰)
    Promise.all([
      QuranService.ensureBundledCorePackage().catch(() => false),
      initProgressStore(),
    ]).finally(() => setIsCorePackageReady(true));
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
      document.body.style.backgroundColor = '#0b1f1d';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f7f3e8';
    }
  }, [settings.darkMode]);

  // باز کردن صفحات مستقل (هوش مصنوعی، حفظ، دانلود آفلاین)
  const handleOpenAI = (verse?: Verse | null) => {
    setAiContextVerse(verse || null);
    setPreviousPage(activePage === 'home' ? 'home' : 'reader');
    setActivePage('ai');
  };

  const handleOpenMemorization = () => {
    setIsAudioPlayerOpen(false);
    setActivePlayingVerseNumber(null);
    setPreviousPage(activePage === 'home' ? 'home' : 'reader');
    setActivePage('memorization');
  };

  const handleOpenStories = () => {
    setIsAudioPlayerOpen(false);
    setActivePlayingVerseNumber(null);
    setPreviousPage(activePage === 'home' ? 'home' : 'reader');
    setActivePage('stories');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleOpenOffline = () => {
    setPreviousPage(activePage === 'home' ? 'home' : 'reader');
    setActivePage('offline');
  };

  // همگام‌سازی پشته تاریخچه صفحات هنگام ناوبری کاربر
  useEffect(() => {
    setPageHistory((prev) => {
      if (prev[prev.length - 1] === activePage) return prev;
      const existingIndex = prev.lastIndexOf(activePage);
      if (existingIndex >= 0) return prev.slice(0, existingIndex + 1);
      return [...prev, activePage];
    });
  }, [activePage]);

  // مدیریت هوشمند کلید Back (در موبایل و وب):
  // اولویت ۱: بستن مودال‌های باز
  // اولویت ۲: بازگشت به صفحه قبلی (پشته تاریخچه) مانند اینستاگرام
  // اولویت ۳: خروج از برنامه در صفحه خانه با لمس مجدد
  const handleAppBack = useCallback((): boolean => {
    // ۰. کامپوننت‌های محلی (منوی آیه، منوی سه‌نقطه و...) با preventDefault روی این رویداد Back را مصرف می‌کنند
    if (!window.dispatchEvent(new CustomEvent('mobin-back', { cancelable: true }))) return true;
    // ۱. بررسی مودال‌های باز
    if (isVerseDetailOpen) {
      setIsVerseDetailOpen(false);
      setSelectedVerseForDetail(null);
      return true;
    }
    if (isSearchModalOpen) {
      setIsSearchModalOpen(false);
      setSearchInitialQuery('');
      return true;
    }
    if (isSurahSearchOpen) {
      setIsSurahSearchOpen(false);
      return true;
    }
    if (isKhatmModalOpen) {
      setIsKhatmModalOpen(false);
      return true;
    }
    if (isBookmarksModalOpen) {
      setIsBookmarksModalOpen(false);
      return true;
    }
    if (isSurahModalOpen) {
      setIsSurahModalOpen(false);
      return true;
    }
    if (isSettingsModalOpen) {
      setIsSettingsModalOpen(false);
      return true;
    }
    if (isAboutModalOpen) {
      setIsAboutModalOpen(false);
      return true;
    }
    if (isMoreMenuOpen) {
      setIsMoreMenuOpen(false);
      return true;
    }

    // ۲. بررسی پشته صفحات و بازگشت به صفحه قبلی مانند اینستاگرام
    if (pageHistory.length > 1) {
      const nextHistory = pageHistory.slice(0, -1);
      const targetPage = nextHistory[nextHistory.length - 1] || 'home';
      setPageHistory(nextHistory);
      setActivePage(targetPage);
      return true;
    }

    // ۳. اگر در صفحه‌ای غیر از خانه بودیم، بازگشت به خانه
    if (activePage !== 'home') {
      setActivePage('home');
      setPageHistory(['home']);
      return true;
    }

    return false;
  }, [
    isVerseDetailOpen,
    isSearchModalOpen,
    isSurahSearchOpen,
    isKhatmModalOpen,
    isBookmarksModalOpen,
    isSurahModalOpen,
    isSettingsModalOpen,
    isAboutModalOpen,
    isMoreMenuOpen,
    pageHistory,
    activePage,
  ]);

  const handleBackToPrevious = () => {
    handleAppBack();
  };

  // اتصال به دکمه Back اندروید (Capacitor) و دکمه بازگشت مرورگر / PWA / TWA
  // در PWA هیچ ورودی قبلی در history نیست، پس بدون «ورودی نگهبان» اولین Back کل برنامه را می‌بندد.
  // راه‌حل: یک ورودی نگهبان جلوی ورودی اصلی می‌گذاریم و بعد از هر Back که داخل برنامه مصرف شد، دوباره می‌گذاریم.
  const [exitHint, setExitHint] = useState(false);
  const lastBackPressRef = React.useRef(0);
  const handleAppBackRef = React.useRef(handleAppBack);
  handleAppBackRef.current = handleAppBack;

  useEffect(() => {
    const pushGuard = () => {
      try {
        window.history.pushState({ mobinGuard: true }, '', window.location.href);
      } catch {}
    };

    const askToExit = (): boolean => {
      // true یعنی «بار دوم در ۲ ثانیه» و باید خارج شد
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) return true;
      lastBackPressRef.current = now;
      setExitHint(true);
      setTimeout(() => setExitHint(false), 2000);
      return false;
    };

    // ورودی پایه + ورودی نگهبان
    try {
      window.history.replaceState({ mobinBase: true }, '', window.location.href);
    } catch {}
    pushGuard();

    const handlePopState = () => {
      if (handleAppBackRef.current()) {
        pushGuard();
        return;
      }
      // در صفحه خانه و بدون پنل باز
      if (askToExit()) {
        // در PWA با ورودی خالی، این Back برنامه را می‌بندد
        window.history.back();
      } else {
        pushGuard();
      }
    };
    window.addEventListener('popstate', handlePopState);

    // اندروید بومی (Capacitor): رویداد backButton جدا و بدون history
    const backListenerPromise = CapApp.addListener('backButton', () => {
      if (!handleAppBackRef.current() && askToExit()) {
        CapApp.exitApp();
      }
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      backListenerPromise.then((h) => h?.remove?.()).catch(() => {});
    };
  }, []);

  // اسکرول به ابتدای صفحه در زمان بازگشت به صفحه اصلی
  useEffect(() => {
    if (activePage === 'home') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      try {
        if (window.location.pathname.startsWith('/quran')) {
          window.history.replaceState(window.history.state, '', '/');
        }
      } catch {}
    }
  }, [activePage]);

  // ناوبری مستقیم به آیه از لیست بوکمارک‌ها، نتایج جستجو، منابع هوش مصنوعی، یا آیه تصادفی صفحه اصلی
  const handleNavigateToVerse = async (surahId: number, verseNumber: number) => {
    const targetSurah = surahs.find((s) => s.id === surahId);
    if (targetSurah) {
      try {
        const targetPath = `/quran/${surahId}/${verseNumber}`;
        if (window.location.pathname !== targetPath) {
          window.history.replaceState(window.history.state, '', targetPath);
        }
      } catch {}
      setResumeScrollVerse(verseNumber);
      setCurrentSurah(targetSurah);
      setViewMode('verse-by-verse');
      setActivePage('reader');
      const targetVerse = await QuranService.getVerseBySurahAndNumber(surahId, verseNumber);
      const pageNum = targetVerse?.pageNumber || targetSurah.startPage || 1;
      setCurrentMushafPage(pageNum);
      QuranService.saveLastRead(surahId, verseNumber, pageNum);
      setLastReadPosition({ surahId, verseNumber, pageNumber: pageNum });
      setTimeout(() => {
        requestQuranScrollToVerse(verseNumber);
      }, 180);
    }
  };

  // پشتیبانی از Deep Link قرآن در بارگذاری اولیه و دکمه Back مرورگر (مانند /quran/2/255)
  useEffect(() => {
    const handleUrlRoute = () => {
      const path = window.location.pathname;
      const match = path.match(/\/quran\/(\d+)(?:\/(\d+))?/i);
      if (match && surahs.length > 0) {
        const sId = parseInt(match[1], 10);
        const vNum = match[2] ? parseInt(match[2], 10) : 1;
        if (sId >= 1 && sId <= 114) {
          handleNavigateToVerse(sId, vNum);
        }
      }
    };

    handleUrlRoute();
  }, [surahs]);

  // ذخیرهٔ آیهٔ واقعی در حال مشاهده (P3-T1) و همگام‌سازی صفحهٔ مصحف با موقعیت مطالعه
  const handleReadingPositionChange = useCallback((verse: Verse) => {
    if (verse.pageNumber) trackPageView(verse.pageNumber);
    QuranService.saveLastRead(verse.surahId, verse.verseNumber, verse.pageNumber);
    setLastReadPosition({ surahId: verse.surahId, verseNumber: verse.verseNumber, pageNumber: verse.pageNumber });
    if (verse.pageNumber) {
      setCurrentMushafPage(verse.pageNumber);
    }
  }, []);

  // با رفتن برنامه به پس‌زمینه، صفحهٔ جاری (در صورت توقف کافی) جزو نامزدهای ثبت در ختم می‌شود
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPageView();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // در مصحف، صفحه دنبال آیهٔ در حال پخش می‌رود؛ اما اگر کاربر عمداً صفحهٔ دیگری را می‌خواند، دخالت نمی‌کند
  const lastPlayingPageRef = React.useRef<number | null>(null);
  useEffect(() => {
    if (viewMode !== 'mushaf-page' || !isAudioPlayerOpen || activePlayingVerseNumber === null) {
      lastPlayingPageRef.current = null;
      return;
    }
    const playing = verses.find((v) => v.verseNumber === activePlayingVerseNumber && v.surahId === currentSurah.id);
    if (!playing?.pageNumber) return;
    const prev = lastPlayingPageRef.current;
    if (prev === null || prev === currentMushafPage) {
      setCurrentMushafPage(playing.pageNumber);
    }
    lastPlayingPageRef.current = playing.pageNumber;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlayingVerseNumber, viewMode, isAudioPlayerOpen, verses]);

  // سوئیچ هوشمند و همگام بین نمای آیه‌ای و مصحف صفحه‌ای
  const handleToggleViewMode = async () => {
    if (viewMode === 'verse-by-verse') {
      // تغییر به مصحف صفحه‌ای: رفتن دقیق به صفحه‌ای که آیه در حال مطالعه در آن است
      // اگر صوت در حال پخش است، صفحهٔ همان آیه باز می‌شود تا هایلایت هماهنگ باشد
      const playingVerse =
        isAudioPlayerOpen && activePlayingVerseNumber !== null
          ? verses.find((v) => v.verseNumber === activePlayingVerseNumber)
          : undefined;
      const targetPage =
        playingVerse?.pageNumber || lastReadPosition?.pageNumber || currentMushafPage || currentSurah.startPage || 1;
      setCurrentMushafPage(targetPage);
      setViewMode('mushaf-page');
    } else {
      // تغییر به نمای آیه‌ای: دریافت آیات صفحهٔ جاری و اسکرول به نخستین آیه آن صفحه
      const targetPage = currentMushafPage || 1;
      // اگر آیه‌ای در حال پخش است، به همان آیه برگرد (نه اولین آیهٔ صفحه)
      if (isAudioPlayerOpen && activePlayingVerseNumber !== null) {
        setResumeScrollVerse(activePlayingVerseNumber);
        setTimeout(() => requestQuranScrollToVerse(activePlayingVerseNumber), 180);
        setViewMode('verse-by-verse');
        return;
      }
      const pageVerses = await QuranService.getVersesByPage(targetPage);
      if (pageVerses.length > 0) {
        const firstVerse = pageVerses[0];
        const targetSurah = surahs.find((s) => s.id === firstVerse.surahId) || currentSurah;
        setCurrentSurah(targetSurah);
        setResumeScrollVerse(firstVerse.verseNumber);
        QuranService.saveLastRead(firstVerse.surahId, firstVerse.verseNumber, targetPage);
        setLastReadPosition({ surahId: firstVerse.surahId, verseNumber: firstVerse.verseNumber, pageNumber: targetPage });
        setTimeout(() => requestQuranScrollToVerse(firstVerse.verseNumber), 180);
      }
      setViewMode('verse-by-verse');
    }
  };

  // پرش مستقیم به صفحه مصحف شریف یا نمای آیه‌ای آن صفحه
  const handleNavigateToMushafPage = async (pageNumber: number, forcePageMode: boolean = false) => {
    const safePage = Math.max(1, Math.min(604, pageNumber));
    setCurrentMushafPage(safePage);

    const pageVerses = await QuranService.getVersesByPage(safePage);
    const firstVerse = pageVerses.length > 0 ? pageVerses[0] : null;

    if (firstVerse) {
      const targetSurah = surahs.find((s) => s.id === firstVerse.surahId) || currentSurah;
      setCurrentSurah(targetSurah);
      setResumeScrollVerse(firstVerse.verseNumber);
      QuranService.saveLastRead(firstVerse.surahId, firstVerse.verseNumber, safePage);
      setLastReadPosition({ surahId: firstVerse.surahId, verseNumber: firstVerse.verseNumber, pageNumber: safePage });
    } else {
      let foundSurah = surahs[0];
      for (const s of surahs) {
        if (s.startPage && s.startPage <= safePage) {
          foundSurah = s;
        } else if (s.startPage && s.startPage > safePage) {
          break;
        }
      }
      setCurrentSurah(foundSurah);
      QuranService.saveLastRead(foundSurah.id, 1, safePage);
      setLastReadPosition({ surahId: foundSurah.id, verseNumber: 1, pageNumber: safePage });
    }

    if (forcePageMode) {
      setViewMode('mushaf-page');
    } else {
      setViewMode('verse-by-verse');
      if (firstVerse) {
        setTimeout(() => {
          requestQuranScrollToVerse(firstVerse.verseNumber);
        }, 180);
      }
    }
    setActivePage('reader');
  };

  // پرش دقیق و حقیقی به آغاز جزء (آیه، صفحه و سوره آغازین جزء)
  const handleNavigateToJuz = (juzNumber: number, forcePageMode: boolean = false) => {
    const info = getJuzStartInfo(juzNumber);
    const targetSurah = surahs.find((s) => s.id === info.surahId) || surahs[0];
    setCurrentMushafPage(info.page);
    setCurrentSurah(targetSurah);
    setResumeScrollVerse(info.ayah);
    QuranService.saveLastRead(info.surahId, info.ayah, info.page);
    setLastReadPosition({ surahId: info.surahId, verseNumber: info.ayah, pageNumber: info.page });

    if (forcePageMode) {
      setViewMode('mushaf-page');
    } else {
      setViewMode('verse-by-verse');
      setTimeout(() => {
        requestQuranScrollToVerse(info.ayah);
      }, 100);
    }
    setActivePage('reader');
  };

  // تغییر و انتخاب سوره
  const handleSelectSurah = (surah: Surah) => {
    setResumeScrollVerse(null);
    setCurrentSurah(surah);
    setCurrentMushafPage(surah.startPage || 1);
    setActivePage('reader');
    // فقط وقتی کاربر سوره را تغییر داد موقعیت ابتدای سوره ثبت می‌شود
    QuranService.saveLastRead(surah.id, 1, surah.startPage || 1);
    setLastReadPosition({ surahId: surah.id, verseNumber: 1, pageNumber: surah.startPage || 1 });
  };

  // پخش صوت آیه
  const handlePlayVerseAudio = (verseNumber: number, surahId?: number) => {
    // در مصحف ممکن است آیه به سورهٔ دیگری از همان صفحه تعلق داشته باشد؛ پلیر به سورهٔ جاری وابسته است
    if (surahId && surahId !== currentSurah.id) {
      const target = surahs.find((s) => s.id === surahId);
      if (target) setCurrentSurah(target);
    }
    setActivePlayingVerseNumber(verseNumber);
    setIsAudioPlayerOpen(true);
    recordUserActivity('listen');
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

  // ناوبری سوره بعد و قبل با اسلاید لمسی در صفحه قرائت
  const handleNextSurah = useCallback(() => {
    const currentIndex = surahs.findIndex((s) => s.id === currentSurah.id);
    if (currentIndex >= 0 && currentIndex < surahs.length - 1) {
      handleSelectSurah(surahs[currentIndex + 1]);
    }
  }, [surahs, currentSurah.id]);

  const handlePrevSurah = useCallback(() => {
    const currentIndex = surahs.findIndex((s) => s.id === currentSurah.id);
    if (currentIndex > 0) {
      handleSelectSurah(surahs[currentIndex - 1]);
    }
  }, [surahs, currentSurah.id]);

  return (
    <div
      id="app-root"
      className={`min-h-screen min-h-dvh w-full max-w-full overflow-x-clip flex flex-col font-['Vazirmatn'] transition-colors duration-200 ${
        settings.darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f7f3e8] text-slate-800'
      }`}
      dir="rtl"
    >
      {/* اسپلش اسکرین اختصاصی و معنوی قرآن مبین و موکب حضرت فاطمه‌الزهرا (س) */}
      {showSplash && (
        <SplashScreen
          onFinish={() => {
            setShowSplash(false);
            try {
              localStorage.setItem('mobin_has_seen_splash', 'true');
            } catch {
              // Ignore storage exceptions
            }
          }}
          darkMode={settings.darkMode}
        />
      )}

      {/* بنر نصب اپلیکیشن برای مرورگرهای وب و گوشی (PWA) */}
      <PWAInstallBanner darkMode={settings.darkMode} />

      {/* هدر بالایی با ابزارهای ناوبری، حالت مصحف، ختم قرآن، جستجو و هوش مصنوعی (تنها در صفحه قرائت) */}
      {activePage === 'reader' && (
        <Header
          currentSurah={currentSurah}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          onOpenSurahList={() => setIsSurahModalOpen(true)}
          onOpenSurahSearch={() => setIsSurahSearchOpen(true)}
          darkMode={settings.darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          isAutoScrollActive={isAutoScrollActive}
          onToggleAutoScroll={() => setIsAutoScrollActive((prev) => !prev)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenMenu={() => setIsMoreMenuOpen(true)}
        />
      )}

      {/* ناحیه نمایش اصلی: صفحه اصلی، صفحات مستقل یا خوانش قرآن */}
      {activePage === 'home' ? (
        <QuranHomePage
          surahs={surahs}
          lastRead={lastReadPosition}
          onContinueReading={() => {
            setActivePage('reader');
            if (lastReadPosition?.verseNumber) {
              setResumeScrollVerse(lastReadPosition.verseNumber);
              setTimeout(() => requestQuranScrollToVerse(lastReadPosition.verseNumber), 200);
            }
          }}
          onSelectSurah={(surah) => {
            handleSelectSurah(surah);
          }}
          onNavigateToVerse={(sId, vNum) => {
            handleNavigateToVerse(sId, vNum);
          }}
          onNavigateToJuz={handleNavigateToJuz}
          onNavigateToMushafPage={(pageNum) => handleNavigateToMushafPage(pageNum, false)}
          onOpenSurahSelector={(tab) => {
            setSurahModalInitialTab(tab === 'juz' ? 'juz' : 'surahs');
            setIsSurahModalOpen(true);
          }}
          onOpenMushafPage={() => {
            setViewMode('mushaf-page');
            setActivePage('reader');
          }}
          onOpenSearch={(query) => {
            setSearchInitialQuery(query || '');
            setIsSearchModalOpen(true);
          }}
          onOpenBookmarks={() => setIsBookmarksModalOpen(true)}
          onOpenKhatm={() => setIsKhatmModalOpen(true)}
          onOpenStories={handleOpenStories}
          onOpenAI={(verse) => handleOpenAI(verse)}
          onOpenMemorization={handleOpenMemorization}
          onOpenOfflineDownloads={handleOpenOffline}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenAbout={() => setIsAboutModalOpen(true)}
          onOpenMenu={() => setIsMoreMenuOpen(true)}
          onToggleDarkMode={handleToggleDarkMode}
          onPlayVerseAudio={(sId, vNum) => {
            const s = surahs.find((x) => x.id === sId);
            if (s) setCurrentSurah(s);
            setActivePlayingVerseNumber(vNum);
            setIsAudioPlayerOpen(true);
          }}
          darkMode={settings.darkMode}
        />
      ) : activePage === 'ai' ? (
        <Suspense fallback={<PageLoadingFallback />}>
          <AIPage
            currentVerse={aiContextVerse}
            currentSurah={currentSurah}
            surahs={surahs}
            darkMode={settings.darkMode}
            onBack={handleBackToPrevious}
            onNavigateHome={() => setActivePage('home')}
            onNavigateToVerse={(sId, vNum) => {
              handleNavigateToVerse(sId, vNum);
            }}
          />
        </Suspense>
      ) : activePage === 'memorization' ? (
        <Suspense fallback={<PageLoadingFallback />}>
          <MemorizationPage
            surahs={surahs}
            currentSurah={currentSurah}
            verses={verses}
            onSelectSurah={(surah) => {
              setResumeScrollVerse(null);
              setCurrentSurah(surah);
              setCurrentMushafPage(surah.startPage || 1);
              // کاربر در همان صفحه حفظ می‌ماند و خارج نمی‌شود
            }}
            settings={settings}
            darkMode={settings.darkMode}
            onBack={handleBackToPrevious}
          />
        </Suspense>
      ) : activePage === 'stories' ? (
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-12 animate-fadeIn select-none" dir="rtl">
          {/* سربرگ اختصاصی و فاخر صفحه داستان‌ها */}
          <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-stone-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100">
                  داستان‌ها و حکمت‌های قرآنی
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  گنجینه سرگذشت‌های آموزنده قرآن، تلاوت آیات و آزمون‌های تدبّر
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBackToPrevious}
              className="py-2 px-3.5 rounded-xl border border-stone-200 dark:border-slate-800 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
              <span>بازگشت</span>
            </button>
          </div>

          <Suspense fallback={<PageLoadingFallback />}>
            <QuranStoriesExplorer
              darkMode={settings.darkMode}
              onNavigateToSurah={(sId) => {
                const target = surahs.find((s) => s.id === sId);
                if (target) {
                  setCurrentSurah(target);
                  setCurrentMushafPage(target.startPage || 1);
                  setActivePage('reader');
                }
              }}
            />
          </Suspense>
        </div>
      ) : activePage === 'offline' ? (
        <Suspense fallback={<PageLoadingFallback />}>
          <OfflinePage
            darkMode={settings.darkMode}
            onBack={handleBackToPrevious}
          />
        </Suspense>
      ) : isLayoutPrototype ? (
        <Suspense fallback={<PageLoadingFallback />}>
          <MushafPrototype
            pages={prototypePages}
            darkMode={settings.darkMode}
            arabicFont={settings.arabicFont}
            arabicFontSize={settings.arabicFontSize}
          />
        </Suspense>
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
            handleOpenAI(verse);
          }}
          onPlayVerseAudio={handlePlayVerseAudio}
          onReadingPositionChange={handleReadingPositionChange}
          initialScrollToVerseNumber={resumeScrollVerse}
          onInitialScrollHandled={() => setResumeScrollVerse(null)}
          onNextSurah={handleNextSurah}
          onPrevSurah={handlePrevSurah}
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
            handleOpenAI(verse);
          }}
          onPlayVerseAudio={handlePlayVerseAudio}
          activeVerseKey={
            isAudioPlayerOpen && activePlayingVerseNumber !== null
              ? `${currentSurah.id}:${activePlayingVerseNumber}`
              : null
          }
          onPageChange={(p, surahId, verseNumber) => {
            trackPageView(p);
            setCurrentMushafPage(p);
            if (surahId) {
              const targetSurah = surahs.find((s) => s.id === surahId);
              // هنگام پخش صوت، سورهٔ پلیر با ورق زدن صفحه عوض نمی‌شود
              const audioActive = isAudioPlayerOpen && activePlayingVerseNumber !== null;
              if (targetSurah && targetSurah.id !== currentSurah.id && !audioActive) {
                setCurrentSurah(targetSurah);
              }
              const vNum = verseNumber || 1;
              QuranService.saveLastRead(surahId, vNum, p);
              setLastReadPosition({ surahId, verseNumber: vNum, pageNumber: p });
              setResumeScrollVerse(vNum);
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
          hasBottomNav={false}
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

      {/* مودال‌های کمکی بارگذاری‌شده با کداسپلیتینگ */}
      <Suspense fallback={null}>
        {isVerseDetailOpen && (
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
              handleOpenAI(verse);
            }}
            onSaveNote={handleSaveNote}
          />
        )}

        {isSearchModalOpen && (
          <SearchModal
            isOpen={isSearchModalOpen}
            onClose={() => {
              setIsSearchModalOpen(false);
              setSearchInitialQuery('');
            }}
            surahs={surahs}
            onSelectResult={handleNavigateToVerse}
            onNavigateToPage={(pageNum, forcePage) => handleNavigateToMushafPage(pageNum, forcePage ?? true)}
            onNavigateToJuz={handleNavigateToJuz}
            darkMode={settings.darkMode}
            initialQuery={searchInitialQuery}
          />
        )}

        {isSurahSearchOpen && (
          <SurahSearchModal
            isOpen={isSurahSearchOpen}
            onClose={() => setIsSurahSearchOpen(false)}
            currentSurah={currentSurah}
            verses={verses}
            onSelectVerse={(verseNum) => {
              requestQuranScrollToVerse(verseNum);
            }}
            darkMode={settings.darkMode}
          />
        )}

        {isKhatmModalOpen && (
          <KhatmModal
            isOpen={isKhatmModalOpen}
            onClose={() => setIsKhatmModalOpen(false)}
            darkMode={settings.darkMode}
            onNavigateToPage={(pageNum) => handleNavigateToMushafPage(pageNum, false)}
          />
        )}

        {isBookmarksModalOpen && (
          <BookmarksModal
            isOpen={isBookmarksModalOpen}
            onClose={() => setIsBookmarksModalOpen(false)}
            surahs={surahs}
            onSelectBookmark={handleNavigateToVerse}
            darkMode={settings.darkMode}
          />
        )}

        {isSurahModalOpen && (
          <SurahSelectorModal
            isOpen={isSurahModalOpen}
            onClose={() => {
              setIsSurahModalOpen(false);
              setSurahModalInitialTab('surahs');
            }}
            initialTab={surahModalInitialTab}
            surahs={surahs}
            currentSurahId={currentSurah.id}
            onSelectSurah={handleSelectSurah}
            onSelectJuz={handleNavigateToJuz}
            onOpenAdvancedSearch={() => {
              setIsSurahModalOpen(false);
              setIsSearchModalOpen(true);
            }}
            darkMode={settings.darkMode}
          />
        )}

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenAbout={() => setIsAboutModalOpen(true)}
            darkMode={settings.darkMode}
          />
        )}

        {isAboutModalOpen && (
          <AboutModal
            isOpen={isAboutModalOpen}
            onClose={() => setIsAboutModalOpen(false)}
            darkMode={settings.darkMode}
          />
        )}
      </Suspense>

      {/* بنر به‌روزرسانی نسخه جدید با تأیید کاربر (P2-T2) */}
      <ShareChoiceSheet />

      {exitHint && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 rounded-2xl bg-teal-800 text-amber-200 text-xs font-bold shadow-lg border border-amber-300/40"
        >
          برای خروج یک بار دیگر بازگشت را بزنید
        </div>
      )}

      <PWAUpdateBanner isAudioPlaying={isAudioPlayerOpen && activePlayingVerseNumber !== null} />

      {/* نشانگر وضعیت آفلاین در صورت قطع اتصال شبکه */}
      <OfflineIndicator />

      {/* منوی کشویی اصلی (جایگزین نوار پایین و منوی امکانات) */}
      <AppDrawer
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        activePage={activePage}
        onNavigateHome={() => setActivePage('home')}
        onNavigateReader={() => {
          setActivePage('reader');
          if (lastReadPosition?.verseNumber) {
            setResumeScrollVerse(lastReadPosition.verseNumber);
            setTimeout(() => requestQuranScrollToVerse(lastReadPosition.verseNumber), 150);
          }
        }}
        onNavigateAI={() => handleOpenAI(null)}
        onNavigateMemorization={handleOpenMemorization}
        onOpenKhatm={() => setIsKhatmModalOpen(true)}
        onOpenBookmarks={() => setIsBookmarksModalOpen(true)}
        onOpenStories={handleOpenStories}
        onOpenOffline={handleOpenOffline}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onToggleDarkMode={handleToggleDarkMode}
        darkMode={settings.darkMode}
      />
    </div>
  );
}
