export interface Surah {
  id: number;
  nameArabic: string;
  namePersian: string;
  englishName: string;
  revelationType: 'Meccan' | 'Medinan';
  versesCount: number;
  startPage: number;
  juzNumber: number;
}

export interface SajdaInfo {
  id: number;
  recommended: boolean;
  obligatory: boolean;
}

export interface Verse {
  id: number;
  surahId: number;
  verseNumber: number;
  juzNumber: number;
  pageNumber: number;
  hizbQuarter?: number;
  ruku?: number;
  manzil?: number;
  sajda?: SajdaInfo;
  textArabic: string;
  textSimple?: string;
  translationMakarem: string;
  translationFooladvand: string;
  translationAnsarian: string;
  tafsirNemoneh?: string;
  tafsirMizan?: string;
  references?: ContentReference[];
  rootWords?: string[];
  audioUrl?: string;
}

export interface UserBookmark {
  id?: number;
  surahId: number;
  verseNumber: number;
  createdAt: number;
  note?: string;
  folder?: string;
}

export interface ReadingState {
  id: string;
  surahId: number;
  verseNumber: number;
  pageNumber: number;
  updatedAt: number;
}

export interface OfflineContentStatus {
  downloadedSurahIds: number[];
  downloadedVerses: number;
  totalVerses: number;
  isComplete: boolean;
}

export interface OfflineDownloadResult {
  downloadedSurahIds: number[];
  failedSurahIds: number[];
  cancelled: boolean;
}

export interface ContentMetadata {
  id: string;
  sourceName: string;
  sourceUrl: string;
  datasetVersion: string;
  licenseStatus: 'pending_review';
  lastSyncedAt: number;
  schemaVersion?: number;
  integrityHash?: string;
}

export interface ContentReference {
  sourceTitle: string;
  sourceUrl?: string;
  volume?: string;
  page?: string;
  section?: string;
  licenseStatus: 'pending_review' | 'verified';
}

export type ViewMode = 'verse-by-verse' | 'mushaf-page';
export type Translator = 'makarem' | 'fooladvand' | 'ansarian';

/** نوع خطای صوتی برای ثبت در لاگ مشاهده‌پذیری (P5-T5) */
export type AudioErrorKind =
  | 'network'    // قطعی شبکه / زمان‌فنا
  | 'not-found'  // 404 — فایل در منبع وجود ندارد (مثلاً آیات غایب منشاوی)
  | 'corrupt'    // فایل خراب / decode شکست
  | 'cors'       // دسترسی CORS رد شد
  | 'cancelled'  // پخش به‌صورت دستی متوقف شد
  | 'unknown';

export interface AudioErrorLogEntry {
  id?: number;
  createdAt: number;
  surahId: number;
  verseNumber: number;
  reciterId: string;
  sourceIndex: number;
  sourceName: string;
  kind: AudioErrorKind;
  message: string;
  /** رشته‌ی مرجع منبع (URL مقصد) بدون افشای کلید */
  url: string;
}

export type ArabicFont =
  | 'uthman-taha'
  | 'kfgqpc-hafs'
  | 'amiri-quran'
  | 'scheherazade'
  | 'amiri'
  | 'system';

export type LineHeight = 'normal' | 'relaxed' | 'loose';

export interface AppSettings {
  arabicFontSize: number;
  translationFontSize: number;
  showTranslation: boolean;
  activeTranslator: Translator;
  arabicFont: ArabicFont;
  darkMode: boolean;
  themeColor: 'emerald' | 'amber' | 'blue';
  defaultViewMode: ViewMode;
  lineHeight?: LineHeight;
}

export interface SearchResultItem {
  id: number;
  surahId: number;
  surahNameArabic: string;
  surahNamePersian: string;
  verseNumber: number;
  pageNumber: number;
  juzNumber: number;
  textArabic: string;
  translation: string;
  matchedIn: 'arabic' | 'translation';
}

export type KhatmType = 'ramadan_30' | 'arbaeen_40' | 'hizb_120' | 'custom';

export interface KhatmPlan {
  id: string;
  title: string;
  type: KhatmType;
  startDate: string; // ISO format
  targetDays: number;
  totalPages: number; // 604
  completedPages: number[];
  currentDay: number;
  lastReadDate?: string;
  isActive: boolean;
}

/** ابردادهٔ سوره پخش‌شده بدون نیاز به اینترنت (P5-T2) — باینری در Cache Storage (ADR-8) */
export interface AudioDownloadRecord {
  key: string; // `${reciterId}::${surahId}`
  reciterId: string;
  surahId: number;
  downloadedVerses: number;
  totalVerses: number;
  bytes: number;
  downloadedAt: number;
  sourcesUsed: string[];
}
