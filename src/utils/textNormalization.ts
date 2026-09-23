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

/**
 * تبدیل اعداد انگلیسی و لاتین به ارقام زیبای فارسی (۰ تا ۹)
 */
export function toPersianDigits(input: number | string | undefined | null): string {
  if (input === undefined || input === null) return '';
  const str = String(input);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[+w]);
}

/**
 * تبدیل ارقام فارسی و عربی به ارقام استاندارد لاتین
 */
export function parseAllDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

const PERSIAN_WORDS_TO_NUMBERS: Record<string, number> = {
  'اول': 1, 'یکم': 1, 'یک': 1,
  'دوم': 2, 'دو': 2,
  'سوم': 3, 'سو': 3, 'سه': 3,
  'چهارم': 4, 'چهار': 4,
  'پنجم': 5, 'پنج': 5,
  'ششم': 6, 'شش': 6,
  'هفتم': 7, 'هفت': 7,
  'هشتم': 8, 'هشت': 8,
  'نهم': 9, 'نه': 9,
  'دهم': 10, 'ده': 10,
  'یازدهم': 11, 'یازده': 11,
  'دوازدهم': 12, 'دوازده': 12,
  'سیزدهم': 13, 'سیزده': 13,
  'چهاردهم': 14, 'چهارده': 14,
  'پانزدهم': 15, 'پانزده': 15,
  'شانزدهم': 16, 'شانزده': 16,
  'هفدهم': 17, 'هفده': 17,
  'هجدهم': 18, 'هجده': 18,
  'نوزدهم': 19, 'نوزده': 19,
  'بیستم': 20, 'بیست': 20,
  'بیست و یکم': 21, 'بیست و یک': 21,
  'بیست و دوم': 22, 'بیست و دو': 22,
  'بیست و سوم': 23, 'بیست و سه': 23,
  'بیست و چهارم': 24, 'بیست و چهار': 24,
  'بیست و پنجم': 25, 'بیست و پنج': 25,
  'بیست و ششم': 26, 'بیست و شش': 26,
  'بیست و هفتم': 27, 'بیست و هفت': 27,
  'بیست و هشتم': 28, 'بیست و هشت': 28,
  'بیست و نهم': 29, 'بیست و نه': 29,
  'سی ام': 30, 'سی‌ام': 30, 'سیم': 30, 'سی': 30,
};

/**
 * تشخیص هوشمند شماره جزء (۱ تا ۳۰) از عبارت ورودی با پشتیبانی از حروف، ارقام فارسی و پیشوندها
 */
export function parseJuzQuery(query: string): number | null {
  const clean = query.trim();
  if (!clean) return null;

  const isJuzPrefix = /^(جزء|جوزء|ج)\s*/.test(clean);
  const withoutPrefix = clean.replace(/^(جزء|جوزء|ج)\s*/, '').trim();

  if (PERSIAN_WORDS_TO_NUMBERS[withoutPrefix]) {
    return PERSIAN_WORDS_TO_NUMBERS[withoutPrefix];
  }

  const digitStr = parseAllDigits(withoutPrefix);
  const num = parseInt(digitStr, 10);
  if (!isNaN(num) && num >= 1 && num <= 30) {
    if (isJuzPrefix || /^[۰-۹0-9]+$/.test(clean)) {
      return num;
    }
  }
  return null;
}

/**
 * تشخیص هوشمند شماره صفحه مصحف (۱ تا ۶۰۴) از عبارت ورودی با پشتیبانی از ارقام فارسی و پیشوندها
 */
export function parsePageQuery(query: string): number | null {
  const clean = query.trim();
  if (!clean) return null;

  const isPagePrefix = /^(صفحه|ص)\s*/.test(clean);
  const withoutPrefix = clean.replace(/^(صفحه|ص)\s*/, '').trim();
  const digitStr = parseAllDigits(withoutPrefix);
  const num = parseInt(digitStr, 10);
  if (!isNaN(num) && num >= 1 && num <= 604) {
    if (isPagePrefix || /^[۰-۹0-9]+$/.test(clean)) {
      return num;
    }
  }
  return null;
}
