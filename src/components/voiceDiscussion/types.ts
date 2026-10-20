import { RecitationEvaluation } from '../../utils/quranRecitationEvaluator';

export type DiscussionMode =
  | 'verse_by_verse' // ۱. آیه به آیه
  | 'page_by_page' // ۲. صفحه به صفحه
  | 'completion' // ۳. مباحثه تکمیلی (نیمه‌کاره)
  | 'competitive' // ۴. روش مسابقه‌ای (سرعتی و امتیازی)
  | 'thematic'; // ۵. مقطع به مقطع یا محتوا محور

export interface AiRecitationResult {
  isPass: boolean;
  accuracy: number;
  verdictMessage: string;
  matchedWords?: string[];
  missedWords?: string[];
  tajweedNote?: string;
  /** ارائه‌دهندهٔ پاسخ (فقط اطلاع‌رسانی) */
  provider?: string;
  /** پاسخ از کش بوده و سهمیه مصرف نکرده است */
  cached?: boolean;
  /** سهمیهٔ روزانهٔ باقی‌مانده پس از این درخواست */
  quota?: { used: number; limit: number; remaining: number };
}

export interface SmartRecitationFeedbackPanelProps {
  evaluation: RecitationEvaluation;
  transcribedText: string;
  isRecording: boolean;
  onToggleRecording: () => void;
  onRetry: () => void;
  onAccept: () => void;
  onReject?: () => void;
  acceptLabel?: string;
  rejectLabel?: string;
  isCompetitive?: boolean;
  targetText?: string;
  surahName?: string;
  verseNumber?: number | string;
  surahId?: number;
  rawVerseNumber?: number;
}
