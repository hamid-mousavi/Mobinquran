/**
 * موتور تخصصی ارزیابی هوشمند صحت تلاوت و حفظ قرآن
 * تطبیق صوت تشخیص داده شده توسط مرورگر (Web Speech API) با متن مصحف شریف
 */

export type StrictnessLevel = 'easy' | 'normal' | 'strict';

const STRICTNESS_THRESHOLDS: Record<StrictnessLevel, number> = {
  easy: 70,    // اغماض در خطاهای املایی و تجویدی مرورگر
  normal: 82,  // استاندارد حفظ
  strict: 92,  // سخت‌گیرانه و مسابقه‌ای
};

/**
 * علائم اعراب، تنوین، تشدید، سکون، مد، الف خنجری و نشانه‌های وقفی مصحف
 */
const DIACRITICS_AND_MARKS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08FF\uFE70-\uFE7F\u0610-\u061A]/g;

/**
 * کشیدگی حروف (تطویل) و نویسه‌های نامرئی
 */
const TATWEEL_AND_SPECIALS_REGEX = /[\u0640\u200B-\u200F\uFEFF\u202A-\u202E\u06D4\u06DD]/g;

/**
 * نویسه‌های نگارشی
 */
const PUNCTUATION_REGEX = /[«»""''،؛؟?.,:!()\[\]{}ـ\-_/\\+*=&^%$#@~`><|]/g;

/**
 * نرمال‌سازی متون برای مقایسه گفتاری:
 * ۱. حذف کامل اعراب و علائم تجویدی و وقفی
 * ۲. یکسان‌سازی همزه‌ها (أ، إ، آ، ٱ، ء -> ا)
 * ۳. یکسان‌سازی یای مصری و عربی و فارسی (ي، ى، ئ -> ی)
 * ۴. یکسان‌سازی تاء مربوطه (ة -> ه)
 * ۵. یکسان‌سازی واو همزه‌دار (ؤ -> و)
 * ۶. یکسان‌سازی کاف (ك -> ک)
 */
export function normalizeForSpeechMatch(text: string): string {
  if (!text) return '';
  return text
    .replace(DIACRITICS_AND_MARKS_REGEX, '')
    .replace(TATWEEL_AND_SPECIALS_REGEX, '')
    .replace(PUNCTUATION_REGEX, ' ')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يىئ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * محاسبه فاصله لون‌اشتاین برای سنجش شباهت کلمات دو به دو
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // جایگزینی
          matrix[i][j - 1] + 1,     // درج
          matrix[i - 1][j] + 1      // حذف
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * نسبت شباهت دو واژه بین ۰ تا ۱
 */
export function calculateWordSimilarity(word1: string, word2: string): number {
  const norm1 = normalizeForSpeechMatch(word1);
  const norm2 = normalizeForSpeechMatch(word2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;

  const distance = calculateLevenshteinDistance(norm1, norm2);
  const sim = (maxLen - distance) / maxLen;
  return Math.max(0, sim);
}

export interface WordEvaluationResult {
  originalWord: string;
  normalizedWord: string;
  status: 'matched' | 'missed' | 'fuzzy';
  spokenWord?: string;
  similarity: number;
}

export interface RecitationEvaluation {
  accuracy: number; // درصد 0 تا 100
  isPass: boolean;
  totalTargetWords: number;
  matchedWordsCount: number;
  missedWordsCount: number;
  wordResults: WordEvaluationResult[];
  firstMissedWord?: string;
  message: string;
  verdictType: 'perfect' | 'passed' | 'needs_practice' | 'empty';
}

/**
 * ارزیابی متن تلاوت‌شده نسبت به آیه هدف
 */
export function evaluateRecitation(
  targetText: string,
  spokenText: string,
  strictness: StrictnessLevel = 'normal'
): RecitationEvaluation {
  if (!targetText || !targetText.trim()) {
    return {
      accuracy: 0,
      isPass: false,
      totalTargetWords: 0,
      matchedWordsCount: 0,
      missedWordsCount: 0,
      wordResults: [],
      message: 'آیه‌ای برای ارزیابی مشخص نشده است.',
      verdictType: 'empty',
    };
  }

  const rawTargetWords = targetText.trim().split(/\s+/).filter(Boolean);
  const targetWords = rawTargetWords.map((w) => ({
    original: w,
    normalized: normalizeForSpeechMatch(w),
  }));

  if (!spokenText || !spokenText.trim()) {
    return {
      accuracy: 0,
      isPass: false,
      totalTargetWords: targetWords.length,
      matchedWordsCount: 0,
      missedWordsCount: targetWords.length,
      wordResults: targetWords.map((tw) => ({
        originalWord: tw.original,
        normalizedWord: tw.normalized,
        status: 'missed',
        similarity: 0,
      })),
      message: 'هنوز صدایی ضبط نشده است. میکروفون را فعال کنید و تلاوت فرمایید.',
      verdictType: 'empty',
    };
  }

  const spokenWords = spokenText
    .trim()
    .split(/\s+/)
    .map((w) => normalizeForSpeechMatch(w))
    .filter(Boolean);

  const wordResults: WordEvaluationResult[] = [];
  let spokenIndex = 0;
  let totalWeightedScore = 0;
  let matchedCount = 0;
  let firstMissed: string | undefined;

  for (let i = 0; i < targetWords.length; i++) {
    const target = targetWords[i];
    let bestMatchIndex = -1;
    let bestSimilarity = 0;

    // جستجوی بهترین تطابق در پنجره جاری از کلمات گفته‌شده (تا ۳ کلمه جلوتر برای جبران کلمات جاافتاده)
    const windowEnd = Math.min(spokenWords.length, spokenIndex + 4);
    for (let s = spokenIndex; s < windowEnd; s++) {
      const sim = calculateWordSimilarity(target.normalized, spokenWords[s]);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatchIndex = s;
      }
      if (sim === 1.0) break; // تطابق صد در صد
    }

    // آستانه پذیرش کلمه بر اساس درجه سخت‌گیری
    const fuzzyThreshold = strictness === 'strict' ? 0.88 : strictness === 'normal' ? 0.75 : 0.65;

    if (bestSimilarity >= fuzzyThreshold && bestMatchIndex !== -1) {
      const isExact = bestSimilarity >= 0.95;
      wordResults.push({
        originalWord: target.original,
        normalizedWord: target.normalized,
        status: isExact ? 'matched' : 'fuzzy',
        spokenWord: spokenWords[bestMatchIndex],
        similarity: bestSimilarity,
      });

      totalWeightedScore += bestSimilarity;
      matchedCount += 1;
      spokenIndex = bestMatchIndex + 1;
    } else {
      wordResults.push({
        originalWord: target.original,
        normalizedWord: target.normalized,
        status: 'missed',
        similarity: bestSimilarity,
      });

      if (!firstMissed) {
        firstMissed = target.original;
      }
    }
  }

  const accuracy = Math.round(
    (totalWeightedScore / Math.max(1, targetWords.length)) * 100
  );
  const threshold = STRICTNESS_THRESHOLDS[strictness];
  const isPass = accuracy >= threshold;

  let verdictType: RecitationEvaluation['verdictType'] = 'needs_practice';
  let message = '';

  if (accuracy >= 95) {
    verdictType = 'perfect';
    message = 'احسنت! تلاوت بی‌نقص و با تسلط کامل انجام شد.';
  } else if (isPass) {
    verdictType = 'passed';
    message = `تلاوت مورد تایید است (${accuracy}٪ تطابق با مصحف شریف).`;
  } else {
    verdictType = 'needs_practice';
    if (firstMissed) {
      message = `دقت کنید: کلمه «${firstMissed}» جا افتاد یا ناقص خوانده شد.`;
    } else {
      message = `درصد تسلط ${accuracy}٪ کمتر از آستانه قبولی (${threshold}٪) است. دوباره تلاش کنید.`;
    }
  }

  return {
    accuracy,
    isPass,
    totalTargetWords: targetWords.length,
    matchedWordsCount: matchedCount,
    missedWordsCount: targetWords.length - matchedCount,
    wordResults,
    firstMissedWord: firstMissed,
    message,
    verdictType,
  };
}
