export type UserIntent = 'casual_chat' | 'quran_inquiry' | 'current_info' | 'hybrid';

export type SourceType = 'quran' | 'tafsir' | 'hadith' | 'web';

export interface SourceItem {
  id: string; // شناسه یکتا مانند: quran:2:255 یا tafsir:mizan:2:255 یا hadith:kafi:1 یا web:0
  title: string; // مثلاً: سوره البقرة، آیه ۲۵۵
  type: SourceType;
  reference: string; // مثلاً: بقره: ۲۵۵ یا المیزان ذیل بقره ۲۵۵ یا الکافی ج ۲ ص ۸۹
  sourceName: string; // مثلاً: قرآن کریم، تفسیر المیزان، اصول کافی، وب
  url: string; // آدرس داخلی (deepLink) مانند: /quran/2/255 یا آدرس خارجی وب
  isInternal: boolean; // آیا منبع داخلی اپ است یا خارجی
  metadata?: {
    surahId?: number;
    verseNumber?: number;
    surahName?: string;
  };
}

export interface RagCandidate {
  sourceId: string;
  type: SourceType;
  title: string;
  reference: string;
  sourceName: string;
  content: string;
  sourceItem: SourceItem;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiAgentRequest {
  question: string;
  history?: ConversationMessage[];
  currentVerse?: {
    surahId: number;
    verseNumber: number;
    textArabic: string;
    translationMakarem: string;
  } | null;
  agent?: 'moral' | 'conceptual' | 'literary' | 'rational';
  lang?: 'fa' | 'en' | 'ur';
}

export interface WebGroundingChunk {
  title: string;
  uri: string;
}
