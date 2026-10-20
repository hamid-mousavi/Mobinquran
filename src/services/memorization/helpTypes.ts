/**
 * قرارداد مشترک کلاینت و سرور برای «کمک هوشمند حفظ» (مرحلهٔ ۳ج) — خالص و بدون وابستگی.
 *
 * اصل ایمنی: مدل هیچ متن عربی قرآن تولید نمی‌کند. کلمات کلیدی را فقط با «شمارهٔ کلمه» در آیهٔ هدف
 * اعلام می‌کند و کلاینت خودِ کلمه را از متن محلی نشان می‌دهد؛ شباهت‌ها هم از متن واقعی محاسبه شده‌اند.
 */

export type HelpSimilarityKind = 'identical' | 'same_start' | 'same_ending' | 'overlap';

export interface HelpSimilarItem {
  /** «سوره:آیه» */
  ref: string;
  text: string;
  kind: HelpSimilarityKind;
}

export interface HelpRequest {
  surahId: number;
  verseNumber: number;
  surahName?: string;
  /** تعداد دفعات فراموشی (برای تنظیم لحن و شدت تمرین) */
  lapses: number;
  targetText: string;
  previousText?: string;
  nextText?: string;
  similar: HelpSimilarItem[];
}

export interface HelpConfusion {
  ref: string;
  tip: string;
}

export interface HelpResult {
  linkToPrevious: string;
  /** شمارهٔ کلمه‌ها (از ۱) در آیهٔ هدف */
  keywordIndexes: number[];
  memoryTip: string;
  confusions: HelpConfusion[];
  practicePlan: string;
}

export const HELP_LIMITS = {
  text: 1200,
  surahName: 60,
  similar: 4,
  maxKeywords: 4,
  field: 400,
} as const;

/** شکستن متن نمایشی به کلمه‌ها؛ هر دو سو (سرور و کلاینت) باید دقیقاً همین را به کار ببرند */
export function splitDisplayWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** آیا رشته شامل متن اعرابی‌دار (احتمالاً نقل آیه توسط مدل) است؟ */
export function containsQuranicText(s: string): boolean {
  const marks = s.match(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g);
  return (marks?.length ?? 0) >= 2;
}
