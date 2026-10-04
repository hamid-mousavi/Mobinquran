/**
 * موتور تخصصی ارزیابی هوشمند صحت تلاوت و حفظ قرآن کریم
 * با پشتیبانی از تطبیق فراگیر (Global Sequence Alignment)، همسان‌سازی تجویدی و آوایی (Phonetic Normalization)
 * و رفع خطاهای رایج تشخیص صوت مرورگر در زبان و تلاوت قرآنی
 */

export type StrictnessLevel = 'easy' | 'normal' | 'strict';

const STRICTNESS_THRESHOLDS: Record<StrictnessLevel, number> = {
  easy: 60,    // اغماض در تلفظ‌های ریز مرورگر و ادغام‌های تجویدی
  normal: 75,  // استاندارد جلسات حفظ
  strict: 90,  // مسابقه‌ای و سخت‌گیرانه
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
 * نویسه‌های نگارشی و علائم لاتین و عددی
 */
const PUNCTUATION_REGEX = /[«»""''،؛؟?.,:!()\[\]{}ـ\-_/\\+*=&^%$#@~`><|0-9۰-۹]/g;

/**
 * نرمال‌سازی متون برای مقایسه گفتاری پایه:
 * ۱. حذف کامل اعراب و علائم تجویدی و وقفی
 * ۲. یکسان‌سازی همزه‌ها (أ، إ، آ، ٱ، ء -> ا)
 * ۳. یکسان‌سازی یای مصری و عربی و فارسی (ي، ى، ئ -> ی)
 * ۴. یکسان‌سازی تاء مربوطه (ة -> ه)
 * ۵. یکسان‌سازی واو همزه‌دار (ؤ -> و)
 * ۶. یکسان‌سازی کاف (ك -> ک)
 * ۷. حذف الف ساکن جمع در انتهای کلمات (وا -> و مثل قالوا/قالو)
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
    .replace(/وا\b/g, 'و') // الف ساکن جمع
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * همسان‌سازی آوایی پیشرفته برای خطاهای رایج موتورهای تشخیص گفتار در ترتیل قرآن:
 * ص -> س
 * ط -> ت
 * ض/ظ -> ز
 * ذ -> ز
 * ث -> س
 * غ -> ق
 */
export function normalizePhoneticEquivalents(word: string): string {
  if (!word) return '';
  return word
    .replace(/ص/g, 'س')
    .replace(/ط/g, 'ت')
    .replace(/[ضظ]/g, 'ز')
    .replace(/ذ/g, 'ز')
    .replace(/ث/g, 'س')
    .replace(/غ/g, 'ق');
}

/**
 * حذف پیشوندهای چسبان عربی (حروف عطف، جر و الف و لام)
 * برای مواردی که مرورگر پیشوند را نشنیده یا اضافه نوشته است
 * مثل: والشمس -> الشمس / شمس
 */
export function stripArabicPrefixes(word: string): string[] {
  const forms: string[] = [word];
  let current = word;

  // حذف پیشوند و یا ف
  if ((current.startsWith('و') || current.startsWith('ف')) && current.length > 2) {
    const stripped = current.slice(1);
    forms.push(stripped);
    current = stripped;
  }

  // حذف پیشوند ال
  if (current.startsWith('ال') && current.length > 3) {
    forms.push(current.slice(2));
  }

  // حذف پیشوند ب یا ل
  if ((word.startsWith('ب') || word.startsWith('ل')) && word.length > 2) {
    forms.push(word.slice(1));
  }

  return Array.from(new Set(forms));
}

/**
 * محاسبه فاصله لون‌اشتاین (Levenshtein Distance)
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
 * شباهت دو رشته خام کلمه (۰ تا ۱)
 */
function rawStringSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  if (!w1 || !w2) return 0.0;
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 1.0;
  const dist = calculateLevenshteinDistance(w1, w2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * محاسبه جامع شباهت دو واژه با در نظر گرفتن پیشوندها، آواها و خطاهای ضبط مرورگر
 */
export function calculateWordSimilarity(word1: string, word2: string): number {
  const norm1 = normalizeForSpeechMatch(word1);
  const norm2 = normalizeForSpeechMatch(word2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // ۱. شباهت مستقیم نرمال‌شده
  let bestSim = rawStringSimilarity(norm1, norm2);
  if (bestSim >= 0.95) return 1.0;

  // ۲. شباهت آوایی (Phonetic)
  const phone1 = normalizePhoneticEquivalents(norm1);
  const phone2 = normalizePhoneticEquivalents(norm2);
  const phoneSim = rawStringSimilarity(phone1, phone2);
  bestSim = Math.max(bestSim, phoneSim * 0.98); // ضریب سبک برای تبدیل‌های آوایی مجاز

  // ۳. شباهت بدون پیشوندهای چسبان (Clitics)
  const prefixes1 = stripArabicPrefixes(norm1);
  const prefixes2 = stripArabicPrefixes(norm2);

  for (const p1 of prefixes1) {
    for (const p2 of prefixes2) {
      const pSim = rawStringSimilarity(p1, p2);
      // تطابق ریشه کلمه با اغماض پیشوند
      if (pSim >= 0.9) {
        bestSim = Math.max(bestSim, pSim * 0.95);
      }
    }
  }

  return Math.min(1.0, Math.max(0, bestSim));
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
 * ارزیابی هوشمند متن تلاوت با الگوریتم تطبیق سرتاسری ترتیبی (Global Needleman-Wunsch Alignment)
 * این الگوریتم مانع از قفل شدن روی کلمات جاافتاده می‌شود و خطاهای متوالی را خنثی می‌کند.
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

  // تفکیک کلمات شنیده‌شده با نرمال‌سازی
  const spokenWords = spokenText
    .trim()
    .split(/\s+/)
    .map((w) => normalizeForSpeechMatch(w))
    .filter(Boolean);

  const N = targetWords.length;
  const M = spokenWords.length;

  // آستانه قبولی هر کلمه بر اساس درجه سخت‌گیری
  const wordAcceptThreshold = strictness === 'strict' ? 0.82 : strictness === 'normal' ? 0.68 : 0.58;

  // ماتریس برنامه‌ریزی پویا برای تطبیق بهینه کلی (Needleman-Wunsch)
  // dp[i][j] = بیشترین امتیاز تطابق ترتیبی T[0..i-1] با S[0..j-1]
  const dp: number[][] = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));
  const simMatrix: number[][] = Array.from({ length: N }, () => Array(M).fill(0));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      simMatrix[i][j] = calculateWordSimilarity(targetWords[i].normalized, spokenWords[j]);
    }
  }

  // پر کردن جدول DP
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const matchScore = simMatrix[i - 1][j - 1];
      // امتیاز تطابق اگر بالای آستانه باشد
      const gain = matchScore >= wordAcceptThreshold ? matchScore : 0;

      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + gain, // تطبیق کلمه i با j
        dp[i - 1][j],           // جا انداختن کلمه i از آیه (بدون جریمه مسدودکننده)
        dp[i][j - 1]            // رد شدن از کلمه اضافی j در گفتار
      );
    }
  }

  // ردیابی به عقب (Backtracking) برای استخراج وضعیت تک‌تک کلمات
  let i = N;
  let j = M;
  const matchedTargetIndices = new Map<number, { spokenIdx: number; similarity: number }>();

  while (i > 0 && j > 0) {
    const current = dp[i][j];
    const matchScore = simMatrix[i - 1][j - 1];
    const gain = matchScore >= wordAcceptThreshold ? matchScore : 0;

    if (current === dp[i - 1][j - 1] + gain && gain > 0) {
      matchedTargetIndices.set(i - 1, { spokenIdx: j - 1, similarity: matchScore });
      i--;
      j--;
    } else if (current === dp[i - 1][j]) {
      i--;
    } else {
      j--;
    }
  }

  // تدوین نتیجه کلمه به کلمه برای رابط کاربری
  const wordResults: WordEvaluationResult[] = [];
  let totalScore = 0;
  let matchedCount = 0;
  let firstMissed: string | undefined;

  for (let idx = 0; idx < N; idx++) {
    const target = targetWords[idx];
    const match = matchedTargetIndices.get(idx);

    if (match && match.similarity >= wordAcceptThreshold) {
      const isExact = match.similarity >= 0.92;
      wordResults.push({
        originalWord: target.original,
        normalizedWord: target.normalized,
        status: isExact ? 'matched' : 'fuzzy',
        spokenWord: spokenWords[match.spokenIdx],
        similarity: match.similarity,
      });
      totalScore += match.similarity;
      matchedCount++;
    } else {
      wordResults.push({
        originalWord: target.original,
        normalizedWord: target.normalized,
        status: 'missed',
        similarity: 0,
      });
      if (!firstMissed) {
        firstMissed = target.original;
      }
    }
  }

  const accuracy = Math.round((totalScore / Math.max(1, N)) * 100);
  const threshold = STRICTNESS_THRESHOLDS[strictness];
  const isPass = accuracy >= threshold;

  let verdictType: RecitationEvaluation['verdictType'] = 'needs_practice';
  let message = '';

  if (accuracy >= 90) {
    verdictType = 'perfect';
    message = 'احسنت! تلاوت بدون نقص و با تسلط کامل بر تمام کلمات انجام شد.';
  } else if (isPass) {
    verdictType = 'passed';
    message = `تلاوت مورد تایید است (${accuracy}٪ تطابق با مصحف شریف).`;
  } else {
    verdictType = 'needs_practice';
    if (firstMissed) {
      message = `دقت فرمایید: کلمه «${firstMissed}» یا کلمات بعدی در ترتیل شما به وضوح شنیده نشد.`;
    } else {
      message = `درصد تسلط (${accuracy}٪) کمتر از آستانه قبولی (${threshold}٪) است. دوباره بخوانید.`;
    }
  }

  return {
    accuracy,
    isPass,
    totalTargetWords: N,
    matchedWordsCount: matchedCount,
    missedWordsCount: N - matchedCount,
    wordResults,
    firstMissedWord: firstMissed,
    message,
    verdictType,
  };
}
