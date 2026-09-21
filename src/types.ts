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

export interface Verse {
  id: number;
  surahId: number;
  verseNumber: number;
  juzNumber: number;
  pageNumber: number;
  textArabic: string;
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

export type AIProvider = 'openrouter' | 'deepseek' | 'groq';

export interface AISettings {
  provider: AIProvider;
  openrouterKey: string;
  deepseekKey: string;
  groqKey: string;
  model: string; // فقط برای OpenRouter استفاده می‌شود
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
