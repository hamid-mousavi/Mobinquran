/**
 * ماژول تخصصی نرمال‌سازی متون عربی و فارسی قرآن و ترجمه‌ها
 * جهت جستجوی سریع، دقیق و بی‌نقص آفلاین
 */

/**
 * علائم اِعراب، تنوین، تشدید، سکون، مد، الف خنجری و علائم وقفی مصحف شریف
 */
const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08FF\uFE70-\uFE7F]/g;

/**
 * کشیدگی حروف (تطویل) و کاراکترهای نامرئی
 */
const TATWEEL_AND_ZERO_WIDTH_REGEX = /[\u0640\u200B-\u200F\uFEFF\u202A-\u202E]/g;

/**
 * نیم‌فاصله‌های متوالی یا تک
 */
const ZWNJ_REGEX = /\u200C/g;

/**
 * نرمال‌سازی متن عربی برای جستجو:
 * ۱. حذف تمام اعراب، تنوین‌ها، تشدید، سکون، علائم وقفی قرآنی
 * ۲. حذف کشیدگی کلمات (ـ) و نویسه‌های نامرئی
 * ۳. همسان‌سازی همزه‌ها: (إ، أ، آ، ء، ٱ) -> ا
 * ۴. همسان‌سازی یای حامل همزه و واو حامل همزه: (ئ، ؤ) -> ی و و
 * ۵. همسان‌سازی الف مقصوره و یا: (ى، ي) -> ی
 * ۶. همسان‌سازی تاء مربوطه: ة -> ه
 * ۷. همسان‌سازی کاف: ك -> ک
 */
export function normalizeArabicForSearch(text: string): string {
  if (!text) return '';
  return text
    .replace(ARABIC_DIACRITICS_REGEX, '')
    .replace(TATWEEL_AND_ZERO_WIDTH_REGEX, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ئ/g, 'ی')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, 'ء')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * نرمال‌سازی متن فارسی (ترجمه‌ها) برای جستجو:
 * ۱. یکسان‌سازی حروف عربی ي و ك به ی و ک فارسی
 * ۲. تبدیل نیم‌فاصله‌ها به فاصله عادی جهت یافتن مشتقات و ترکیبات
 * ۳. حذف نویسه‌های نامرئی و علائم نگارشی رایج
 * ۴. تبدیل اعداد به فرم استاندارد
 */
export function normalizePersianForSearch(text: string): string {
  if (!text) return '';
  return text
    .replace(TATWEEL_AND_ZERO_WIDTH_REGEX, '')
    .replace(ZWNJ_REGEX, ' ')
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[«»""''،؛؟?.,:!()\[\]{}ـ-]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * تجزیه عبارت جستجو به واژه‌های مستقل جهت جستجوی چندکلمه‌ای
 */
export function tokenizeQuery(query: string, isPersian = false): string[] {
  const normalized = isPersian ? normalizePersianForSearch(query) : normalizeArabicForSearch(query);
  return normalized
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * محاسبه امتیاز تطابق جهت رتبه‌بندی نتایج:
 * ۳ = تطابق دقیق کلمه (Exact Word Match)
 * ۲ = آغاز کلمه با عبارت (Prefix Match)
 * ۱ = وجود درون کلمه (Substring Match)
 * ۰ = عدم تطابق
 */
export function calculateMatchScore(normalizedTarget: string, normalizedQuery: string): number {
  if (!normalizedTarget || !normalizedQuery) return 0;
  if (normalizedTarget === normalizedQuery) return 4;

  const targetWords = normalizedTarget.split(/\s+/);
  let maxScore = 0;

  for (const word of targetWords) {
    if (word === normalizedQuery) {
      return 3;
    }
    if (word.startsWith(normalizedQuery)) {
      maxScore = Math.max(maxScore, 2);
    } else if (word.includes(normalizedQuery)) {
      maxScore = Math.max(maxScore, 1);
    }
  }

  if (maxScore === 0 && normalizedTarget.includes(normalizedQuery)) {
    return 1;
  }

  return maxScore;
}
